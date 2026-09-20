process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dashboard-analytics-test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../../app');
const Campaign = require('../../models/campaign.model');
const CampaignEvent = require('../../models/campaignEvent.model');
const CampaignRecipient = require('../../models/campaignRecipient.model');
const Contact = require('../../models/contacts.model');
const FormPopup = require('../../models/formPopup.model');
const Integration = require('../../models/integration.model');
const LandingPage = require('../../models/landingPage.model');
const Lead = require('../../models/lead.model');
const { authHeader } = require('../helpers/auth');
const { seedUsers, signToken } = require('../helpers/seed');
const { connectTestDb, disconnectTestDb, clearCollections } = require('../helpers/setupDb');

let app;

test.before(async () => {
  await connectTestDb();
  app = createApp();
});

test.afterEach(clearCollections);
test.after(disconnectTestDb);

test('dashboard and statistics endpoints return live, isolated user data', async () => {
  const users = await seedUsers();
  const token = signToken(users.customer);
  const now = new Date();

  await Contact.create({ userId: users.customer._id, firstName: 'Ada', email: 'ada@example.com' });
  await Lead.create({
    userId: users.customer._id,
    landingPageId: users.customer._id,
    email: 'lead@example.com',
    source: 'landing-page',
  });
  await Lead.create({
    userId: users.admin._id,
    landingPageId: users.admin._id,
    email: 'other@example.com',
    source: 'landing-page',
  });
  await LandingPage.create({
    userId: users.customer._id,
    name: 'Product page',
    slug: 'dashboard-product-page',
    html: '<h1>Product</h1>',
    status: 'published',
    stats: { views: 10, uniqueViews: 7, leads: 2 },
  });
  await FormPopup.create({
    userId: users.customer._id,
    name: 'Signup popup',
    html: '<form></form>',
    status: 'published',
    stats: { views: 5, uniqueViews: 4, leads: 1 },
  });
  await Integration.create({
    userId: users.customer._id,
    provider: 'mailchimp',
    type: 'leads',
    name: 'Mailchimp',
    config: 'encrypted',
    enabled: true,
    verifiedAt: now,
    lastVerifiedAt: now,
  });

  const campaign = await Campaign.create({
    userId: users.customer._id,
    name: 'Live metrics campaign',
    subject: 'Metrics',
    fromName: 'Marketing',
    fromEmail: 'marketing@example.com',
    templateId: users.customer._id,
    status: 'completed',
    stats: { total: 1, sent: 1, delivered: 1, opened: 1, clicked: 1 },
  });
  const recipient = await CampaignRecipient.create({
    campaignId: campaign._id,
    userId: users.customer._id,
    contactId: users.customer._id,
    email: 'reader@example.com',
    trackingToken: 'dashboard-recipient',
    status: 'clicked',
    sentAt: now,
    deliveredAt: now,
    openedAt: now,
    clickedAt: now,
  });
  await CampaignEvent.create({
    campaignId: campaign._id,
    recipientId: recipient._id,
    event: 'opened',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile',
  });
  await CampaignEvent.create({
    campaignId: campaign._id,
    recipientId: recipient._id,
    event: 'opened',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile',
  });

  const summaryResponse = await request(app)
    .get('/api/dashboard/summary?range=30d')
    .set(authHeader(token))
    .expect(200);
  const summary = summaryResponse.body.data;
  assert.equal(summary.kpis.newLeads.value, 1);
  assert.equal(summary.kpis.contacts.value, 1);
  assert.equal(summary.kpis.campaignsSent.value, 1);
  assert.equal(summary.web.views, 15);
  assert.equal(summary.web.uniqueViews, 11);
  assert.equal(summary.web.conversionRate, 20);
  assert.equal(summary.leadSources[0].source, 'landing-page');
  assert.equal(summary.integrations[0].provider, 'mailchimp');
  assert.equal(summary.performance.reduce((sum, item) => sum + item.sent, 0), 1);

  const statisticsResponse = await request(app)
    .get('/api/dashboard/statistics?range=30d')
    .set(authHeader(token))
    .expect(200);
  const statistics = statisticsResponse.body.data;
  assert.equal(statistics.totals.sent, 1);
  assert.equal(statistics.totals.delivered, 1);
  assert.equal(statistics.totals.opened, 1);
  assert.equal(statistics.totals.clicked, 1);
  assert.equal(statistics.totals.openRate, 100);
  assert.equal(statistics.devices.mobile, 1);
  assert.equal(statistics.topCampaigns[0].name, 'Live metrics campaign');
  assert.equal(statistics.topCampaigns[0].clickRate, 100);
});

test('dashboard analytics require authentication', async () => {
  await request(app).get('/api/dashboard/summary').expect(401);
  await request(app).get('/api/dashboard/statistics').expect(401);
});
