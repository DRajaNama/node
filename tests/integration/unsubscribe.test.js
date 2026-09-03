process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unsubscribe-integration-test-secret';

const { before, after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../../app');
const Contact = require('../../models/contacts.model');
const Campaign = require('../../models/campaign.model');
const CampaignRecipient = require('../../models/campaignRecipient.model');
const CampaignEvent = require('../../models/campaignEvent.model');
const List = require('../../models/list.model');
const ListContact = require('../../models/listContact.model');
const Lead = require('../../models/lead.model');
const LandingPage = require('../../models/landingPage.model');
const { connectTestDb, disconnectTestDb, clearCollections } = require('../helpers/setupDb');

let app;

describe('public unsubscribe', () => {
  before(async () => {
    await connectTestDb();
    app = createApp();
  });

  after(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  it('suppresses the contact and records unsubscribe events for campaign recipients', async () => {
    const userId = new mongoose.Types.ObjectId();
    const campaign = await Campaign.create({
      userId,
      name: 'Newsletter',
      subject: 'News',
      fromName: 'Example News',
      fromEmail: 'news@example.com',
      templateId: new mongoose.Types.ObjectId()
    });
    const contact = await Contact.create({ userId, email: 'reader@example.com' });
    const landingPage = await LandingPage.create({
      userId,
      name: 'Newsletter Signup',
      slug: 'newsletter-signup',
      html: '<form></form>'
    });
    const lead = await Lead.create({
      userId,
      landingPageId: landingPage._id,
      email: contact.email,
      source: 'landing-page'
    });
    const list = await List.create({ userId, name: 'Readers', contactCount: 1 });
    await ListContact.create({ userId, listId: list._id, contactId: contact._id });
    const recipient = await CampaignRecipient.create({
      campaignId: campaign._id,
      userId,
      contactId: contact._id,
      email: contact.email,
      trackingToken: 'unsubscribe-test-token'
    });

    const response = await request(app).get('/api/public/unsubscribe/READER%40EXAMPLE.COM');

    assert.equal(response.status, 200);
    assert.match(response.text, /You have been unsubscribed/);
    assert.equal((await Contact.findById(contact._id)).isUnsubscribed, true);
    assert.equal((await Contact.findById(contact._id)).status, 'unsubscribed');
    assert.equal((await Lead.findById(lead._id)).isUnsubscribed, true);
    assert.equal((await LandingPage.findById(landingPage._id)).stats.unsubscribed, 1);
    assert.equal((await List.findById(list._id)).contactCount, 1);
    assert.equal((await List.findById(list._id)).unsubscribedCount, 1);
    assert.equal((await CampaignRecipient.findById(recipient._id)).status, 'unsubscribed');
    assert.equal(await CampaignEvent.countDocuments({ recipientId: recipient._id, event: 'unsubscribed' }), 1);

    await request(app).get('/api/public/unsubscribe/reader%40example.com');
    assert.equal(await CampaignEvent.countDocuments({ recipientId: recipient._id, event: 'unsubscribed' }), 1);
    assert.equal((await List.findById(list._id)).unsubscribedCount, 1);
  });

  it('rejects an invalid email address', async () => {
    const response = await request(app).get('/api/public/unsubscribe/not-an-email');

    assert.equal(response.status, 400);
  });
});