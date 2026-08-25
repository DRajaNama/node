process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'automation-integration-test-secret';
process.env.AUTOMATION_ENCRYPTION_KEY = process.env.AUTOMATION_ENCRYPTION_KEY || 'automation-test-encryption-key';

const { before, after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../../app');
const Automation = require('../../models/automation.model');
const AutomationExecution = require('../../models/automationExecution.model');
const Campaign = require('../../models/campaign.model');
const Lead = require('../../models/lead.model');
const Settings = require('../../models/settings.model');
const { decryptAutomationSecrets } = require('../../services/automationConfig.services');
const { encryptSecrets } = require('../../utils/automationSecrets.utils');
const { connectTestDb, disconnectTestDb, clearCollections } = require('../helpers/setupDb');
const {
  seedUsers,
  seedAutomationPlan,
  assignPlan,
  signToken,
} = require('../helpers/seed');
const { authHeader } = require('../helpers/auth');
const { PERMISSIONS, ROLE_PERMISSIONS } = require('../../config/permissions');
const { updateRolePermissions } = require('../../config/permissionsRuntime');

let app;
let users;
let customerToken;

const emailAlertPayload = (overrides = {}) => ({
  name: 'New Lead Email Alert',
  description: 'Tell the sales team about every lead.',
  status: 'ACTIVE',
  triggerType: 'NEW_LEAD',
  conditions: { type: 'all', logic: 'AND', rules: [] },
  actionType: 'SEND_EMAIL_ALERT',
  actionConfig: {
    recipients: ['sales@example.com'],
    subject: 'New lead: {{lead.email}}',
    message: '{{lead.firstName}} submitted the form.',
  },
  ...overrides,
});

const webhookPayload = (overrides = {}) => ({
  name: 'New Lead Webhook',
  status: 'ACTIVE',
  triggerType: 'NEW_LEAD',
  conditions: { type: 'all', logic: 'AND', rules: [] },
  actionType: 'TRIGGER_WEBHOOK',
  actionConfig: {
    url: 'https://example.com/hooks/leads',
    method: 'POST',
    triggerMode: 'FIRST_TIME',
    headers: [
      { key: 'Content-Type', value: 'application/json' },
      { key: 'Authorization', value: 'Bearer top-secret', sensitive: true },
    ],
    body: { event: 'new_lead', email: '{{lead.email}}' },
  },
  ...overrides,
});

const createViaApi = async (payload = emailAlertPayload(), token = customerToken) =>
  request(app).post('/api/automations').set(authHeader(token)).send(payload);

before(async () => {
  await connectTestDb();
  app = createApp();
});

after(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  await clearCollections();
  users = await seedUsers();
  const automationPlan = await seedAutomationPlan();
  await Promise.all([
    assignPlan(users.customer._id, automationPlan._id),
    assignPlan(users.admin._id, automationPlan._id),
  ]);
  customerToken = signToken(users.customer);
});

describe('automation API', () => {
  it('requires an encryption key outside tests unless insecure development fallback is explicit', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousKey = process.env.AUTOMATION_ENCRYPTION_KEY;
    const previousFallback = process.env.AUTOMATION_ALLOW_INSECURE_DEV_KEY;
    const originalWarn = console.warn;
    const warnings = [];

    try {
      delete process.env.AUTOMATION_ENCRYPTION_KEY;
      delete process.env.AUTOMATION_ALLOW_INSECURE_DEV_KEY;
      process.env.NODE_ENV = 'development';
      assert.throws(
        () => encryptSecrets({ token: 'secret' }),
        (error) => error.code === 'AUTOMATION_ENCRYPTION_KEY_REQUIRED'
      );

      process.env.NODE_ENV = 'production';
      process.env.AUTOMATION_ALLOW_INSECURE_DEV_KEY = 'true';
      assert.throws(
        () => encryptSecrets({ token: 'secret' }),
        (error) => error.code === 'AUTOMATION_ENCRYPTION_KEY_REQUIRED'
      );

      process.env.NODE_ENV = 'development';
      console.warn = (message) => warnings.push(String(message));
      assert.match(encryptSecrets({ token: 'secret' }), /^v1\./);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /insecure development encryption key/i);

      process.env.NODE_ENV = 'test';
      delete process.env.AUTOMATION_ALLOW_INSECURE_DEV_KEY;
      assert.match(encryptSecrets({ token: 'secret' }), /^v1\./);
    } finally {
      console.warn = originalWarn;
      process.env.NODE_ENV = previousNodeEnv;
      if (previousKey === undefined) delete process.env.AUTOMATION_ENCRYPTION_KEY;
      else process.env.AUTOMATION_ENCRYPTION_KEY = previousKey;
      if (previousFallback === undefined) delete process.env.AUTOMATION_ALLOW_INSECURE_DEV_KEY;
      else process.env.AUTOMATION_ALLOW_INSECURE_DEV_KEY = previousFallback;
    }
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/automations');
    assert.equal(res.status, 401);
  });

  it('enforces the existing marketing automation plan entitlement', async () => {
    const tokenWithoutAutomationPlan = signToken(users.superAdmin);
    const res = await request(app)
      .get('/api/automations')
      .set(authHeader(tokenWithoutAutomationPlan));
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'QUOTA_EXCEEDED');
    assert.equal(res.body.details.feature, true);
    assert.equal(res.body.details.resourceKey, 'marketing_automation');
  });

  it('enforces the existing fine-grained role permission architecture', async () => {
    await updateRolePermissions('user', [PERMISSIONS.AUTOMATIONS_VIEW]);
    try {
      const list = await request(app)
        .get('/api/automations')
        .set(authHeader(customerToken));
      assert.equal(list.status, 200);

      const create = await createViaApi();
      assert.equal(create.status, 403);
      assert.match(create.body.message, /permission denied/i);
    } finally {
      await updateRolePermissions('user', ROLE_PERMISSIONS.user);
    }
  });

  it('enforces configured workflow limits for create and duplicate', async () => {
    const limitedPlan = await seedAutomationPlan(1);
    await assignPlan(users.admin._id, limitedPlan._id);
    const adminToken = signToken(users.admin);

    const created = await createViaApi(emailAlertPayload({ name: 'Limited workflow' }), adminToken);
    assert.equal(created.status, 200);

    const duplicated = await request(app)
      .post(`/api/automations/${created.body.data._id}/duplicate`)
      .set(authHeader(adminToken));
    assert.equal(duplicated.status, 403);
    assert.equal(duplicated.body.code, 'QUOTA_EXCEEDED');
    assert.equal(duplicated.body.details.resourceKey, 'automation_workflows');
    assert.equal(duplicated.body.details.usage, 1);
    assert.equal(duplicated.body.details.limit, 1);
  });

  it('creates, retrieves, updates, and owner-scopes an automation', async () => {
    const created = await createViaApi();
    assert.equal(created.status, 200);
    assert.equal(created.body.data.name, 'New Lead Email Alert');
    assert.equal(created.body.data.userId, String(users.customer._id));
    assert.equal(created.body.data.createdBy, String(users.customer._id));
    assert.equal(created.body.data.status, 'ACTIVE');
    assert.equal(created.body.data.secrets, undefined);

    const id = created.body.data._id;
    const fetched = await request(app)
      .get(`/api/automations/${id}`)
      .set(authHeader(customerToken));
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.data._id, id);

    const updated = await request(app)
      .put(`/api/automations/${id}`)
      .set(authHeader(customerToken))
      .send({ name: 'Updated Lead Alert' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.name, 'Updated Lead Alert');
    assert.deepEqual(updated.body.data.actionConfig.recipients, ['sales@example.com']);

    const otherToken = signToken(users.admin);
    const forbiddenByOwnership = await request(app)
      .get(`/api/automations/${id}`)
      .set(authHeader(otherToken));
    assert.equal(forbiddenByOwnership.status, 404);
  });

  it('lists with escaped search, filters, clamped pagination, and total pages', async () => {
    await createViaApi(emailAlertPayload({ name: 'Alpha [Sales] Alert' }));
    await createViaApi(webhookPayload({ name: 'Beta Webhook' }));
    await createViaApi(emailAlertPayload({ name: 'Paused Alert', status: 'PAUSED' }));

    const searched = await request(app)
      .get('/api/automations')
      .query({ search: '[Sales]', page: 1, limit: 500 })
      .set(authHeader(customerToken));
    assert.equal(searched.status, 200);
    assert.equal(searched.body.data.length, 1);
    assert.equal(searched.body.meta.limit, 100);
    assert.equal(searched.body.meta.totalPages, 1);

    const filtered = await request(app)
      .get('/api/automations')
      .query({ status: 'ACTIVE', actionType: 'TRIGGER_WEBHOOK', limit: 1 })
      .set(authHeader(customerToken));
    assert.equal(filtered.status, 200);
    assert.equal(filtered.body.meta.total, 1);
    assert.equal(filtered.body.data[0].actionType, 'TRIGGER_WEBHOOK');

    const actionLabelSearch = await request(app)
      .get('/api/automations')
      .query({ search: 'Email Alert' })
      .set(authHeader(customerToken));
    assert.equal(actionLabelSearch.status, 200);
    assert.equal(actionLabelSearch.body.meta.total, 2);

    const invalidFilter = await request(app)
      .get('/api/automations')
      .query({ status: 'BROKEN' })
      .set(authHeader(customerToken));
    assert.equal(invalidFilter.status, 400);
  });

  it('validates structured conditions and action-specific configuration', async () => {
    const invalidRules = await createViaApi(emailAlertPayload({
      conditions: {
        type: 'rules',
        logic: 'AND',
        rules: [{ field: 'country', operator: 'EQUALS', value: '' }],
      },
    }));
    assert.equal(invalidRules.status, 400);
    assert.ok(invalidRules.body.errors['conditions.rules.0.value']);

    const invalidWebhook = await createViaApi(webhookPayload({
      actionConfig: {
        url: 'javascript:alert(1)',
        method: 'TRACE',
        triggerMode: 'SOMETIMES',
        headers: [
          { key: 'X-Test', value: 'one' },
          { key: 'x-test', value: 'two' },
        ],
        body: 'not-json',
      },
    }));
    assert.equal(invalidWebhook.status, 400);
    assert.ok(invalidWebhook.body.errors['actionConfig.url']);
    assert.ok(invalidWebhook.body.errors['actionConfig.headers.1.key']);
    assert.ok(invalidWebhook.body.errors['actionConfig.body']);

    const invalidFromEmail = await createViaApi(emailAlertPayload({
      actionConfig: {
        recipients: ['sales@example.com'],
        subject: 'New lead',
        message: 'A new lead arrived.',
        fromEmail: 'not-an-email',
      },
    }));
    assert.equal(invalidFromEmail.status, 400);
    assert.ok(invalidFromEmail.body.errors['actionConfig.fromEmail']);

    const unavailableSlack = await createViaApi(emailAlertPayload({
      actionType: 'SEND_TO_SLACK',
      actionConfig: {
        integrationId: 'slack-connection',
        channel: '#new-leads',
        message: 'New lead: {{lead.email}}',
      },
    }));
    assert.equal(unavailableSlack.status, 400);
    assert.match(unavailableSlack.body.message, /not available/i);
  });

  it('masks and preserves webhook secrets and copies ciphertext on duplicate', async () => {
    const created = await createViaApi(webhookPayload());
    assert.equal(created.status, 200);
    const id = created.body.data._id;
    const publicAuthorization = created.body.data.actionConfig.headers.find(
      (header) => header.key === 'Authorization'
    );
    assert.deepEqual(publicAuthorization, {
      key: 'Authorization',
      value: '********',
      sensitive: true,
      hasValue: true,
    });
    assert.equal(JSON.stringify(created.body).includes('top-secret'), false);

    const storedBefore = await Automation.findById(id).select('+secrets');
    assert.ok(storedBefore.secrets);
    assert.equal(JSON.stringify(storedBefore.actionConfig).includes('top-secret'), false);

    const updated = await request(app)
      .put(`/api/automations/${id}`)
      .set(authHeader(customerToken))
      .send({
        name: 'Webhook Renamed',
        actionConfig: created.body.data.actionConfig,
      });
    assert.equal(updated.status, 200);
    const storedAfter = await Automation.findById(id).select('+secrets');
    assert.deepEqual(
      decryptAutomationSecrets(storedAfter),
      decryptAutomationSecrets(storedBefore)
    );

    const duplicated = await request(app)
      .post(`/api/automations/${id}/duplicate`)
      .set(authHeader(customerToken));
    assert.equal(duplicated.status, 200);
    assert.equal(duplicated.body.data.status, 'PAUSED');
    assert.equal(duplicated.body.data.secrets, undefined);
    const duplicateStored = await Automation.findById(duplicated.body.data._id).select('+secrets');
    assert.equal(duplicateStored.secrets, storedAfter.secrets);
  });

  it('changes status and deletes the automation with its executions', async () => {
    const created = await createViaApi();
    const id = created.body.data._id;

    const paused = await request(app)
      .patch(`/api/automations/${id}/status`)
      .set(authHeader(customerToken))
      .send({ status: 'PAUSED' });
    assert.equal(paused.status, 200);
    assert.equal(paused.body.data.status, 'PAUSED');

    const invalid = await request(app)
      .patch(`/api/automations/${id}/status`)
      .set(authHeader(customerToken))
      .send({ status: 'DELETED' });
    assert.equal(invalid.status, 400);

    const lead = await Lead.create({ userId: users.customer._id, email: 'lead@example.com' });
    await AutomationExecution.create({
      userId: users.customer._id,
      automationId: id,
      leadId: lead._id,
      actionType: 'SEND_EMAIL_ALERT',
      status: 'SUCCESS',
      triggerMode: 'EVERY_TIME',
      completedAt: new Date(),
    });

    const deleted = await request(app)
      .delete(`/api/automations/${id}`)
      .set(authHeader(customerToken));
    assert.equal(deleted.status, 200);
    assert.equal(await Automation.countDocuments({ _id: id }), 0);
    assert.equal(await AutomationExecution.countDocuments({ automationId: id }), 0);
  });

  it('returns owned integration options without SMTP credentials', async () => {
    const campaign = await Campaign.create({
      userId: users.customer._id,
      name: 'Welcome Leads',
      subject: 'Welcome',
      fromName: 'Sales',
      fromEmail: 'sales@example.com',
      templateId: users.customer._id,
      listIds: [],
    });
    await Campaign.create({
      userId: users.admin._id,
      name: 'Other User Campaign',
      subject: 'Private',
      fromName: 'Admin',
      fromEmail: 'admin@example.com',
      templateId: users.admin._id,
      listIds: [],
    });
    await Settings.create({
      user: users.customer._id,
      smtp: {
        host: 'smtp.example.com',
        port: 587,
        username: 'smtp-user',
        password: 'smtp-password',
        encryption: 'TLS',
      },
    });

    const options = await request(app)
      .get('/api/automations/options')
      .set(authHeader(customerToken));
    assert.equal(options.status, 200);
    assert.equal(options.body.data.smtpConfigured, true);
    assert.deepEqual(options.body.data.campaigns.map((item) => item._id), [String(campaign._id)]);
    assert.equal(JSON.stringify(options.body).includes('smtp-password'), false);
    const slack = options.body.data.actions.find((action) => action.type === 'SEND_TO_SLACK');
    const webhook = options.body.data.actions.find((action) => action.type === 'TRIGGER_WEBHOOK');
    assert.equal(slack.available, false);
    assert.ok(slack.reason);
    assert.equal(webhook.available, true);
  });

  it('lists newest executions with populated lead fields and redacted metadata', async () => {
    const created = await createViaApi();
    const lead = await Lead.create({
      userId: users.customer._id,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '1234',
    });
    await AutomationExecution.create({
      userId: users.customer._id,
      automationId: created.body.data._id,
      leadId: lead._id,
      actionType: 'SEND_EMAIL_ALERT',
      status: 'FAILED',
      triggerMode: 'EVERY_TIME',
      startedAt: new Date(),
      completedAt: new Date(),
      errorMessage: 'Bearer private-token failed',
      responseStatus: 500,
      metadata: { authorization: 'Bearer private-token', nested: { apiKey: 'private-key' } },
    });

    const logs = await request(app)
      .get(`/api/automations/${created.body.data._id}/executions`)
      .set(authHeader(customerToken));
    assert.equal(logs.status, 200);
    assert.equal(logs.body.meta.total, 1);
    assert.equal(logs.body.meta.totalPages, 1);
    assert.equal(logs.body.data[0].leadId.firstName, 'Ada');
    assert.equal(logs.body.data[0].automationId.name, 'New Lead Email Alert');
    assert.ok(logs.body.data[0].createdAt);
    assert.equal(logs.body.data[0].metadata.authorization, '[REDACTED]');
    assert.equal(logs.body.data[0].metadata.nested.apiKey, '[REDACTED]');
    assert.equal(logs.body.data[0].errorMessage.includes('private-token'), false);
  });

  it('enforces the FIRST_TIME execution unique reservation', async () => {
    const created = await createViaApi(webhookPayload());
    const lead = await Lead.create({ userId: users.customer._id, email: 'once@example.com' });
    const execution = {
      userId: users.customer._id,
      automationId: created.body.data._id,
      leadId: lead._id,
      actionType: 'TRIGGER_WEBHOOK',
      status: 'PENDING',
      triggerMode: 'FIRST_TIME',
      dedupeKey: 'FIRST_TIME',
    };
    await AutomationExecution.create(execution);
    await assert.rejects(AutomationExecution.create(execution), (error) => error?.code === 11000);

    await AutomationExecution.create({
      ...execution,
      triggerMode: 'EVERY_TIME',
      dedupeKey: null,
    });
    await AutomationExecution.create({
      ...execution,
      triggerMode: 'EVERY_TIME',
      dedupeKey: null,
    });
  });
});
