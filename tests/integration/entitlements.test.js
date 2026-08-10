const { before, after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../../app');
const Contact = require('../../models/contacts.model');
const { connectTestDb, clearCollections } = require('../helpers/setupDb');
const {
  seedUsers,
  seedLimitedContactPlan,
  assignPlan,
  signToken,
} = require('../helpers/seed');
const { authHeader } = require('../helpers/auth');

let app;
let users;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
  await connectTestDb();
  app = createApp();
});

beforeEach(async () => {
  await clearCollections();
  users = await seedUsers();
});

const contactPayload = (email) => ({
  firstName: 'Test',
  lastName: 'User',
  email,
  mobile: '9999999999',
});

describe('entitlements integration', () => {
  it('blocks contact create at limit and allows after delete', async () => {
    const plan = await seedLimitedContactPlan(2);
    await assignPlan(users.customer._id, plan._id);
    const token = signToken(users.customer);

    const first = await request(app)
      .post('/api/contact/create')
      .set(authHeader(token))
      .send(contactPayload('one@test.com'));
    assert.equal(first.status, 200);

    const second = await request(app)
      .post('/api/contact/create')
      .set(authHeader(token))
      .send(contactPayload('two@test.com'));
    assert.equal(second.status, 200);

    const third = await request(app)
      .post('/api/contact/create')
      .set(authHeader(token))
      .send(contactPayload('three@test.com'));
    assert.equal(third.status, 403);

    const contact = await Contact.findOne({ email: 'one@test.com', userId: users.customer._id });
    const del = await request(app)
      .delete(`/api/contact/delete/${contact._id}`)
      .set(authHeader(token));
    assert.equal(del.status, 200);

    const retry = await request(app)
      .post('/api/contact/create')
      .set(authHeader(token))
      .send(contactPayload('three@test.com'));
    assert.equal(retry.status, 200);
  });
});
