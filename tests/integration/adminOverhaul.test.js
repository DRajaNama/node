const { before, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../../app');
const SystemSettings = require('../../models/systemSettings.model');
const { connectTestDb, clearCollections } = require('../helpers/setupDb');
const { seedUsers, signToken } = require('../helpers/seed');
const { authHeader } = require('../helpers/auth');
const { refreshRolePermissionsFromDb } = require('../../config/permissionsRuntime');

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
  await refreshRolePermissionsFromDb();
});

describe('admin stats integration', () => {
  it('returns dashboard stats with recent activity', async () => {
    const token = signToken(users.superAdmin);
    const res = await request(app)
      .get('/api/admin/dashboard/stats')
      .set(authHeader(token));
    assert.equal(res.status, 200);
    assert.ok(res.body.data?.users?.total >= 3);
    assert.ok(res.body.data?.recent);
  });

  it('returns coupon stats', async () => {
    const token = signToken(users.superAdmin);
    const res = await request(app)
      .get('/api/admin/coupons/stats')
      .set(authHeader(token));
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.data.total, 'number');
  });

  it('returns roles stats', async () => {
    const token = signToken(users.superAdmin);
    const res = await request(app)
      .get('/api/admin/roles/stats')
      .set(authHeader(token));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.totalPermissions > 0);
  });

  it('persists role permissions', async () => {
    const token = signToken(users.superAdmin);
    const perms = ['Users.View', 'Users.Edit'];
    const putRes = await request(app)
      .put('/api/admin/roles/admin/permissions')
      .set(authHeader(token))
      .send({ permissions: perms });
    assert.equal(putRes.status, 200);
    const getRes = await request(app)
      .get('/api/admin/roles')
      .set(authHeader(token));
    assert.ok(getRes.body.data.rolePermissions.admin.includes('Users.View'));
  });
});

describe('maintenance and profile integration', () => {
  it('returns maintenance status publicly', async () => {
    const res = await request(app).get('/api/public/maintenance-status');
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.data.maintenanceMode, 'boolean');
  });

  it('blocks public plans when maintenance enabled', async () => {
    await SystemSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: { security: { maintenanceMode: true } } },
      { upsert: true }
    );
    const res = await request(app).get('/api/public/plans');
    assert.equal(res.status, 503);
    await SystemSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: { security: { maintenanceMode: false } } }
    );
  });

  it('updates profile via PUT /api/me', async () => {
    const token = signToken(users.customer);
    const res = await request(app)
      .put('/api/me')
      .set(authHeader(token))
      .send({ name: 'Updated Name', mobile: '9000000099' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.name, 'Updated Name');
  });
});
