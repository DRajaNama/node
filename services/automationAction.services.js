const dns = require('dns').promises;
const crypto = require('crypto');
const net = require('net');
const http = require('http');
const https = require('https');
const Campaign = require('../models/campaign.model');
const Template = require('../models/template.model');
const Settings = require('../models/settings.model');
const Contact = require('../models/contacts.model');
const CampaignRecipient = require('../models/campaignRecipient.model');
const sendEmail = require('../helpers/email.provider');
const { replaceTemplateVariables } = require('../helpers/template.helper');
const EntitlementService = require('./entitlement.services');
const { renderTemplate, renderJson } = require('../utils/automationTemplate.utils');
const {
  resolveWebhookHeaders,
  assertSecureWebhookConfig,
  FORBIDDEN_WEBHOOK_HEADER_NAMES,
} = require('./automationConfig.services');
const { AUTOMATION_ACTION } = require('../constants/automation.constants');
const { CAMPAIGN_STATUS, RECIPIENT_STATUS } = require('../constants/campaign.constants');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_WEBHOOK_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const UNAVAILABLE_ACTIONS = new Set([
  AUTOMATION_ACTION.SEND_TO_SLACK,
  AUTOMATION_ACTION.HUBSPOT_CRM,
  AUTOMATION_ACTION.ZOHO_CRM,
  AUTOMATION_ACTION.SALESFORCE,
  AUTOMATION_ACTION.GOHIGHLEVEL_CRM,
  AUTOMATION_ACTION.PIPEDRIVE_CRM,
]);

class AutomationActionError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AutomationActionError';
    this.code = options.code || 'AUTOMATION_ACTION_FAILED';
    this.safeMessage = message;
    this.responseStatus = options.responseStatus ?? null;
    this.retryable = options.retryable !== false;
    this.metadata = sanitizeMetadata(options.metadata || {});
  }
}

function sanitizeMetadata(value, depth = 0) {
  if (depth > 4 || value == null) return value == null ? value : '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => sanitizeMetadata(entry, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !/(authorization|cookie|password|secret|token|api.?key|headers|body|url)/i.test(key))
      .slice(0, 30)
      .map(([key, entry]) => [key, sanitizeMetadata(entry, depth + 1)]));
  }
  if (typeof value === 'string') return value.slice(0, 500);
  if (['number', 'boolean'].includes(typeof value)) return value;
  return String(value).slice(0, 500);
}

const safeErrorSummary = (error) => {
  if (error instanceof AutomationActionError) {
    return {
      code: error.code,
      message: error.safeMessage,
      responseStatus: error.responseStatus,
      retryable: error.retryable,
      metadata: sanitizeMetadata(error.metadata),
    };
  }
  return {
    code: 'AUTOMATION_ACTION_FAILED',
    message: 'Automation action failed.',
    responseStatus: null,
    retryable: true,
    metadata: {},
  };
};

const requireLeadEmail = (lead) => {
  const email = String(lead?.email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new AutomationActionError('The lead does not have a valid email address.', {
      code: 'LEAD_EMAIL_REQUIRED',
      retryable: false,
    });
  }
  return email;
};

const getUserSettings = async (userId) => {
  const settings = await Settings.findOne({ user: userId }).lean();
  if (!settings?.smtp?.host || !settings?.smtp?.port) {
    throw new AutomationActionError('SMTP settings are not configured.', {
      code: 'SMTP_NOT_CONFIGURED',
      retryable: false,
    });
  }
  return settings;
};

const checkEmailQuota = async (userId, count) => {
  try {
    await EntitlementService.checkEmailSendQuota(userId, count);
  } catch (error) {
    if (error?.name === 'QuotaExceededError' || error?.code === 'QUOTA_EXCEEDED') {
      throw new AutomationActionError('The email sending quota has been reached.', {
        code: 'QUOTA_EXCEEDED',
        retryable: false,
      });
    }
    throw error;
  }
};

const recordEmailUsageBestEffort = async (userId, count) => {
  try {
    await EntitlementService.recordEmailSends(userId, count);
    return true;
  } catch {
    // Sending already succeeded. Usage accounting must not cause a duplicate send.
    return false;
  }
};

const sendWithUserSmtp = async ({ userId, recipients, subject, html, fromName, fromEmail }) => {
  const settings = await getUserSettings(userId);
  const senderName = fromName || settings.email?.senderName || process.env.FROM_NAME || 'MailFlow Pro';
  const senderEmail = fromEmail || settings.email?.senderEmail || process.env.FROM_EMAIL || settings.smtp.username;
  if (!senderEmail || !EMAIL_PATTERN.test(String(senderEmail).trim())) {
    throw new AutomationActionError('A valid sender email is not configured.', {
      code: 'SENDER_EMAIL_REQUIRED',
      retryable: false,
    });
  }

  try {
    // SMTP has no portable idempotency key. Queue retries therefore provide
    // at-least-once delivery; providers may accept a message before a timeout.
    const result = await sendEmail({
      email: recipients,
      subject,
      fromName: senderName,
      fromEmail: senderEmail,
      html,
    }, settings.smtp);
    return result;
  } catch {
    throw new AutomationActionError('The email could not be sent.', {
      code: 'EMAIL_SEND_FAILED',
      retryable: true,
    });
  }
};

const prepareCampaignRecipient = async ({ campaign, contact, lead, execution }) => {
  const executionId = execution?._id || null;
  let recipient;
  try {
    recipient = await CampaignRecipient.create({
      campaignId: campaign._id,
      userId: campaign.userId,
      contactId: contact._id,
      automationExecutionId: executionId,
      email: contact.email,
      firstName: contact.firstName || lead.firstName || '',
      lastName: contact.lastName || lead.lastName || '',
      trackingToken: crypto.randomBytes(32).toString('hex'),
      status: RECIPIENT_STATUS.SENDING,
      provider: 'automation-smtp',
    });
    try {
      await Campaign.updateOne(
        { _id: campaign._id },
        { $inc: { 'stats.total': 1, 'stats.pending': 1 } }
      );
    } catch (error) {
      await CampaignRecipient.deleteOne({
        _id: recipient._id,
        status: RECIPIENT_STATUS.SENDING,
      }).catch(() => undefined);
      throw error;
    }
    return { recipient, skip: false };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    recipient = await CampaignRecipient.findOne({
      campaignId: campaign._id,
      contactId: contact._id,
    });
    if (!recipient) throw error;
  }

  const sameExecution = executionId
    && recipient.automationExecutionId
    && String(recipient.automationExecutionId) === String(executionId);
  if (!sameExecution) return { recipient, skip: true };
  if ([
    RECIPIENT_STATUS.SENT,
    RECIPIENT_STATUS.DELIVERED,
    RECIPIENT_STATUS.OPENED,
    RECIPIENT_STATUS.CLICKED,
  ].includes(recipient.status)) {
    return { recipient, skip: true };
  }

  const previousStatus = recipient.status;
  const claimed = await CampaignRecipient.findOneAndUpdate(
    { _id: recipient._id, status: previousStatus },
    { $set: { status: RECIPIENT_STATUS.SENDING } },
    { new: true }
  );
  if (!claimed) return { recipient, skip: true };
  if (previousStatus === RECIPIENT_STATUS.FAILED) {
    await Campaign.updateOne(
      { _id: campaign._id },
      { $inc: { 'stats.pending': 1, 'stats.failed': -1 } }
    );
  }
  return { recipient: claimed, skip: false };
};

const completeCampaignRecipientBestEffort = async ({ campaignId, recipientId, result }) => {
  try {
    const update = await CampaignRecipient.updateOne(
      { _id: recipientId, status: RECIPIENT_STATUS.SENDING },
      {
        $set: {
          status: RECIPIENT_STATUS.SENT,
          sentAt: new Date(),
          providerMessageId: String(result?.messageId || ''),
        },
      }
    );
    if (update.modifiedCount) {
      await Campaign.updateOne(
        { _id: campaignId },
        { $inc: { 'stats.sent': 1, 'stats.pending': -1 } }
      );
    }
    return !!update.modifiedCount;
  } catch {
    // The external send is committed; a bookkeeping outage must not resend it.
    return false;
  }
};

const failCampaignRecipientBestEffort = async ({ campaignId, recipientId }) => {
  try {
    const update = await CampaignRecipient.updateOne(
      { _id: recipientId, status: RECIPIENT_STATUS.SENDING },
      { $set: { status: RECIPIENT_STATUS.FAILED } }
    );
    if (update.modifiedCount) {
      await Campaign.updateOne(
        { _id: campaignId },
        { $inc: { 'stats.failed': 1, 'stats.pending': -1 } }
      );
    }
  } catch {
    // Preserve the original send error and its retry classification.
  }
};

const executeEmailCampaign = async ({ automation, lead, execution }) => {
  const campaignId = automation.actionConfig?.campaignId;
  const campaign = await Campaign.findOne({ _id: campaignId, userId: automation.userId }).lean();
  if (!campaign) {
    throw new AutomationActionError('The selected email campaign is unavailable.', {
      code: 'EMAIL_CAMPAIGN_NOT_FOUND',
      retryable: false,
    });
  }
  if (campaign.status !== CAMPAIGN_STATUS.AUTOMATION) {
    throw new AutomationActionError('Only an automation campaign can be sent by an automation.', {
      code: 'EMAIL_CAMPAIGN_NOT_SENDABLE',
      retryable: false,
    });
  }
  const template = await Template.findOne({ _id: campaign.templateId, userId: automation.userId }).lean();
  if (!template) {
    throw new AutomationActionError('The selected email template is unavailable.', {
      code: 'EMAIL_TEMPLATE_NOT_FOUND',
      retryable: false,
    });
  }

  const email = requireLeadEmail(lead);
  const canonicalContact = await Contact.findOne({
    userId: automation.userId,
    email,
  }).select('_id userId email firstName lastName status isUnsubscribed').lean();
  if (!canonicalContact) {
    throw new AutomationActionError('The lead contact record is unavailable.', {
      code: 'CONTACT_NOT_FOUND',
      retryable: false,
    });
  }
  if (
    canonicalContact
    && (canonicalContact.isUnsubscribed || canonicalContact.status !== 'active')
  ) {
    throw new AutomationActionError('The lead is suppressed from campaign email.', {
      code: 'CONTACT_SUPPRESSED',
      retryable: false,
    });
  }
  await checkEmailQuota(automation.userId, 1);
  const preparedRecipient = await prepareCampaignRecipient({
    campaign,
    contact: canonicalContact,
    lead,
    execution,
  });
  if (preparedRecipient.skip) {
    return {
      responseStatus: null,
      metadata: {
        provider: 'smtp',
        campaignId: String(campaign._id),
        recipientId: String(preparedRecipient.recipient._id),
        recipientCount: 0,
        deduplicated: true,
      },
    };
  }
  const rendered = renderTemplate(template.html, lead);
  const html = replaceTemplateVariables(rendered, {
    NAME: [lead.firstName, lead.lastName].filter(Boolean).join(' '),
    EMAIL: email,
    TRACKTOKEN: preparedRecipient.recipient.trackingToken,
  });
  let result;
  try {
    result = await sendWithUserSmtp({
      userId: automation.userId,
      recipients: email,
      subject: renderTemplate(campaign.subject, lead),
      html,
      fromName: campaign.fromName,
      fromEmail: campaign.fromEmail,
    });
  } catch (error) {
    await failCampaignRecipientBestEffort({
      campaignId: campaign._id,
      recipientId: preparedRecipient.recipient._id,
    });
    throw error;
  }
  const recipientRecorded = await completeCampaignRecipientBestEffort({
    campaignId: campaign._id,
    recipientId: preparedRecipient.recipient._id,
    result,
  });
  const usageRecorded = await recordEmailUsageBestEffort(automation.userId, 1);
  return {
    responseStatus: null,
    metadata: {
      provider: 'smtp',
      campaignId: String(campaign._id),
      recipientId: String(preparedRecipient.recipient._id),
      recipientCount: 1,
      accepted: Array.isArray(result?.accepted) ? result.accepted.length : undefined,
      recipientRecorded,
      usageRecorded,
    },
  };
};

const executeEmailAlert = async ({ automation, lead }) => {
  const config = automation.actionConfig || {};
  const recipients = (Array.isArray(config.recipients) ? config.recipients : [])
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean);
  if (!recipients.length || recipients.some((email) => !EMAIL_PATTERN.test(email))) {
    throw new AutomationActionError('Email alert recipients are invalid.', {
      code: 'EMAIL_ALERT_RECIPIENTS_INVALID',
      retryable: false,
    });
  }
  await checkEmailQuota(automation.userId, recipients.length);
  const result = await sendWithUserSmtp({
    userId: automation.userId,
    recipients,
    subject: renderTemplate(config.subject || '', lead),
    html: renderTemplate(config.message || '', lead),
    fromName: config.senderName || config.fromName,
    fromEmail: config.fromEmail,
  });
  const usageRecorded = await recordEmailUsageBestEffort(automation.userId, recipients.length);
  return {
    responseStatus: null,
    metadata: {
      provider: 'smtp',
      recipientCount: recipients.length,
      accepted: Array.isArray(result?.accepted) ? result.accepted.length : undefined,
      usageRecorded,
    },
  };
};

const parseIpv4 = (address) => address.split('.').map(Number);

const isBlockedIp = (address) => {
  const ip = String(address || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (net.isIP(ip) === 4) {
    const [a, b, c] = parseIpv4(ip);
    return a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && ((b === 0 && [0, 2].includes(c)) || b === 168))
      || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
      || (a === 203 && b === 0 && c === 113)
      || a >= 224;
  }
  if (net.isIP(ip) === 6) {
    if (ip === '::' || ip === '::1') return true;
    if (ip.startsWith('::ffff:')) return isBlockedIp(ip.slice(7));
    return ip.startsWith('fc')
      || ip.startsWith('fd')
      || /^f[ef][89ab]/.test(ip)
      || ip.startsWith('ff')
      || ip.startsWith('2001:db8:');
  }
  return true;
};

const privateWebhooksAllowed = () => (
  process.env.NODE_ENV !== 'production'
  && process.env.AUTOMATION_ALLOW_PRIVATE_WEBHOOKS === 'true'
);

const resolveSafeWebhookTarget = async (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new AutomationActionError('The webhook URL is invalid.', {
      code: 'WEBHOOK_URL_INVALID',
      retryable: false,
    });
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new AutomationActionError('The webhook URL is invalid.', {
      code: 'WEBHOOK_URL_INVALID',
      retryable: false,
    });
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const allowPrivate = privateWebhooksAllowed();
  if (!allowPrivate && ((!hostname.includes('.') && !net.isIP(hostname)) || hostname === 'localhost' || /\.(localhost|local|internal)$/.test(hostname))) {
    throw new AutomationActionError('The webhook destination is not allowed.', {
      code: 'WEBHOOK_DESTINATION_BLOCKED',
      retryable: false,
    });
  }

  let addresses;
  try {
    addresses = net.isIP(hostname)
      ? [{ address: hostname }]
      : await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new AutomationActionError('The webhook destination could not be resolved.', {
      code: 'WEBHOOK_DNS_FAILED',
      retryable: true,
    });
  }
  if (!addresses.length || (!allowPrivate && addresses.some(({ address }) => isBlockedIp(address)))) {
    throw new AutomationActionError('The webhook destination is not allowed.', {
      code: 'WEBHOOK_DESTINATION_BLOCKED',
      retryable: false,
    });
  }
  return {
    url,
    addresses: addresses.map(({ address, family }) => ({
      address,
      family: Number(family) || net.isIP(address),
    })),
  };
};

const assertSafeWebhookUrl = async (value) => (await resolveSafeWebhookTarget(value)).url;

const readLimitedResponse = async (response, limit) => {
  const declared = Number(response.headers['content-length']);
  if (Number.isFinite(declared) && declared > limit) {
    response.destroy();
    throw new AutomationActionError('The webhook response was too large.', {
      code: 'WEBHOOK_RESPONSE_TOO_LARGE',
      responseStatus: response.statusCode,
      retryable: false,
    });
  }

  let size = 0;
  for await (const chunk of response) {
    size += chunk.length;
    if (size > limit) {
      response.destroy();
      throw new AutomationActionError('The webhook response was too large.', {
        code: 'WEBHOOK_RESPONSE_TOO_LARGE',
        responseStatus: response.statusCode,
        retryable: false,
      });
    }
  }
  return size;
};

const requestWebhook = ({ url, addresses }, options, timeoutMs, maxResponseBytes) => new Promise((resolve, reject) => {
  const transport = url.protocol === 'https:' ? https : http;
  const lookup = (_hostname, lookupOptions, callback) => {
    const normalizedOptions = typeof lookupOptions === 'number'
      ? { family: lookupOptions }
      : (lookupOptions || {});
    const requestedFamily = Number(normalizedOptions.family) || 0;
    const candidates = requestedFamily
      ? addresses.filter((entry) => entry.family === requestedFamily)
      : addresses;
    const selected = candidates[0] || addresses[0];
    if (!selected) return callback(Object.assign(new Error('No approved address'), { code: 'ENOTFOUND' }));
    if (normalizedOptions.all) return callback(null, candidates.length ? candidates : [selected]);
    return callback(null, selected.address, selected.family);
  };

  let settled = false;
  let deadlineTimer;
  const settle = (callback, value) => {
    if (settled) return;
    settled = true;
    if (deadlineTimer) clearTimeout(deadlineTimer);
    callback(value);
  };
  const request = transport.request(url, {
    method: options.method,
    headers: options.headers,
    lookup,
  }, async (response) => {
    try {
      const responseBytes = await readLimitedResponse(response, maxResponseBytes);
      settle(resolve, {
        status: response.statusCode || 0,
        headers: response.headers,
        responseBytes,
      });
    } catch (error) {
      settle(reject, error);
    }
  });
  request.setTimeout(timeoutMs, () => {
    const timeoutError = new Error('Webhook request timeout');
    timeoutError.code = 'ETIMEDOUT';
    request.destroy(timeoutError);
  });
  deadlineTimer = setTimeout(() => {
    const timeoutError = new Error('Webhook absolute deadline exceeded');
    timeoutError.code = 'ETIMEDOUT';
    request.destroy(timeoutError);
  }, timeoutMs);
  request.on('error', (error) => settle(reject, error));
  if (options.body !== undefined) request.write(options.body);
  request.end();
});

const executeWebhook = async ({ automation, lead, execution }) => {
  const config = automation.actionConfig || {};
  assertSecureWebhookConfig(config);
  const target = await resolveSafeWebhookTarget(config.url);
  const { url } = target;
  const method = String(config.method || 'POST').toUpperCase();
  if (!ALLOWED_WEBHOOK_METHODS.has(method)) {
    throw new AutomationActionError('The webhook method is invalid.', {
      code: 'WEBHOOK_METHOD_INVALID',
      retryable: false,
    });
  }

  const configuredHeaders = resolveWebhookHeaders(config, automation);
  const headers = Object.create(null);
  for (const [key, value] of Object.entries(configuredHeaders)) {
    if (!FORBIDDEN_WEBHOOK_HEADER_NAMES.has(key.toLowerCase())) headers[key] = value;
  }
  if (
    execution?._id
    && !Object.keys(headers).some((key) => key.toLowerCase() === 'idempotency-key')
  ) {
    headers['Idempotency-Key'] = `automation-execution-${execution._id}`;
  }

  const options = { method, headers };
  if (method !== 'GET') {
    options.body = JSON.stringify(renderJson(config.body || {}, lead));
    const maxRequestBytes = Math.max(
      1024,
      Math.min(Number(process.env.AUTOMATION_WEBHOOK_MAX_REQUEST_BYTES) || 262144, 1048576)
    );
    if (Buffer.byteLength(options.body, 'utf8') > maxRequestBytes) {
      throw new AutomationActionError('The webhook request body is too large.', {
        code: 'WEBHOOK_REQUEST_TOO_LARGE',
        retryable: false,
      });
    }
    if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const configuredTimeout = Number(process.env.AUTOMATION_WEBHOOK_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.max(1000, Math.min(configuredTimeout, 30000))
    : 10000;
  let response;
  try {
    const maxResponseBytes = Math.max(
      1024,
      Math.min(Number(process.env.AUTOMATION_WEBHOOK_MAX_RESPONSE_BYTES) || 65536, 262144)
    );
    response = await requestWebhook(target, options, timeoutMs, maxResponseBytes);
  } catch (error) {
    if (error instanceof AutomationActionError) throw error;
    const timedOut = error?.code === 'ETIMEDOUT';
    throw new AutomationActionError(
      timedOut ? 'The webhook request timed out.' : 'The webhook request could not be completed.',
      {
        code: timedOut ? 'WEBHOOK_TIMEOUT' : 'WEBHOOK_NETWORK_ERROR',
        retryable: true,
        metadata: { provider: 'webhook', method, host: url.hostname },
      }
    );
  }
  const metadata = {
    provider: 'webhook',
    method,
    host: url.hostname,
    responseBytes: response.responseBytes,
    redirected: response.status >= 300 && response.status < 400,
  };
  if (response.status < 200 || response.status >= 300) {
    const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
    throw new AutomationActionError(`Webhook returned HTTP ${response.status}.`, {
      code: 'WEBHOOK_HTTP_ERROR',
      responseStatus: response.status,
      retryable,
      metadata,
    });
  }
  return { responseStatus: response.status, metadata };
};

const executeUnavailable = (actionType) => {
  throw new AutomationActionError('This integration is not available in the current project.', {
    code: 'INTEGRATION_UNAVAILABLE',
    retryable: false,
    metadata: { actionType },
  });
};

const executeAction = async ({ automation, lead, execution }) => {
  if (UNAVAILABLE_ACTIONS.has(automation.actionType)) return executeUnavailable(automation.actionType);
  if (automation.actionType === AUTOMATION_ACTION.SEND_EMAIL_CAMPAIGN) {
    return executeEmailCampaign({ automation, lead, execution });
  }
  if (automation.actionType === AUTOMATION_ACTION.SEND_EMAIL_ALERT) {
    return executeEmailAlert({ automation, lead });
  }
  if (automation.actionType === AUTOMATION_ACTION.TRIGGER_WEBHOOK) {
    return executeWebhook({ automation, lead, execution });
  }
  throw new AutomationActionError('The automation action is not supported.', {
    code: 'ACTION_NOT_SUPPORTED',
    retryable: false,
  });
};

module.exports = {
  AutomationActionError,
  safeErrorSummary,
  sanitizeMetadata,
  resolveSafeWebhookTarget,
  assertSafeWebhookUrl,
  executeEmailCampaign,
  executeEmailAlert,
  executeWebhook,
  executeAction,
};
