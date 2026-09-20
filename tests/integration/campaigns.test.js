process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'campaign-integration-test-secret';

const { before, after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../../app');
const Campaign = require('../../models/campaign.model');
const CampaignRecipient = require('../../models/campaignRecipient.model');
const Automation = require('../../models/automation.model');
const CampaignSendService = require('../../services/campaignSend.services');
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

  it('resends a failed campaign only to failed recipients', async () => {
    const campaign = await Campaign.create({
      userId: users.customer._id,
      name: 'Partially failed campaign',
      subject: 'Delivery test',
      fromName: 'Sales',
      fromEmail: 'sales@example.com',
      templateId: users.customer._id,
      type: 'email',
      status: 'failed',
      listIds: [],
      stats: { total: 2, sent: 1, failed: 1, pending: 0 },
    });
    const [sentRecipient, failedRecipient] = await CampaignRecipient.create([
      {
        campaignId: campaign._id,
        userId: users.customer._id,
        contactId: users.customer._id,
        email: 'sent@example.com',
        status: 'sent',
        trackingToken: 'sent-recipient-token',
      },
      {
        campaignId: campaign._id,
        userId: users.customer._id,
        contactId: users.admin._id,
        email: 'failed@example.com',
        status: 'failed',
        trackingToken: 'failed-recipient-token',
        bounceReason: 'Temporary SMTP error',
      },
    ]);
    const originalEnqueue = CampaignSendService.enqueueRecipients;
    let enqueuedRecipientIds = [];
    CampaignSendService.enqueueRecipients = async (_campaign, recipients) => {
      enqueuedRecipientIds = recipients.map((recipient) => String(recipient._id));
      return recipients.length;
    };

    try {
      const response = await request(app)
        .post(`/api/campaign/resend/${campaign._id}`)
        .set(authHeader(customerToken));

      assert.equal(response.status, 200);
      assert.deepEqual(enqueuedRecipientIds, [String(failedRecipient._id)]);

      const updatedCampaign = await Campaign.findById(campaign._id).lean();
      assert.equal(updatedCampaign.status, 'sending');
      assert.equal(updatedCampaign.stats.sent, 1);
      assert.equal(updatedCampaign.stats.failed, 0);
      assert.equal(updatedCampaign.stats.pending, 1);

      assert.equal((await CampaignRecipient.findById(sentRecipient._id)).status, 'sent');
      const retriedRecipient = await CampaignRecipient.findById(failedRecipient._id).lean();
      assert.equal(retriedRecipient.status, 'pending');
      assert.equal(retriedRecipient.bounceReason, undefined);
    } finally {
      CampaignSendService.enqueueRecipients = originalEnqueue;
    }
  });

  it('resumes a campaign sending for two hours without resending successful recipients', async () => {
    const campaign = await Campaign.create({
      userId: users.customer._id,
      name: 'Stuck campaign',
      subject: 'Resume sending',
      fromName: 'Sales',
      fromEmail: 'sales@example.com',
      templateId: users.customer._id,
      type: 'email',
      status: 'sending',
      sendingStartedAt: new Date(Date.now() - (2 * 60 * 60 * 1000) - 1000),
      listIds: [],
      stats: { total: 2, sent: 1, pending: 1 },
    });
    const [sentRecipient, pendingRecipient] = await CampaignRecipient.create([
      {
        campaignId: campaign._id,
        userId: users.customer._id,
        contactId: users.customer._id,
        email: 'sent@example.com',
        status: 'sent',
        trackingToken: 'stuck-sent-recipient-token',
        sentAt: new Date(),
        providerMessageId: 'provider-message-id',
      },
      {
        campaignId: campaign._id,
        userId: users.customer._id,
        contactId: users.admin._id,
        email: 'pending@example.com',
        status: 'sending',
        trackingToken: 'stuck-pending-recipient-token',
      },
    ]);
    const originalEnqueue = CampaignSendService.enqueueRecipients;
    let enqueuedRecipientIds = [];
    CampaignSendService.enqueueRecipients = async (_campaign, recipients) => {
      enqueuedRecipientIds = recipients.map((item) => String(item._id));
      return recipients.length;
    };

    try {
      const response = await request(app)
        .post(`/api/campaign/resend/${campaign._id}`)
        .set(authHeader(customerToken));

      assert.equal(response.status, 200);
      assert.deepEqual(enqueuedRecipientIds, [String(pendingRecipient._id)]);

      const updatedCampaign = await Campaign.findById(campaign._id).lean();
      assert.equal(updatedCampaign.status, 'sending');
      assert.equal(updatedCampaign.stats.total, 2);
      assert.equal(updatedCampaign.stats.pending, 1);
      assert.equal(updatedCampaign.stats.sent, 1);
      assert.ok(Date.now() - updatedCampaign.sendingStartedAt.getTime() < 10000);

      const preservedRecipient = await CampaignRecipient.findById(sentRecipient._id).lean();
      assert.equal(preservedRecipient.status, 'sent');
      assert.ok(preservedRecipient.sentAt);
      assert.equal(preservedRecipient.providerMessageId, 'provider-message-id');
      assert.equal((await CampaignRecipient.findById(pendingRecipient._id)).status, 'pending');
    } finally {
      CampaignSendService.enqueueRecipients = originalEnqueue;
    }
  });

  it('does not resend completed or recently-started campaigns', async () => {
    const campaigns = await Campaign.create([
      {
        userId: users.customer._id,
        name: 'Completed campaign',
        subject: 'Completed',
        fromName: 'Sales',
        fromEmail: 'sales@example.com',
        templateId: users.customer._id,
        type: 'email',
        status: 'completed',
        listIds: [],
      },
      {
        userId: users.customer._id,
        name: 'Recently started campaign',
        subject: 'Still sending',
        fromName: 'Sales',
        fromEmail: 'sales@example.com',
        templateId: users.customer._id,
        type: 'email',
        status: 'sending',
        sendingStartedAt: new Date(),
        listIds: [],
      },
    ]);

    for (const campaign of campaigns) {
      const response = await request(app)
        .post(`/api/campaign/resend/${campaign._id}`)
        .set(authHeader(customerToken));
      assert.equal(response.status, 400);
      assert.equal(response.body.message, 'Invalid campaign status');
    }
  });
});
