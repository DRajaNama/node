const { before, after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../../app');
const { connectTestDb, clearCollections } = require('../helpers/setupDb');
const { seedUsers, signToken } = require('../helpers/seed');
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

describe('security integration', () => {
  it('customer cannot create admin plan', async () => {
    const token = signToken(users.customer);
    const res = await request(app)
      .post('/api/admin/plans')
      .set(authHeader(token))
      .send({ name: 'Hack', slug: 'hack', monthlyPrice: 0, yearlyPrice: 0 });
    assert.equal(res.status, 403);
  });

  it('customer cannot reset theme', async () => {
    const token = signToken(users.customer);
    const res = await request(app)
      .post('/api/admin/settings/theme/reset')
      .set(authHeader(token));
    assert.equal(res.status, 403);
  });

  it('customer cannot create predefined template', async () => {
    const token = signToken(users.customer);
    const res = await request(app)
      .post('/api/admin/predefined-templates')
      .set(authHeader(token))
      .send({ name: 'X', slug: 'x', type: 'email' });
    assert.equal(res.status, 403);
  });
});
