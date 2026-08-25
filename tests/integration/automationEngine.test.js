process.env.NODE_ENV = 'test';
process.env.AUTOMATION_ALLOW_PRIVATE_WEBHOOKS = 'true';
process.env.AUTOMATION_ENCRYPTION_KEY = 'automation-test-encryption-key';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const net = require('net');
const dnsPromises = require('dns').promises;
const mongoose = require('mongoose');
const request = require('supertest');
const { connectTestDb, disconnectTestDb, clearCollections } = require('../helpers/setupDb');
const createApp = require('../../app');
const Automation = require('../../models/automation.model');
const AutomationExecution = require('../../models/automationExecution.model');
const Lead = require('../../models/lead.model');
const FormPopup = require('../../models/formPopup.model');
const Settings = require('../../models/settings.model');
const Template = require('../../models/template.model');
const Campaign = require('../../models/campaign.model');
const CampaignRecipient = require('../../models/campaignRecipient.model');
const Contact = require('../../models/contacts.model');
const AutomationEngineService = require('../../services/automationEngine.services');
const AutomationDispatchService = require('../../services/automationDispatch.services');
const {
  prepareAutomationWrite,
  resolveWebhookHeaders,
  serializeAutomationConfig,
  MASKED_SECRET,
} = require('../../services/automationConfig.services');
const {
  renderJson,
  renderTemplate,
  evaluateConditions,
} = require('../../utils/automationTemplate.utils');
const {
  assertSafeWebhookUrl,
  executeWebhook,
  executeEmailAlert,
  executeEmailCampaign,
} = require('../../services/automationAction.services');
const EntitlementService = require('../../services/entitlement.services');
const QuotaExceededError = require('../../helpers/quotaError');
const { encryptSecrets } = require('../../utils/automationSecrets.utils');
const { automationCreateValidation } = require('../../validations/automation.validations');
const {
  AUTOMATION_ACTION,
  AUTOMATION_TRIGGER_MODE,
} = require('../../constants/automation.constants');

let webhookServer;
let webhookUrl;
let webhookRequests;
let webhookStatus;
let smtpServer;
let smtpPort;
let smtpMessages;

const createSmtpServer = () => net.createServer((socket) => {
  let buffer = '';
  let message = '';
  let readingMessage = false;
  socket.setEncoding('utf8');
  socket.write('220 localhost ESMTP\r\n');
  socket.on('data', (chunk) => {
    buffer += chunk;
    while (true) {
      if (readingMessage) {
        const end = buffer.indexOf('\r\n.\r\n');
        if (end === -1) {
          if (buffer.length > 4) {
            message += buffer.slice(0, -4);
            buffer = buffer.slice(-4);
          }
          return;
        }
        message += buffer.slice(0, end);
        buffer = buffer.slice(end + 5);
        smtpMessages.push(message);
        message = '';
        readingMessage = false;
        socket.write('250 2.0.0 queued\r\n');
        continue;
      }
      const lineEnd = buffer.indexOf('\r\n');
      if (lineEnd === -1) return;
      const line = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 2);
      if (/^(EHLO|HELO)/i.test(line)) socket.write('250-localhost\r\n250-8BITMIME\r\n250 SMTPUTF8\r\n');
      else if (/^DATA/i.test(line)) {
        readingMessage = true;
        socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
      } else if (/^QUIT/i.test(line)) {
        socket.end('221 2.0.0 bye\r\n');
      } else socket.write('250 2.0.0 ok\r\n');
    }
  });
});

test.before(async () => {
  await connectTestDb();
  await AutomationExecution.syncIndexes();
  webhookRequests = [];
  webhookStatus = 200;
  webhookServer = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      webhookRequests.push({
        method: req.method,
        headers: req.headers,
        body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null,
      });
      res.statusCode = webhookStatus;
      res.end('ok');
    });
  });
  await new Promise((resolve) => webhookServer.listen(0, '127.0.0.1', resolve));
  webhookUrl = `http://127.0.0.1:${webhookServer.address().port}/lead`;
  smtpMessages = [];
  smtpServer = createSmtpServer();
  await new Promise((resolve) => smtpServer.listen(0, '127.0.0.1', resolve));
  smtpPort = smtpServer.address().port;
});

test.afterEach(async () => {
  webhookRequests.length = 0;
  smtpMessages.length = 0;
  webhookStatus = 200;
  await clearCollections();
});

test.after(async () => {
  await new Promise((resolve) => webhookServer.close(resolve));
  await new Promise((resolve) => smtpServer.close(resolve));
  await disconnectTestDb();
});

test('template rendering supports safe lead variables, typed JSON, custom fields, and conditions', () => {
  const lead = {
    _id: 'lead-1',
    firstName: 'Ada',
    email: 'ada@example.com',
    fields: { company: 'Analytical Engines', leadScore: 91, subscribed: true },
  };
  assert.equal(renderTemplate('Hello {{ lead.firstName }} at {{lead.company}}', lead), 'Hello Ada at Analytical Engines');
  assert.deepEqual(renderJson({ score: '{{lead.leadScore}}', text: 'Score={{lead.leadScore}}' }, lead), {
    score: 91,
    text: 'Score=91',
  });
  assert.equal(renderTemplate('{{lead.constructor.constructor}}', lead), '');
  assert.equal(renderTemplate('{{lead.userId}}', { ...lead, userId: 'private-user' }), '');
  assert.equal(evaluateConditions({
    type: 'rules',
    logic: 'AND',
    rules: [
      { field: 'company', operator: 'CONTAINS', value: 'engines' },
      { field: 'leadScore', operator: 'GREATER_THAN', value: 70 },
    ],
  }, lead), true);
});

test('webhook credentials are encrypted, masked, resolvable only server-side, and preservable', () => {
  const prepared = prepareAutomationWrite({
    actionType: AUTOMATION_ACTION.TRIGGER_WEBHOOK,
    actionConfig: {
      url: webhookUrl,
      method: 'POST',
      triggerMode: 'EVERY_TIME',
      headers: [
        { key: 'Authorization', value: 'Bearer top-secret' },
        { key: 'X-Trace', value: 'trace-1' },
      ],
      body: { event: 'new_lead' },
    },
  });

  assert.equal(prepared.actionConfig.headers[0].value, MASKED_SECRET);
  assert.equal(prepared.actionConfig.headers[0].hasValue, true);
  assert.equal(JSON.stringify(prepared.actionConfig).includes('top-secret'), false);
  assert.equal(prepared.secrets.includes('top-secret'), false);
  assert.deepEqual(resolveWebhookHeaders(prepared.actionConfig, prepared.secrets), {
    Authorization: 'Bearer top-secret',
    'X-Trace': 'trace-1',
  });
  assert.equal(JSON.stringify(serializeAutomationConfig(prepared.actionConfig, prepared.secrets)).includes('top-secret'), false);

  const preserved = prepareAutomationWrite({
    actionType: AUTOMATION_ACTION.TRIGGER_WEBHOOK,
    actionConfig: {
      ...prepared.actionConfig,
      headers: [{ key: 'Authorization', value: MASKED_SECRET, sensitive: true, hasValue: true }],
    },
  }, { existingSecrets: prepared.secrets });
  assert.equal(resolveWebhookHeaders(preserved.actionConfig, preserved.secrets).Authorization, 'Bearer top-secret');
  assert.throws(() => prepareAutomationWrite({
    actionType: AUTOMATION_ACTION.TRIGGER_WEBHOOK,
    actionConfig: { headers: [{ key: '__proto__', value: 'unsafe' }] },
  }), /header (?:name is invalid|is not allowed)/i);
  assert.throws(
    () => prepareAutomationWrite({
      actionType: AUTOMATION_ACTION.TRIGGER_WEBHOOK,
      actionConfig: {
        url: webhookUrl,
        method: 'POST',
        triggerMode: 'EVERY_TIME',
        headers: [{ key: 'Host', value: 'attacker.example' }],
        body: {},
      },
    }),
    (error) => error.code === 'FORBIDDEN_WEBHOOK_HEADER'
  );

  const unsafeUrlConfig = {
    url: 'https://example.com/hook?access_token=plaintext',
    method: 'POST',
    triggerMode: 'EVERY_TIME',
    headers: [],
    body: { event: 'new_lead' },
  };
  assert.throws(
    () => prepareAutomationWrite({
      actionType: AUTOMATION_ACTION.TRIGGER_WEBHOOK,
      actionConfig: unsafeUrlConfig,
    }),
    (error) => error.code === 'WEBHOOK_SECRET_IN_URL'
  );
  assert.throws(
    () => prepareAutomationWrite({
      actionType: AUTOMATION_ACTION.TRIGGER_WEBHOOK,
      actionConfig: {
        ...unsafeUrlConfig,
        url: 'https://example.com/hook',
        body: { payload: { apiKey: 'plaintext' } },
      },
    }),
    (error) => error.code === 'WEBHOOK_SECRET_IN_BODY'
  );
  const validation = automationCreateValidation({
    name: 'Unsafe webhook',
    status: 'ACTIVE',
    triggerType: 'NEW_LEAD',
    conditions: { type: 'all', logic: 'AND', rules: [] },
    actionType: AUTOMATION_ACTION.TRIGGER_WEBHOOK,
    actionConfig: unsafeUrlConfig,
  });
  assert.equal(validation.isValid, false);
  assert.match(validation.errors['actionConfig.url'], /sensitive headers/i);
  const bodyValidation = automationCreateValidation({
    name: 'Unsafe webhook body',
    status: 'ACTIVE',
    triggerType: 'NEW_LEAD',
    conditions: { type: 'all', logic: 'AND', rules: [] },
    actionType: AUTOMATION_ACTION.TRIGGER_WEBHOOK,
    actionConfig: {
      ...unsafeUrlConfig,
      url: 'https://example.com/hook',
      body: { nested: { clientSecret: 'plaintext' } },
    },
  });
  assert.equal(bodyValidation.isValid, false);
  assert.match(bodyValidation.errors['actionConfig.body'], /sensitive headers/i);
  const forbiddenHeaderValidation = automationCreateValidation({
    name: 'Forbidden header',
    status: 'ACTIVE',
    triggerType: 'NEW_LEAD',
    conditions: { type: 'all', logic: 'AND', rules: [] },
    actionType: AUTOMATION_ACTION.TRIGGER_WEBHOOK,
    actionConfig: {
      url: 'https://example.com/hook',
      method: 'POST',
      triggerMode: 'EVERY_TIME',
      headers: [{ key: 'Content-Length', value: '1' }],
      body: {},
    },
  });
  assert.equal(forbiddenHeaderValidation.isValid, false);
  assert.match(forbiddenHeaderValidation.errors['actionConfig.headers.0.key'], /not allowed/i);
  const publicLegacyConfig = serializeAutomationConfig(unsafeUrlConfig);
  assert.equal(publicLegacyConfig.url.includes('plaintext'), false);
});

test('production secret storage fails closed without a configured key and private webhook overrides are ignored', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousKey = process.env.AUTOMATION_ENCRYPTION_KEY;
  const previousPrivateOverride = process.env.AUTOMATION_ALLOW_PRIVATE_WEBHOOKS;
  process.env.NODE_ENV = 'production';
  delete process.env.AUTOMATION_ENCRYPTION_KEY;
  process.env.AUTOMATION_ALLOW_PRIVATE_WEBHOOKS = 'true';
  try {
    assert.throws(
      () => encryptSecrets({ token: 'secret' }),
      (error) => error.code === 'AUTOMATION_ENCRYPTION_KEY_REQUIRED'
    );
    await assert.rejects(
      assertSafeWebhookUrl('http://127.0.0.1/hook'),
      (error) => error.code === 'WEBHOOK_DESTINATION_BLOCKED'
    );
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousKey === undefined) delete process.env.AUTOMATION_ENCRYPTION_KEY;
    else process.env.AUTOMATION_ENCRYPTION_KEY = previousKey;
    if (previousPrivateOverride === undefined) delete process.env.AUTOMATION_ALLOW_PRIVATE_WEBHOOKS;
    else process.env.AUTOMATION_ALLOW_PRIVATE_WEBHOOKS = previousPrivateOverride;
  }
});

test('webhook transport pins the validated DNS result and does not re-resolve at connect time', async () => {
  const originalLookup = dnsPromises.lookup;
  let lookupCount = 0;
  dnsPromises.lookup = async (hostname, options) => {
    if (hostname !== 'webhook.test') return originalLookup(hostname, options);
    lookupCount += 1;
    return [{ address: '127.0.0.1', family: 4 }];
  };
  const prepared = prepareAutomationWrite({
    actionType: AUTOMATION_ACTION.TRIGGER_WEBHOOK,
    actionConfig: {
      url: webhookUrl.replace('127.0.0.1', 'webhook.test'),
      method: 'POST',
      triggerMode: 'EVERY_TIME',
      headers: [{ key: 'Idempotency-Key', value: 'caller-supplied-key' }],
      body: { email: '{{lead.email}}' },
    },
  });
  try {
    const result = await executeWebhook({
      automation: {
        actionConfig: prepared.actionConfig,
        secrets: prepared.secrets,
      },
      lead: { email: 'pin@example.com' },
      execution: { _id: 'must-not-replace-caller-key' },
    });
    assert.equal(result.responseStatus, 200);
    assert.equal(lookupCount, 1);
    assert.equal(webhookRequests.length, 1);
    assert.equal(webhookRequests[0].headers['idempotency-key'], 'caller-supplied-key');
  } finally {
    dnsPromises.lookup = originalLookup;
  }
});

test('webhook absolute deadline stops slow-drip responses', async () => {
  const slowServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    const interval = setInterval(() => res.write('.'), 100);
    res.on('close', () => clearInterval(interval));
  });
  await new Promise((resolve) => slowServer.listen(0, '127.0.0.1', resolve));
  const previousTimeout = process.env.AUTOMATION_WEBHOOK_TIMEOUT_MS;
  process.env.AUTOMATION_WEBHOOK_TIMEOUT_MS = '1000';
  try {
    const prepared = prepareAutomationWrite({
      actionType: AUTOMATION_ACTION.TRIGGER_WEBHOOK,
      actionConfig: {
        url: `http://127.0.0.1:${slowServer.address().port}/slow`,
        method: 'POST',
        triggerMode: 'EVERY_TIME',
        headers: [],
        body: { event: 'slow' },
      },
    });
    await assert.rejects(
      executeWebhook({
        automation: { actionConfig: prepared.actionConfig, secrets: prepared.secrets },
        lead: {},
      }),
      (error) => error.code === 'WEBHOOK_TIMEOUT'
    );
  } finally {
    if (previousTimeout === undefined) delete process.env.AUTOMATION_WEBHOOK_TIMEOUT_MS;
    else process.env.AUTOMATION_WEBHOOK_TIMEOUT_MS = previousTimeout;
    await new Promise((resolve) => slowServer.close(resolve));
  }
});

test('email alert and single-lead campaign actions reuse the user SMTP account', async () => {
  const userId = new mongoose.Types.ObjectId();
  await Settings.create({
    user: userId,
    smtp: {
      host: '127.0.0.1',
      port: smtpPort,
      username: 'smtp-user',
      password: 'smtp-password',
      encryption: 'None',
      authentication: false,
    },
    email: { senderName: 'Automation', senderEmail: 'sender@example.com' },
  });
  const originalCheck = EntitlementService.checkEmailSendQuota;
  const originalRecord = EntitlementService.recordEmailSends;
  EntitlementService.checkEmailSendQuota = async () => true;
  EntitlementService.recordEmailSends = async () => true;
  try {
    await executeEmailAlert({
      automation: {
        userId,
        actionConfig: {
          recipients: ['ops@example.com'],
          subject: 'New lead {{lead.firstName}}',
          message: '<p>{{lead.email}}</p>',
          senderName: 'Lead Bot',
        },
      },
      lead: { firstName: 'Ada', email: 'ada@example.com' },
    });

    const template = await Template.create({
      userId,
      title: 'Welcome',
      html: '<p>Hello {{lead.firstName}} / [[EMAIL]] / [[TRACKTOKEN]]</p>',
      editorType: 'ckeditor',
    });
    const campaign = await Campaign.create({
      userId,
      name: 'Welcome campaign',
      subject: 'Welcome {{lead.firstName}}',
      fromName: 'Campaign Bot',
      fromEmail: 'sender@example.com',
      templateId: template._id,
    });
    const graceContact = await Contact.create({
      userId,
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      status: 'active',
      isUnsubscribed: false,
    });
    const campaignExecutionId = new mongoose.Types.ObjectId();
    await executeEmailCampaign({
      automation: { userId, actionConfig: { campaignId: campaign._id } },
      lead: { firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' },
      execution: { _id: campaignExecutionId },
    });

    assert.equal(smtpMessages.length, 2);
    assert.match(smtpMessages[0], /New lead Ada/);
    assert.match(smtpMessages[0], /ada@example\.com/);
    assert.match(smtpMessages[1], /Welcome Grace/);
    assert.match(smtpMessages[1], /grace@example\.com/);
    const recipient = await CampaignRecipient.findOne({
      campaignId: campaign._id,
      contactId: graceContact._id,
    }).lean();
    assert.equal(recipient.status, 'sent');
    assert.equal(String(recipient.automationExecutionId), String(campaignExecutionId));
    assert.equal(recipient.trackingToken.length, 64);
    assert.match(smtpMessages[1], new RegExp(recipient.trackingToken));
    const trackedCampaign = await Campaign.findById(campaign._id).lean();
    assert.equal(trackedCampaign.stats.total, 1);
    assert.equal(trackedCampaign.stats.pending, 0);
    assert.equal(trackedCampaign.stats.sent, 1);

    EntitlementService.recordEmailSends = async () => {
      throw new Error('usage counter unavailable');
    };
    const usageFailureResult = await executeEmailAlert({
      automation: {
        userId,
        actionConfig: {
          recipients: ['accounting@example.com'],
          subject: 'Accounting failure isolation',
          message: '<p>Still send once</p>',
        },
      },
      lead: { email: 'grace@example.com' },
    });
    assert.equal(usageFailureResult.metadata.usageRecorded, false);
    assert.equal(smtpMessages.length, 3);
    EntitlementService.recordEmailSends = async () => true;

    await Contact.create({
      userId,
      email: 'blocked@example.com',
      status: 'unsubscribed',
      isUnsubscribed: true,
    });
    await assert.rejects(
      executeEmailCampaign({
        automation: { userId, actionConfig: { campaignId: campaign._id } },
        lead: { email: 'blocked@example.com' },
      }),
      (error) => error.code === 'CONTACT_SUPPRESSED' && error.retryable === false
    );
    campaign.status = 'scheduled';
    campaign.scheduledAt = new Date(Date.now() + 3600000);
    await campaign.save();
    await assert.rejects(
      executeEmailCampaign({
        automation: { userId, actionConfig: { campaignId: campaign._id } },
        lead: { email: 'another@example.com' },
      }),
      (error) => error.code === 'EMAIL_CAMPAIGN_NOT_SENDABLE' && error.retryable === false
    );
    assert.equal(smtpMessages.length, 3);
  } finally {
    EntitlementService.checkEmailSendQuota = originalCheck;
    EntitlementService.recordEmailSends = originalRecord;
  }
});

test('deterministic email quota failures are non-retryable and safely normalized', async () => {
  const originalCheck = EntitlementService.checkEmailSendQuota;
  EntitlementService.checkEmailSendQuota = async () => {
    throw new QuotaExceededError('internal plan details', { token: 'must-not-leak' });
  };
  try {
    await assert.rejects(
      executeEmailAlert({
        automation: {
          userId: new mongoose.Types.ObjectId(),
          actionConfig: {
            recipients: ['ops@example.com'],
            subject: 'Alert',
            message: 'Message',
          },
        },
        lead: { email: 'lead@example.com' },
      }),
      (error) => (
        error.code === 'QUOTA_EXCEEDED'
        && error.retryable === false
        && error.message === 'The email sending quota has been reached.'
        && !JSON.stringify(error).includes('must-not-leak')
      )
    );

    const userId = new mongoose.Types.ObjectId();
    const lead = await Lead.create({
      userId,
      email: 'lead@example.com',
      source: 'form-popup',
    });
    const automation = await Automation.create({
      userId,
      createdBy: userId,
      name: 'Quota alert',
      status: 'ACTIVE',
      triggerType: 'NEW_LEAD',
      conditions: { type: 'all', logic: 'AND', rules: [] },
      actionType: AUTOMATION_ACTION.SEND_EMAIL_ALERT,
      actionConfig: {
        recipients: ['ops@example.com'],
        subject: 'Alert',
        message: 'Message',
      },
    });
    const { execution } = await AutomationEngineService.reserveExecution({
      automation,
      lead,
      dispatchKey: 'quota-dispatch',
    });
    await assert.rejects(
      AutomationEngineService.executeReservedExecution(execution._id, { attempt: 1 }),
      (error) => error.code === 'QUOTA_EXCEEDED' && error.retryable === false
    );
    const failedExecution = await AutomationExecution.findById(execution._id).lean();
    assert.equal(failedExecution.status, 'FAILED');
    assert.equal(failedExecution.errorMessage, 'The email sending quota has been reached.');
  } finally {
    EntitlementService.checkEmailSendQuota = originalCheck;
  }
});

const createWebhookAutomation = async ({ triggerMode = AUTOMATION_TRIGGER_MODE.FIRST_TIME } = {}) => {
  const userId = new mongoose.Types.ObjectId();
  const lead = await Lead.create({
    userId,
    firstName: 'Grace',
    lastName: 'Hopper',
    email: 'grace@example.com',
    phone: '555-0100',
    source: 'form-popup',
    fields: { company: 'Navy', leadScore: 95 },
  });
  const prepared = prepareAutomationWrite({
    actionType: AUTOMATION_ACTION.TRIGGER_WEBHOOK,
    actionConfig: {
      url: webhookUrl,
      method: 'POST',
      triggerMode,
      headers: [{ key: 'Authorization', value: 'Bearer webhook-secret' }],
      body: {
        id: '{{lead.id}}',
        email: '{{lead.email}}',
        score: '{{lead.leadScore}}',
      },
    },
  });
  const automation = await Automation.create({
    userId,
    createdBy: userId,
    name: `Webhook ${triggerMode}`,
    status: 'ACTIVE',
    triggerType: 'NEW_LEAD',
    conditions: { type: 'all', logic: 'AND', rules: [] },
    actionType: AUTOMATION_ACTION.TRIGGER_WEBHOOK,
    actionConfig: prepared.actionConfig,
    secrets: prepared.secrets,
  });
  return { userId, lead, automation };
};

test('FIRST_TIME reservation is atomic and executes a lead only once', async () => {
  const { userId, lead, automation } = await createWebhookAutomation();
  await Promise.all(Array.from({ length: 5 }, (_value, index) => (
    AutomationEngineService.reserveExecution({
      automation,
      lead,
      dispatchKey: `concurrent-${index}`,
    })
  )));
  assert.equal(await AutomationExecution.countDocuments({ automationId: automation._id }), 1);

  await AutomationExecution.deleteMany({ automationId: automation._id });
  const first = await AutomationEngineService.processLead({
    userId,
    leadId: lead._id,
    dispatchId: 'first-dispatch',
  }, { inline: true });
  const second = await AutomationEngineService.processLead({
    userId,
    leadId: lead._id,
    dispatchId: 'second-dispatch',
  }, { inline: true });

  assert.equal(first.queued, 1);
  assert.equal(second.skipped, 1);
  assert.equal(webhookRequests.length, 1);
  assert.equal(webhookRequests[0].headers.authorization, 'Bearer webhook-secret');
  assert.equal(webhookRequests[0].body.email, 'grace@example.com');
  assert.equal(webhookRequests[0].body.score, 95);
  const execution = await AutomationExecution.findOne({ automationId: automation._id }).lean();
  assert.equal(
    webhookRequests[0].headers['idempotency-key'],
    `automation-execution-${execution._id}`
  );
  assert.equal(execution.status, 'SUCCESS');
  assert.equal(execution.responseStatus, 200);
  assert.equal(JSON.stringify(execution).includes('webhook-secret'), false);
});

test('EVERY_TIME creates a new execution for each dispatch', async () => {
  const { userId, lead, automation } = await createWebhookAutomation({
    triggerMode: AUTOMATION_TRIGGER_MODE.EVERY_TIME,
  });
  await AutomationEngineService.processLead({ userId, leadId: lead._id, dispatchId: 'every-1' }, { inline: true });
  await AutomationEngineService.processLead({ userId, leadId: lead._id, dispatchId: 'every-2' }, { inline: true });
  assert.equal(await AutomationExecution.countDocuments({ automationId: automation._id }), 2);
  assert.equal(webhookRequests.length, 2);
});

test('EVERY_TIME same-dispatch reservation is atomic under concurrency', async () => {
  const { lead, automation } = await createWebhookAutomation({
    triggerMode: AUTOMATION_TRIGGER_MODE.EVERY_TIME,
  });
  const reservations = await Promise.all(Array.from({ length: 8 }, () => (
    AutomationEngineService.reserveExecution({
      automation,
      lead,
      dispatchKey: 'same-every-dispatch',
    })
  )));
  const executionIds = new Set(reservations.map(({ execution }) => String(execution._id)));
  assert.equal(executionIds.size, 1);
  assert.equal(await AutomationExecution.countDocuments({ automationId: automation._id }), 1);
});

test('enqueue failure records FAILED and the same dispatch can recover without a duplicate execution', async () => {
  const { userId, lead, automation } = await createWebhookAutomation({
    triggerMode: AUTOMATION_TRIGGER_MODE.EVERY_TIME,
  });
  const originalDispatch = AutomationDispatchService.dispatchExecution;
  AutomationDispatchService.dispatchExecution = async () => {
    const error = new Error('redis details must not be stored');
    error.code = 'ECONNREFUSED';
    throw error;
  };
  try {
    await assert.rejects(
      AutomationEngineService.processLead({
        userId,
        leadId: lead._id,
        dispatchId: 'recoverable-dispatch',
      }, { inline: false }),
      /could not be dispatched/
    );
  } finally {
    AutomationDispatchService.dispatchExecution = originalDispatch;
  }

  let execution = await AutomationExecution.findOne({ automationId: automation._id }).lean();
  assert.equal(execution.status, 'FAILED');
  assert.equal(execution.errorMessage, 'Automation background processing failed.');
  assert.equal(execution.metadata.enqueueErrorCode, 'ECONNREFUSED');
  assert.equal(JSON.stringify(execution).includes('redis details'), false);

  await AutomationEngineService.processLead({
    userId,
    leadId: lead._id,
    dispatchId: 'recoverable-dispatch',
  }, { inline: true });
  execution = await AutomationExecution.findOne({ automationId: automation._id }).lean();
  assert.equal(execution.status, 'SUCCESS');
  assert.equal(execution.metadata.enqueueErrorCode, undefined);
  assert.equal(await AutomationExecution.countDocuments({ automationId: automation._id }), 1);
  assert.equal(webhookRequests.length, 1);
});

test('FIRST_TIME enqueue failure can be reclaimed by a later dispatch', async () => {
  const { userId, lead, automation } = await createWebhookAutomation();
  const originalDispatch = AutomationDispatchService.dispatchExecution;
  AutomationDispatchService.dispatchExecution = async () => {
    const error = new Error('queue unavailable');
    error.code = 'ECONNRESET';
    throw error;
  };
  try {
    await assert.rejects(
      AutomationEngineService.processLead({
        userId,
        leadId: lead._id,
        dispatchId: 'first-unavailable-dispatch',
      }, { inline: false }),
      /could not be dispatched/
    );
  } finally {
    AutomationDispatchService.dispatchExecution = originalDispatch;
  }

  await AutomationEngineService.processLead({
    userId,
    leadId: lead._id,
    dispatchId: 'later-recovery-dispatch',
  }, { inline: true });
  const execution = await AutomationExecution.findOne({ automationId: automation._id }).lean();
  assert.equal(execution.status, 'SUCCESS');
  assert.equal(execution.dispatchKey, 'later-recovery-dispatch');
  assert.equal(await AutomationExecution.countDocuments({ automationId: automation._id }), 1);
  assert.equal(webhookRequests.length, 1);
});

test('reserved executions use the action and encrypted configuration snapshot', async () => {
  const { lead, automation } = await createWebhookAutomation({
    triggerMode: AUTOMATION_TRIGGER_MODE.EVERY_TIME,
  });
  const { execution } = await AutomationEngineService.reserveExecution({
    automation,
    lead,
    dispatchKey: 'snapshot-dispatch',
  });
  await Automation.updateOne(
    { _id: automation._id },
    {
      $set: {
        actionType: AUTOMATION_ACTION.SEND_TO_SLACK,
        actionConfig: { channel: 'changed-after-reservation' },
        secrets: null,
      },
    }
  );

  await AutomationEngineService.executeReservedExecution(execution._id, { attempt: 1 });
  assert.equal(webhookRequests.length, 1);
  assert.equal(webhookRequests[0].headers.authorization, 'Bearer webhook-secret');
  const storedExecution = await AutomationExecution.findById(execution._id).lean();
  assert.equal(storedExecution.status, 'SUCCESS');
  assert.equal(storedExecution.actionType, AUTOMATION_ACTION.TRIGGER_WEBHOOK);
  assert.equal(storedExecution.actionConfigSnapshot, undefined);
  assert.equal(storedExecution.secretsSnapshot, undefined);
});

test('a completed external action is never retried because success persistence failed', async () => {
  const { lead, automation } = await createWebhookAutomation({
    triggerMode: AUTOMATION_TRIGGER_MODE.EVERY_TIME,
  });
  const { execution } = await AutomationEngineService.reserveExecution({
    automation,
    lead,
    dispatchKey: 'post-action-write-failure',
  });
  const originalUpdate = AutomationExecution.updateOne;
  AutomationExecution.updateOne = async () => {
    throw new Error('database unavailable after external commit');
  };
  try {
    await assert.rejects(
      AutomationEngineService.executeReservedExecution(execution._id, { attempt: 1 }),
      (error) => error.code === 'ACTION_COMPLETED_BOOKKEEPING_FAILED' && error.retryable === false
    );
  } finally {
    AutomationExecution.updateOne = originalUpdate;
  }
  assert.equal(webhookRequests.length, 1);
});

test('last-run bookkeeping is monotonic across out-of-order completion updates', async () => {
  const { automation } = await createWebhookAutomation({
    triggerMode: AUTOMATION_TRIGGER_MODE.EVERY_TIME,
  });
  const newer = new Date('2026-08-25T10:00:02.000Z');
  const older = new Date('2026-08-25T10:00:01.000Z');
  await AutomationEngineService.updateAutomationRun(automation._id, 'SUCCESS', newer);
  await AutomationEngineService.updateAutomationRun(automation._id, 'FAILED', older);
  const updated = await Automation.findById(automation._id).lean();
  assert.equal(updated.lastRunAt.toISOString(), newer.toISOString());
  assert.equal(updated.lastExecutionStatus, 'SUCCESS');
});

test('failed webhook execution records only a safe error and response status', async () => {
  webhookStatus = 500;
  const { userId, lead, automation } = await createWebhookAutomation({
    triggerMode: AUTOMATION_TRIGGER_MODE.EVERY_TIME,
  });
  await assert.rejects(
    AutomationEngineService.processLead({ userId, leadId: lead._id, dispatchId: 'failure-1' }, { inline: true }),
    /could not be dispatched/
  );
  const execution = await AutomationExecution.findOne({ automationId: automation._id }).lean();
  assert.equal(execution.status, 'FAILED');
  assert.equal(execution.responseStatus, 500);
  assert.equal(execution.errorMessage, 'Webhook returned HTTP 500.');
  assert.equal(JSON.stringify(execution).includes('webhook-secret'), false);
});

test('automation dispatch failure never fails public lead creation', async () => {
  const userId = new mongoose.Types.ObjectId();
  const popup = await FormPopup.create({
    userId,
    name: 'Lead popup',
    html: '<form></form>',
    status: 'published',
  });
  const originalDispatch = AutomationDispatchService.dispatchLead;
  let resolveContactInspection;
  const contactInspected = new Promise((resolve) => { resolveContactInspection = resolve; });
  AutomationDispatchService.dispatchLead = async () => {
    const contactExists = !!(await Contact.exists({ userId, email: 'safe@example.com' }));
    resolveContactInspection(contactExists);
    const error = new Error('redis://credential@internal-host unavailable');
    error.code = 'ECONNREFUSED';
    throw error;
  };
  try {
    const response = await request(createApp())
      .post('/api/public/lead/submit')
      .send({ formPopupId: popup._id.toString(), email: 'safe@example.com' });
    assert.equal(response.status, 200);
    assert.equal(await Lead.countDocuments({ userId, email: 'safe@example.com' }), 1);
    assert.equal(await contactInspected, true);
  } finally {
    AutomationDispatchService.dispatchLead = originalDispatch;
  }
});
