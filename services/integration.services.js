const https = require('https');
const nodemailer = require('nodemailer');
const Integration = require('../models/integration.model');
const { encryptSecrets, decryptSecrets } = require('../utils/automationSecrets.utils');
const EntitlementService = require('./entitlement.services');

const PROVIDERS = {
  smtp: { type: 'email', name: 'SMTP', fields: ['host', 'port', 'username', 'password', 'encryption'] },
  sendgrid: { type: 'email', name: 'SendGrid', fields: ['apiKey'] },
  mailgun: { type: 'email', name: 'Mailgun', fields: ['apiKey', 'domain', 'region'] },
  zoho: { type: 'crm', name: 'Zoho', fields: ['accessToken', 'apiUrl'] },
  pipedrive: { type: 'crm', name: 'Pipedrive', fields: ['apiToken', 'domain'] },
  hubspot: { type: 'crm', name: 'HubSpot', fields: ['accessToken'] },
  slack: { type: 'alert', name: 'Slack', fields: ['accessToken'] },
  mailchimp: { type: 'leads', name: 'Mailchimp', fields: ['apiKey', 'serverPrefix'] },
};
const EMAIL_PROVIDERS = new Set(['smtp', 'sendgrid', 'mailgun']);

const request = (url, options = {}) => new Promise((resolve, reject) => {
  const target = new URL(url);
  const req = https.request({ hostname: target.hostname, path: `${target.pathname}${target.search}`, method: options.method || 'GET', headers: options.headers || {} }, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', reject);
  req.setTimeout(10000, () => req.destroy(new Error('Connection timed out')));
  if (options.body) {
    const body = JSON.stringify(options.body);
    req.setHeader('Content-Type', 'application/json');
    req.setHeader('Content-Length', Buffer.byteLength(body));
    req.write(body);
  }
  req.end();
});

const basic = (user, password) => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const assertResponse = (response) => { if (response.status < 200 || response.status >= 300) throw new Error('Provider rejected the credentials.'); };
const mailchimpUrl = (config, path) => `https://${config.serverPrefix}.api.mailchimp.com/3.0${path}`;

const verifyProvider = async (provider, config) => {
  switch (provider) {
    case 'smtp': {
      const transport = nodemailer.createTransport({ host: config.host, port: Number(config.port), secure: config.encryption === 'SSL', auth: { user: config.username, pass: config.password } });
      await transport.verify();
      return;
    }
    case 'sendgrid': assertResponse(await request('https://api.sendgrid.com/v3/user/profile', { headers: bearer(config.apiKey) })); return;
    case 'mailgun': assertResponse(await request(`${config.region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net'}/v3/${config.domain}`, { headers: { Authorization: basic('api', config.apiKey) } })); return;
    case 'zoho': assertResponse(await request(`${config.apiUrl || 'https://www.zohoapis.com'}/crm/v2/org`, { headers: bearer(config.accessToken) })); return;
    case 'pipedrive': assertResponse(await request(`https://${config.domain}.pipedrive.com/api/v1/users/me?api_token=${encodeURIComponent(config.apiToken)}`)); return;
    case 'hubspot': assertResponse(await request('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', { headers: bearer(config.accessToken) })); return;
    case 'slack': assertResponse(await request('https://slack.com/api/auth.test', { headers: bearer(config.accessToken) })); return;
    case 'mailchimp': assertResponse(await request(`https://${config.serverPrefix}.api.mailchimp.com/3.0/ping`, { headers: { Authorization: basic('any', config.apiKey) } })); return;
    default: throw new Error('Unsupported integration provider.');
  }
};

const validate = (provider, config) => {
  const definition = PROVIDERS[provider];
  if (!definition) throw new Error('Unsupported integration provider.');
  const missing = definition.fields.filter((field) => config[field] === undefined || config[field] === null || String(config[field]).trim() === '');
  if (missing.length) throw new Error(`Missing required configuration: ${missing.join(', ')}.`);
  if (provider === 'smtp' && (!Number(config.port) || Number(config.port) < 1 || Number(config.port) > 65535)) throw new Error('SMTP port must be between 1 and 65535.');
};

const publicRecord = (record) => ({ _id: record._id, provider: record.provider, type: record.type, name: record.name, enabled: record.enabled, verifiedAt: record.verifiedAt, lastVerifiedAt: record.lastVerifiedAt, createdAt: record.createdAt, updatedAt: record.updatedAt });

const IntegrationService = {
  providers: PROVIDERS,
  async verify(provider, config) { validate(provider, config); await verifyProvider(provider, config); return { provider, type: PROVIDERS[provider].type, name: PROVIDERS[provider].name }; },
  async list(userId) { return (await Integration.find({ userId }).sort({ createdAt: -1 })).map(publicRecord); },
  async getActiveEmail(userId) {
    const record = await Integration.findOne({ userId, enabled: true, provider: { $in: [...EMAIL_PROVIDERS] } }).select('+config');
    return record ? { provider: record.provider, config: decryptSecrets(record.config) } : null;
  },
  async getMailchimp(userId) {
    const record = await Integration.findOne({ userId, provider: 'mailchimp', enabled: true }).select('+config');
    return record ? decryptSecrets(record.config) : null;
  },
  async listMailchimpAudiences(userId) {
    const config = await this.getMailchimp(userId);
    if (!config) throw new Error('An active Mailchimp integration is required.');
    const response = await request(mailchimpUrl(config, '/lists?count=100'), { headers: { Authorization: basic('any', config.apiKey) } });
    assertResponse(response);
    return JSON.parse(response.body).lists?.map((list) => ({ id: list.id, name: list.name, memberCount: list.stats?.member_count || 0 })) || [];
  },
  async addMailchimpLead(userId, audienceId, lead, statusIfNew = 'subscribed') {
    const config = await this.getMailchimp(userId);
    if (!config) throw new Error('An active Mailchimp integration is required.');
    const email = String(lead?.email || '').trim().toLowerCase();
    if (!email) throw new Error('The lead does not have an email address.');
    const merge_fields = {
        FNAME:'Unknown',
        LNAME:'Unknown'
    };
    if (lead.firstName) merge_fields.FNAME = lead.firstName || 'Unknown';
    if (lead.lastName) merge_fields.LNAME = lead.lastName || 'Unknown';
    const response = await request(mailchimpUrl(config, `/lists/${encodeURIComponent(audienceId)}/members/${require('crypto').createHash('md5').update(email).digest('hex')}`), {
      method: 'PUT',
      headers: { Authorization: basic('any', config.apiKey) },
      body: { email_address: email, status_if_new: statusIfNew, merge_fields },
    });
    assertResponse(response);
    return { provider: 'mailchimp', audienceId, status: JSON.parse(response.body).status || statusIfNew };
  },
  async get(userId, id) { const record = await Integration.findOne({ _id: id, userId }); return record ? publicRecord(record) : null; },
  async create(userId, provider, config) {
    if (await Integration.exists({ userId, provider })) {
      throw new Error('This provider is already integrated. Edit or delete the existing integration first.');
    }
    if (!EMAIL_PROVIDERS.has(provider)) await EntitlementService.checkLimit(userId, 'integrations', 1);
    if (EMAIL_PROVIDERS.has(provider) && await Integration.exists({ userId, provider: { $in: [...EMAIL_PROVIDERS] }, enabled: true })) {
      throw new Error('Only one email provider can be selected for sending. Disable the current email integration first.');
    }
    await this.verify(provider, config);
    const now = new Date();
    const record = await Integration.create({ userId, provider, type: PROVIDERS[provider].type, name: PROVIDERS[provider].name, config: encryptSecrets(config), verifiedAt: now, lastVerifiedAt: now });
    return publicRecord(record);
  },
  async capability(userId) {
    const limit = await EntitlementService.getLimit(userId, 'integrations');
    const used = await Integration.countDocuments({ userId, provider: { $nin: [...EMAIL_PROVIDERS] } });
    const recommendedPlan = limit > used ? null : await EntitlementService.getRecommendedUpgradePlan(userId, 'integrations');
    return {
      limit: limit === Infinity ? null : limit,
      used,
      remaining: limit === Infinity ? null : Math.max(0, limit - used),
      isUnlimited: limit === Infinity,
      enabled: limit > used,
      recommendedPlan,
    };
  },
  async update(userId, id, input) { const record = await Integration.findOne({ _id: id, userId }).select('+config'); if (!record) return null; const config = { ...decryptSecrets(record.config), ...(input.config || {}) }; await this.verify(record.provider, config); record.config = encryptSecrets(config); record.lastVerifiedAt = new Date(); if (input.name) record.name = input.name; await record.save(); return publicRecord(record); },
  async status(userId, id, enabled) {
    const current = await Integration.findOne({ _id: id, userId });
    if (!current) return null;
    if (enabled && EMAIL_PROVIDERS.has(current.provider) && await Integration.exists({ userId, _id: { $ne: id }, provider: { $in: [...EMAIL_PROVIDERS] }, enabled: true })) {
      throw new Error('Only one email provider can be enabled for sending.');
    }
    current.enabled = !!enabled;
    await current.save();
    return publicRecord(current);
  },
  async remove(userId, id) { return Integration.deleteOne({ _id: id, userId }); },
};

module.exports = IntegrationService;