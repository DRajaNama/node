const { before, after, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../../app');
const Template = require('../../models/template.model');
const PredefinedTemplate = require('../../models/predefinedTemplate.model');
const TemplateCategory = require('../../models/templateCategory.model');
const { connectTestDb, clearCollections } = require('../helpers/setupDb');
const { seedUsers, signToken, assignPlan } = require('../helpers/seed');
const PlanService = require('../../services/plan.services');
const Plan = require('../../models/plan.model');
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
  await PlanService.seedDefaultPlansIfEmpty();
  const starter = await Plan.findOne({ slug: 'starter' });
  await assignPlan(users.customer._id, starter._id);
});

describe('predefined templates integration', () => {
  it('admin CRUD publish flow and customer visibility', async () => {
    const adminToken = signToken(users.superAdmin);
    const slug = `email-${Date.now()}`;

    const createRes = await request(app)
      .post('/api/admin/predefined-templates')
      .set(authHeader(adminToken))
      .send({
        name: 'Test Email',
        slug,
        type: 'email',
        status: 'draft',
        displayOrder: 1,
        isFeatured: false,
        tags: [],
      });
    assert.equal(createRes.status, 200);
    const id = createRes.body.data._id;

    const customerToken = signToken(users.customer);
    const draftList = await request(app)
      .get('/api/predefined-templates?type=email')
      .set(authHeader(customerToken));
    assert.equal(draftList.status, 200);
    assert.ok(!draftList.body.data.some((t) => t._id === id));

    const publishRes = await request(app)
      .post(`/api/admin/predefined-templates/${id}/publish`)
      .set(authHeader(adminToken));
    assert.equal(publishRes.status, 200);

    const publishedList = await request(app)
      .get('/api/predefined-templates?type=email')
      .set(authHeader(customerToken));
    assert.ok(publishedList.body.data.some((t) => t._id === id));
  });

  it('customer copy stays unchanged when admin edits predefined html', async () => {
    const adminToken = signToken(users.superAdmin);
    const customerToken = signToken(users.customer);
    const slug = `immutable-${Date.now()}`;

    const createRes = await request(app)
      .post('/api/admin/predefined-templates')
      .set(authHeader(adminToken))
      .send({
        name: 'Immutable Test',
        slug,
        type: 'email',
        status: 'published',
        displayOrder: 1,
        html: '<p>Version A</p>',
      });
    const predefinedId = createRes.body.data._id;
    const category = await TemplateCategory.create({ title: 'General' });

    const useRes = await request(app)
      .post(`/api/predefined-templates/${predefinedId}/use`)
      .set(authHeader(customerToken))
      .send({ title: 'My Copy', categoryId: category._id });
    assert.equal(useRes.status, 200);
    const customerTemplateId = useRes.body.data.resource._id;

    await request(app)
      .put(`/api/admin/predefined-templates/${predefinedId}`)
      .set(authHeader(adminToken))
      .send({ html: '<p>Version B</p>' });

    const customerCopy = await Template.findById(customerTemplateId);
    const predefined = await PredefinedTemplate.findById(predefinedId);
    assert.equal(customerCopy.html, '<p>Version A</p>');
    assert.equal(predefined.html, '<p>Version B</p>');
  });
});
