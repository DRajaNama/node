process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'analytics-tracking-test-secret';
process.env.FULL_URL = process.env.FULL_URL || 'http://localhost:3000';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const createApp = require('../../app');
const AnalyticsVisit = require('../../models/analyticsVisit.model');
const Campaign = require('../../models/campaign.model');
const CampaignEvent = require('../../models/campaignEvent.model');
const CampaignRecipient = require('../../models/campaignRecipient.model');
const FormPopup = require('../../models/formPopup.model');
const LandingPage = require('../../models/landingPage.model');
const { injectEmailTracking } = require('../../helpers/template.helper');
const { connectTestDb, disconnectTestDb, clearCollections } = require('../helpers/setupDb');

let app;

test.before(async () => {
  await connectTestDb();
  app = createApp();
});

test.afterEach(async () => {
  await clearCollections();
});

test.after(async () => {
  await disconnectTestDb();
});

test('email tracking injects one open pixel and wraps eligible links', () => {
  const html = injectEmailTracking(
    '<html><body><a href="https://example.com/offer">Offer</a><a href="mailto:test@example.com">Mail</a></body></html>',
    { TRACKTOKEN: 'tracking-token', TRACK_OPEN: true, TRACK_CLICK: true }
  );

  assert.match(html, /\/api\/track\/open\/tracking-token\.png/);
  assert.match(html, /\/api\/track\/click\/tracking-token\?url=https%3A%2F%2Fexample\.com%2Foffer/);
  assert.match(html, /href="mailto:test@example\.com"/);
  assert.equal((html.match(/data-ve-open-tracking/g) || []).length, 1);
});

test('campaign open and click stats count unique recipients while retaining event history', async () => {
  const userId = new mongoose.Types.ObjectId();
  const campaign = await Campaign.create({
    userId,
    name: 'Tracked campaign',
    subject: 'Track me',
    fromName: 'Marketing',
    fromEmail: 'marketing@example.com',
    templateId: new mongoose.Types.ObjectId(),
    type: 'email',
    status: 'completed',
    listIds: [],
    stats: { total: 1, sent: 1 },
  });
  const recipient = await CampaignRecipient.create({
    campaignId: campaign._id,
    userId,
    contactId: new mongoose.Types.ObjectId(),
    email: 'reader@example.com',
    status: 'sent',
    sentAt: new Date(),
    trackingToken: 'unique-engagement-token',
  });

  await request(app).get('/api/track/open/unique-engagement-token.png').expect(200);
  await request(app).get('/api/track/open/unique-engagement-token.png').expect(200);
  await request(app)
    .get('/api/track/click/unique-engagement-token')
    .query({ url: 'https://example.com/offer' })
    .expect(302);
  await request(app)
    .get('/api/track/click/unique-engagement-token')
    .query({ url: 'https://example.com/offer' })
    .expect(302);

  const updatedCampaign = await Campaign.findById(campaign._id).lean();
  const updatedRecipient = await CampaignRecipient.findById(recipient._id).lean();
  assert.equal(updatedCampaign.stats.opened, 1);
  assert.equal(updatedCampaign.stats.clicked, 1);
  assert.ok(updatedRecipient.openedAt);
  assert.ok(updatedRecipient.clickedAt);
  assert.equal(await CampaignEvent.countDocuments({ campaignId: campaign._id, event: 'opened' }), 2);
  assert.equal(await CampaignEvent.countDocuments({ campaignId: campaign._id, event: 'clicked' }), 2);
});

test('landing pages track total and unique visits using an anonymous visitor id', async () => {
  const page = await LandingPage.create({
    userId: new mongoose.Types.ObjectId(),
    name: 'Analytics page',
    slug: 'analytics-page',
    html: '<h1>Analytics</h1>',
    status: 'published',
  });

  await request(app).get('/api/public/landing-page/analytics-page').expect(200);
  await request(app).get('/api/public/landing-page/analytics-page?visitorId=visitor-a').expect(200);
  await request(app).get('/api/public/landing-page/analytics-page?visitorId=visitor-a').expect(200);
  await request(app).get('/api/public/landing-page/analytics-page?visitorId=visitor-b').expect(200);

  const updated = await LandingPage.findById(page._id).lean();
  assert.equal(updated.stats.views, 3);
  assert.equal(updated.stats.uniqueViews, 2);
  assert.equal(await AnalyticsVisit.countDocuments({ resourceId: page._id }), 2);
});

test('form popups track impressions, unique visitors, and manual closes', async () => {
  const popup = await FormPopup.create({
    userId: new mongoose.Types.ObjectId(),
    name: 'Analytics popup',
    html: '<form></form>',
    status: 'published',
  });
  const endpoint = `/api/public/form-popup/${popup._id}/track`;

  const externalView = await request(app)
    .post(endpoint)
    .set('Origin', 'https://customer.example')
    .send({ event: 'view', visitorId: 'visitor-a' })
    .expect(200);
  assert.equal(externalView.headers['access-control-allow-origin'], 'https://customer.example');
  await request(app).post(endpoint).send({ event: 'view', visitorId: 'visitor-a' }).expect(200);
  await request(app).post(endpoint).send({ event: 'view', visitorId: 'visitor-b' }).expect(200);
  await request(app).post(endpoint).send({ event: 'close', visitorId: 'visitor-a' }).expect(200);

  const updated = await FormPopup.findById(popup._id).lean();
  assert.equal(updated.stats.views, 3);
  assert.equal(updated.stats.uniqueViews, 2);
  assert.equal(updated.stats.closes, 1);
});
