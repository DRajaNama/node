process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'support-test-secret';

const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../../app');
const SupportTicket = require('../../models/supportTicket.model');
const SupportCategory = require('../../models/supportCategory.model');
const SupportArticle = require('../../models/supportArticle.model');
const { connectTestDb, disconnectTestDb, clearCollections } = require('../helpers/setupDb');
const { seedUsers, signToken } = require('../helpers/seed');
const { authHeader } = require('../helpers/auth');

describe('help center and support tickets', () => {
  let app;
  let users;
  let customerToken;
  let otherCustomerToken;
  let adminToken;

  before(async () => {
    await connectTestDb();
    app = createApp();
  });
  after(async () => disconnectTestDb());

  it('keeps ticket threads owner scoped, hides internal notes, and serves only published knowledge content', async () => {
    await clearCollections();
    users = await seedUsers();
    customerToken = signToken(users.customer);
    otherCustomerToken = signToken(users.admin);
    adminToken = signToken(users.superAdmin);

    const category = await SupportCategory.create({ name: 'Getting started', isActive: true });
    const published = await SupportArticle.create({ title: 'Set up your account', slug: 'set-up-your-account', body: 'Follow these steps to finish setup.', kind: 'article', status: 'published', categoryId: category._id });
    await SupportArticle.create({ title: 'Draft answer', slug: 'draft-answer', body: 'This is not public yet.', kind: 'faq', status: 'draft' });

    const help = await request(app).get('/api/support/overview').set(authHeader(customerToken));
    assert.equal(help.status, 200);
    assert.ok(help.body.data.articles.some((article) => article._id === published.id));
    assert.equal(help.body.data.articles.some((article) => article.slug === 'draft-answer'), false);
    assert.ok(help.body.data.articles.some((article) => article.slug === 'email-consent-and-unsubscribe-responsibilities'));
    assert.ok(help.body.data.categories.some((item) => item.name === 'Legal & Compliance'));
    const categoryAdmin = await request(app).get('/api/admin/support/categories').set(authHeader(adminToken));
    assert.equal(categoryAdmin.status, 200);
    assert.equal(categoryAdmin.body.data[0].name, 'Getting started');
    const vote = await request(app).post(`/api/support/articles/${published.id}/feedback`).set(authHeader(customerToken)).send({ helpful: true });
    assert.equal(vote.status, 200);
    assert.equal(vote.body.data.helpfulYes, 1);

    const created = await request(app).post('/api/support/tickets').set(authHeader(customerToken)).send({
      subject: 'Need help with onboarding', message: 'I cannot finish the onboarding checklist.', issueType: 'technical', categoryId: category.id,
    });
    assert.equal(created.status, 201);
    assert.match(created.body.data.ticketNumber, /^SUP-/);
    const customerNotifications = await request(app).get('/api/notifications').set(authHeader(customerToken));
    const adminNotifications = await request(app).get('/api/notifications').set(authHeader(adminToken));
    assert.ok(customerNotifications.body.data.notifications.some((notification) => notification.title === 'Support request received'));
    assert.ok(adminNotifications.body.data.notifications.some((notification) => notification.title === 'New support request'));
    const ticketId = created.body.data._id;

    const assignment = await request(app).put(`/api/admin/support/${ticketId}`).set(authHeader(adminToken)).send({ assignedTo: users.admin._id });
    assert.equal(assignment.status, 200);
    const assignedNotifications = await request(app).get('/api/notifications').set(authHeader(otherCustomerToken));
    assert.ok(assignedNotifications.body.data.notifications.some((notification) => notification.title === 'Support ticket assigned to you'));

    const otherUserRead = await request(app).get(`/api/support/tickets/${ticketId}`).set(authHeader(otherCustomerToken));
    assert.equal(otherUserRead.status, 404);
    const customerAdminAccess = await request(app).get('/api/admin/support').set(authHeader(customerToken));
    assert.equal(customerAdminAccess.status, 403);

    const customerReply = await request(app).post(`/api/support/tickets/${ticketId}/messages`).set(authHeader(customerToken)).send({ message: 'I tried this again and still need help.' });
    assert.equal(customerReply.status, 200);
    const adminReplyNotifications = await request(app).get('/api/notifications').set(authHeader(adminToken));
    assert.ok(adminReplyNotifications.body.data.notifications.some((notification) => notification.title === 'Customer replied to a ticket'));

    const internal = await request(app).post(`/api/admin/support/${ticketId}/messages`).set(authHeader(adminToken)).send({ message: 'Check the account settings before reply.', isInternal: true });
    assert.equal(internal.status, 200);
    const publicReply = await request(app).post(`/api/admin/support/${ticketId}/messages`).set(authHeader(adminToken)).send({ message: 'Please try refreshing your onboarding page.', isInternal: false });
    assert.equal(publicReply.status, 200);

    const customerView = await request(app).get(`/api/support/tickets/${ticketId}`).set(authHeader(customerToken));
    assert.equal(customerView.status, 200);
    assert.equal(customerView.body.data.messages.length, 3);
    assert.equal(customerView.body.data.messages.some((message) => message.isInternal), false);
    assert.equal(customerView.body.data.status, 'waiting_for_user');
    const updatedCustomerNotifications = await request(app).get('/api/notifications').set(authHeader(customerToken));
    assert.ok(updatedCustomerNotifications.body.data.notifications.some((notification) => notification.title === 'Support replied to your ticket'));

    const adminView = await request(app).get(`/api/admin/support/${ticketId}`).set(authHeader(adminToken));
    assert.equal(adminView.status, 200);
    assert.equal(adminView.body.data.messages.length, 4);
    assert.equal(adminView.body.data.messages.some((message) => message.isInternal), true);

    const stored = await SupportTicket.findById(ticketId);
    assert.equal(stored.messages.length, 4);
  });
});
