const { before, after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../../app');
const Plan = require('../../models/plan.model');
const { connectTestDb, clearCollections } = require('../helpers/setupDb');
const { seedUsers, signToken } = require('../helpers/seed');
const { authHeader } = require('../helpers/auth');
const { REGISTRY, getDefaultEntitlement } = require('../../config/entitlements.registry');

let app;
let users;

const buildEntitlements = () =>
  REGISTRY.map((entry) => getDefaultEntitlement(entry));

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

describe('plans API integration', () => {
  it('creates, duplicates, deactivates, and archives a plan', async () => {
    const token = signToken(users.superAdmin);
    const slug = `plan-${Date.now()}`;

    const createRes = await request(app)
      .post('/api/admin/plans')
      .set(authHeader(token))
      .send({
        name: 'Integration Plan',
        slug,
        description: 'Test',
        monthlyPrice: 10,
        yearlyPrice: 100,
        status: 'active',
        isPublic: true,
        displayOrder: 1,
        entitlements: buildEntitlements(),
      });
    assert.equal(createRes.status, 200);
    const planId = createRes.body.data._id;

    const listRes = await request(app)
      .get('/api/admin/plans')
      .set(authHeader(token));
    assert.equal(listRes.status, 200);
    assert.ok(listRes.body.data.some((p) => p._id === planId));

    const dupRes = await request(app)
      .post(`/api/admin/plans/${planId}/duplicate`)
      .set(authHeader(token));
    assert.equal(dupRes.status, 200);
    assert.notEqual(dupRes.body.data._id, planId);

    const deactivateRes = await request(app)
      .post(`/api/admin/plans/${planId}/deactivate`)
      .set(authHeader(token));
    assert.equal(deactivateRes.status, 200);
    assert.equal(deactivateRes.body.data.status, 'deactivated');

    const archiveRes = await request(app)
      .post(`/api/admin/plans/${planId}/archive`)
      .set(authHeader(token));
    assert.equal(archiveRes.status, 200);
    assert.equal(archiveRes.body.data.plan.status, 'archived');

    const inDb = await Plan.findById(planId);
    assert.equal(inDb.status, 'archived');
  });
});
