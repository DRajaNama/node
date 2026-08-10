const { before, beforeEach, describe, it } = require('node:test');
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

describe('auth integration', () => {
  it('logs in super admin and returns token', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'super@test.com', password: 'password123' });
    assert.equal(res.status, 200);
    assert.ok(res.body.data?.token);
    assert.equal(res.body.data.user.email, 'super@test.com');
  });

  it('returns 401 for invalid credentials', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'super@test.com', password: 'wrong' });
    assert.equal(res.status, 401);
  });

  it('returns 403 when customer hits admin plans list', async () => {
    const token = signToken(users.customer);
    const res = await request(app)
      .get('/api/admin/plans')
      .set(authHeader(token));
    assert.equal(res.status, 403);
  });
});
