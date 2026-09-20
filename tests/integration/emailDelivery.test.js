process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'email-delivery-test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const Campaign = require('../../models/campaign.model');
const CampaignEvent = require('../../models/campaignEvent.model');
const CampaignRecipient = require('../../models/campaignRecipient.model');
const Template = require('../../models/template.model');
const IntegrationService = require('../../services/integration.services');
const CampaignService = require('../../services/campaign.services');
const { processEmailJob } = require('../../services/emailJob.services');
const { isRecipientAccepted } = require('../../helpers/emailDelivery.helper');
const { connectTestDb, disconnectTestDb, clearCollections } = require('../helpers/setupDb');

test.before(connectTestDb);
test.afterEach(clearCollections);
test.after(disconnectTestDb);

test('successful SMTP acceptance records sent and delivered exactly once', async () => {
  const userId = new mongoose.Types.ObjectId();
  const template = await Template.create({
    userId,
    title: 'Delivery template',
    html: '<p>Hello [[EMAIL]]</p>',
    status: 'published',
  });
  const campaign = await Campaign.create({
    userId,
    name: 'Delivery campaign',
    subject: 'Delivery status',
    fromName: 'Marketing',
    fromEmail: 'marketing@example.com',
    templateId: template._id,
    status: 'sending',
    stats: { total: 1, pending: 1 },
  });
  const recipient = await CampaignRecipient.create({
    campaignId: campaign._id,
    userId,
    contactId: new mongoose.Types.ObjectId(),
    email: 'reader@example.com',
    firstName: 'Reader',
    trackingToken: 'delivery-test-recipient',
    status: 'pending',
  });

  const originalGetActiveEmail = IntegrationService.getActiveEmail;
  const originalCreateTransport = nodemailer.createTransport;
  IntegrationService.getActiveEmail = async () => ({
    provider: 'smtp',
    config: { host: 'smtp.example.com', port: 587, encryption: 'TLS', authentication: false },
  });
  nodemailer.createTransport = () => ({
    sendMail: async () => ({
      messageId: 'smtp-message-id',
      accepted: ['reader@example.com'],
      rejected: [],
    }),
  });

  try {
    await processEmailJob({
      userId: String(userId),
      campaignId: String(campaign._id),
      recipientId: String(recipient._id),
      email: recipient.email,
      firstName: recipient.firstName,
      lastName: '',
      trackingToken: recipient.trackingToken,
    });
  } finally {
    IntegrationService.getActiveEmail = originalGetActiveEmail;
    nodemailer.createTransport = originalCreateTransport;
  }

  const updatedRecipient = await CampaignRecipient.findById(recipient._id).lean();
  const updatedCampaign = await Campaign.findById(campaign._id).lean();
  assert.equal(updatedRecipient.status, 'delivered');
  assert.ok(updatedRecipient.sentAt);
  assert.ok(updatedRecipient.deliveredAt);
  assert.equal(updatedRecipient.providerMessageId, 'smtp-message-id');
  assert.equal(updatedCampaign.stats.sent, 1);
  assert.equal(updatedCampaign.stats.delivered, 1);
  assert.equal(updatedCampaign.stats.pending, 0);
  assert.equal(await CampaignEvent.countDocuments({ campaignId: campaign._id, event: 'sent' }), 1);
  assert.equal(await CampaignEvent.countDocuments({ campaignId: campaign._id, event: 'delivered' }), 1);

  await CampaignRecipient.updateOne({ _id: recipient._id }, { $unset: { deliveredAt: 1 } });
  const legacyAnalytics = await CampaignService.getAnalytics(campaign._id);
  assert.equal(legacyAnalytics.delivered, 1);
});

test('SMTP accepted recipients are matched case-insensitively', () => {
  assert.equal(isRecipientAccepted({ accepted: ['Reader@Example.com'] }, 'reader@example.com'), true);
  assert.equal(isRecipientAccepted({ accepted: [], rejected: ['reader@example.com'] }, 'reader@example.com'), false);
  assert.equal(isRecipientAccepted({ messageId: 'compatible-provider' }, 'reader@example.com'), true);
});
