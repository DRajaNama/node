process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'campaign-integration-test-secret';

const { before, after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../../app');
const Campaign = require('../../models/campaign.model');
const Automation = require('../../models/automation.model');
const { connectTestDb, disconnectTestDb, clearCollections } = require('../helpers/setupDb');
const { seedUsers, signToken } = require('../helpers/seed');
const { authHeader } = require('../helpers/auth');

let app;
let users;
let customerToken;

const campaignPayload = (overrides = {}) => ({
  name: 'Customer campaign',
  subject: 'Hello from the campaign',
  previewText: 'A short preview',
  contentEditor: 'template',
  templateId: String(users.customer._id),
  listIds: [String(users.customer._id)],
  excludedListIds: [],
  sendType: 'now',
  timezone: 'Asia/Kolkata',
  settings: {
    trackOpen: true,
    trackClick: true,
    trackBounce: true,
    trackUnsubscribe: true,
  },
  ...overrides,
});

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
  customerToken = signToken(users.customer);
});

describe('campaign API', () => {
  it('derives the initial status from the selected campaign type', async () => {
    const email = await request(app)
      .post('/api/campaign/create')
      .set(authHeader(customerToken))
      .send(campaignPayload({
        name: 'Regular email campaign',
        type: 'email',
        status: 'automation',
      }));

    assert.equal(email.status, 200);
    assert.equal(email.body.data.type, 'email');
    assert.equal(email.body.data.status, 'draft');

    const automation = await request(app)
      .post('/api/campaign/create')
      .set(authHeader(customerToken))
      .send(campaignPayload({
        name: 'Lead automation campaign',
        type: 'automation',
        status: 'draft',
      }));

    assert.equal(automation.status, 200);
    assert.equal(automation.body.data.type, 'automation');
    assert.equal(automation.body.data.status, 'automation');

    const stored = await Campaign.findById(automation.body.data._id).lean();
    assert.equal(stored.type, 'automation');
    assert.equal(stored.status, 'automation');
  });

  it('rejects an unsupported campaign type', async () => {
    const response = await request(app)
      .post('/api/campaign/create')
      .set(authHeader(customerToken))
      .send(campaignPayload({ type: 'transactional' }));

    assert.equal(response.status, 400);
    assert.ok(response.body.errors?.type);
    assert.equal(await Campaign.countDocuments(), 0);
  });

  it('does not delete a campaign linked to an automation until it is unlinked', async () => {
    const campaign = await Campaign.create({
      userId: users.customer._id,
      name: 'Automation campaign',
      subject: 'Welcome',
      fromName: 'Sales',
      fromEmail: 'sales@example.com',
      templateId: users.customer._id,
      type: 'automation',
      status: 'automation',
      listIds: [],
    });
    const automation = await Automation.create({
      userId: users.customer._id,
      createdBy: users.customer._id,
      name: 'Welcome automation',
      actionType: 'SEND_EMAIL_CAMPAIGN',
      actionConfig: { campaignId: campaign._id },
    });

    const blocked = await request(app)
      .delete(`/api/campaign/delete/${campaign._id}`)
      .set(authHeader(customerToken));

    assert.equal(blocked.status, 400);
    assert.match(blocked.body.message, /unlink/i);
    assert.ok(await Campaign.exists({ _id: campaign._id }));

    await Automation.updateOne({ _id: automation._id }, { $set: { actionConfig: {} } });
    const deleted = await request(app)
      .delete(`/api/campaign/delete/${campaign._id}`)
      .set(authHeader(customerToken));

    assert.equal(deleted.status, 200);
    assert.equal(await Campaign.exists({ _id: campaign._id }), null);
  });
});
