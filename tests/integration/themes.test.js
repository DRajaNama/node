const { before, after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../../app');
const { connectTestDb, clearCollections } = require('../helpers/setupDb');
const { seedUsers, signToken } = require('../helpers/seed');
const { authHeader } = require('../helpers/auth');
const { DEFAULT_THEME } = require('../../constants/theme.constants');

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

describe('theme API integration', () => {
  it('GET public theme returns default palette', async () => {
    const res = await request(app).get('/api/public/theme');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.primary, DEFAULT_THEME.primary);
  });

  it('super_admin can update theme', async () => {
    const token = signToken(users.superAdmin);
    const res = await request(app)
      .put('/api/admin/settings/theme')
      .set(authHeader(token))
      .send({ primary: '#111111' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.primary, '#111111');
  });

  it('admin without super_admin cannot update theme', async () => {
    const token = signToken(users.admin);
    const res = await request(app)
      .put('/api/admin/settings/theme')
      .set(authHeader(token))
      .send({ primary: '#222222' });
    assert.equal(res.status, 403);
  });
});
