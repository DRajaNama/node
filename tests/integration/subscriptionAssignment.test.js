const { before, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const createApp = require('../../app');
const Plan = require('../../models/plan.model');
const Subscription = require('../../models/subscription.model');
const PlanService = require('../../services/plan.services');
const PayPalService = require('../../services/paypal.services');
const { connectTestDb, clearCollections } = require('../helpers/setupDb');
const { seedUsers, assignPlan, signToken } = require('../helpers/seed');
const { authHeader } = require('../helpers/auth');

let app;
let users;

const createPlan = (name, status = 'active', overrides = {}) =>
  Plan.create({
    name,
    slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${new mongoose.Types.ObjectId()}`,
    status,
    isPublic: true,
    entitlements: [
      { key: 'contacts', type: 'limit', enabled: true, limit: 100, isUnlimited: false },
    ],
    ...overrides,
  });

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

describe('admin plan assignment', () => {
  it('allows a default admin to assign a plan and supersedes pending and active subscriptions', async () => {
    const [oldPlan, newPlan] = await Promise.all([
      createPlan('Old Plan'),
      createPlan('New Plan'),
    ]);
    const oldSubscription = await assignPlan(users.customer._id, oldPlan._id);
    const pendingSubscription = await Subscription.create({
      userId: users.customer._id,
      planId: newPlan._id,
      status: 'pending',
      paymentProvider: 'paypal',
      planSnapshot: PlanService.snapshotPlan(newPlan),
    });

    const response = await request(app)
      .post('/api/admin/subscriptions')
      .set(authHeader(signToken(users.admin)))
      .send({ userId: users.customer._id, planId: newPlan._id, status: 'active' });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.userId, String(users.customer._id));
    assert.equal(response.body.data.planId._id, String(newPlan._id));
    assert.equal(response.body.data.status, 'active');
    assert.equal(response.body.data.paymentProvider, 'manual');

    const [supersededActive, supersededPending, currentSubscriptions] = await Promise.all([
      Subscription.findById(oldSubscription._id).lean(),
      Subscription.findById(pendingSubscription._id).lean(),
      Subscription.find({
        userId: users.customer._id,
        status: { $in: ['trial', 'active', 'past_due', 'paused'] },
      }).lean(),
    ]);

    assert.equal(supersededActive.status, 'cancelled');
    assert.ok(supersededActive.cancelledAt);
    assert.equal(supersededPending.status, 'cancelled');
    assert.ok(supersededPending.cancelledAt);
    assert.equal(currentSubscriptions.length, 1);
    assert.equal(String(currentSubscriptions[0].planId), String(newPlan._id));
  });

  it('rejects missing users and plans without cancelling the current subscription', async () => {
    const currentPlan = await createPlan('Current Plan');
    const currentSubscription = await assignPlan(users.customer._id, currentPlan._id);
    const missingUserId = new mongoose.Types.ObjectId();
    const missingPlanId = new mongoose.Types.ObjectId();
    const token = signToken(users.admin);

    const missingUserResponse = await request(app)
      .post('/api/admin/subscriptions')
      .set(authHeader(token))
      .send({ userId: missingUserId, planId: currentPlan._id, status: 'active' });
    assert.equal(missingUserResponse.status, 404);
    assert.equal(missingUserResponse.body.message, 'User not found');

    const missingPlanResponse = await request(app)
      .post('/api/admin/subscriptions')
      .set(authHeader(token))
      .send({ userId: users.customer._id, planId: missingPlanId, status: 'active' });
    assert.equal(missingPlanResponse.status, 404);
    assert.equal(missingPlanResponse.body.message, 'Plan not found');

    const unchanged = await Subscription.findById(currentSubscription._id).lean();
    assert.equal(unchanged.status, 'active');
    assert.equal(unchanged.cancelledAt, undefined);
  });

  it('rejects inactive plans and unsupported assignment statuses before superseding', async () => {
    const [currentPlan, inactivePlan] = await Promise.all([
      createPlan('Current Plan'),
      createPlan('Inactive Plan', 'deactivated'),
    ]);
    const currentSubscription = await assignPlan(users.customer._id, currentPlan._id);
    const token = signToken(users.admin);

    const inactivePlanResponse = await request(app)
      .post('/api/admin/subscriptions')
      .set(authHeader(token))
      .send({ userId: users.customer._id, planId: inactivePlan._id, status: 'active' });
    assert.equal(inactivePlanResponse.status, 400);
    assert.equal(inactivePlanResponse.body.message, 'Plan is not active');

    const invalidStatusResponse = await request(app)
      .post('/api/admin/subscriptions')
      .set(authHeader(token))
      .send({ userId: users.customer._id, planId: currentPlan._id, status: 'paused' });
    assert.equal(invalidStatusResponse.status, 400);
    assert.equal(invalidStatusResponse.body.message, 'Subscription status must be active or trial');

    const unchanged = await Subscription.findById(currentSubscription._id).lean();
    assert.equal(unchanged.status, 'active');
    assert.equal(unchanged.cancelledAt, undefined);
  });

  it('does not manually replace an active PayPal subscription', async () => {
    const [paidPlan, manualPlan] = await Promise.all([
      createPlan('Paid Plan'),
      createPlan('Manual Plan'),
    ]);
    const paidSubscription = await Subscription.create({
      userId: users.customer._id,
      planId: paidPlan._id,
      status: 'active',
      paymentProvider: 'paypal',
      externalSubscriptionId: 'I-ACTIVE-SUBSCRIPTION',
      planSnapshot: PlanService.snapshotPlan(paidPlan),
    });

    const response = await request(app)
      .post('/api/admin/subscriptions')
      .set(authHeader(signToken(users.admin)))
      .send({ userId: users.customer._id, planId: manualPlan._id, status: 'active' });

    assert.equal(response.status, 409);
    assert.match(response.body.message, /Cancel the user's active PayPal subscription/);
    const unchanged = await Subscription.findById(paidSubscription._id).lean();
    assert.equal(unchanged.status, 'active');
    assert.equal(String(unchanged.planId), String(paidPlan._id));
  });

  it('revises the existing PayPal subscription when a customer upgrades', async () => {
    const [currentPlan, upgradedPlan] = await Promise.all([
      createPlan('PayPal Starter', 'active', {
        monthlyPrice: 10,
        paypalPlanId: 'P-STARTER',
      }),
      createPlan('PayPal Pro', 'active', {
        monthlyPrice: 25,
        paypalPlanId: 'P-PRO',
      }),
    ]);
    const currentSubscription = await Subscription.create({
      userId: users.customer._id,
      planId: currentPlan._id,
      status: 'active',
      paymentProvider: 'paypal',
      externalSubscriptionId: 'I-CUSTOMER-SUBSCRIPTION',
      planSnapshot: PlanService.snapshotPlan(currentPlan),
    });

    const originalConfig = PayPalService.config;
    const originalGetSubscription = PayPalService.getSubscription;
    PayPalService.config = async () => ({
      clientId: 'test-client-id',
      env: 'sandbox',
    });
    PayPalService.getSubscription = async () => ({
      id: 'I-CUSTOMER-SUBSCRIPTION',
      status: 'ACTIVE',
      plan_id: 'P-PRO',
      billing_info: { next_billing_time: '2026-10-01T00:00:00Z' },
    });

    try {
      const token = signToken(users.customer);
      const prepareResponse = await request(app)
        .post('/api/subscriptions/paypal/create')
        .set(authHeader(token))
        .send({ planId: upgradedPlan._id });

      assert.equal(prepareResponse.status, 200);
      assert.equal(prepareResponse.body.data.mode, 'revise');
      assert.equal(
        prepareResponse.body.data.localSubscriptionId,
        String(currentSubscription._id)
      );
      assert.equal(
        prepareResponse.body.data.paypalSubscriptionId,
        'I-CUSTOMER-SUBSCRIPTION'
      );
      assert.equal(prepareResponse.body.data.paypalPlanId, 'P-PRO');
      assert.equal(await Subscription.countDocuments({ userId: users.customer._id }), 1);

      const verifyResponse = await request(app)
        .post('/api/subscriptions/paypal/verify')
        .set(authHeader(token))
        .send({
          localSubscriptionId: currentSubscription._id,
          subscriptionId: 'I-CUSTOMER-SUBSCRIPTION',
          planId: upgradedPlan._id,
        });

      assert.equal(verifyResponse.status, 200);
      assert.equal(verifyResponse.body.message, 'Subscription upgraded.');
      assert.equal(verifyResponse.body.data._id, String(currentSubscription._id));
      assert.equal(verifyResponse.body.data.planId._id, String(upgradedPlan._id));
      assert.equal(verifyResponse.body.data.planSnapshot.slug, upgradedPlan.slug);
      assert.equal(await Subscription.countDocuments({ userId: users.customer._id }), 1);
    } finally {
      PayPalService.config = originalConfig;
      PayPalService.getSubscription = originalGetSubscription;
    }
  });

  it('activates a first PayPal upgrade and supersedes the previous manual plan', async () => {
    const [currentPlan, paidPlan] = await Promise.all([
      createPlan('Free Starter'),
      createPlan('First Paid Plan', 'active', {
        monthlyPrice: 15,
        paypalPlanId: 'P-FIRST-PAID',
      }),
    ]);
    const currentSubscription = await assignPlan(users.customer._id, currentPlan._id);

    const originalConfig = PayPalService.config;
    const originalGetSubscription = PayPalService.getSubscription;
    PayPalService.config = async () => ({
      clientId: 'test-client-id',
      env: 'sandbox',
    });
    PayPalService.getSubscription = async () => ({
      id: 'I-FIRST-PAID-SUBSCRIPTION',
      status: 'ACTIVE',
      plan_id: 'P-FIRST-PAID',
      start_time: '2026-09-04T00:00:00Z',
      billing_info: { next_billing_time: '2026-10-04T00:00:00Z' },
    });

    try {
      const token = signToken(users.customer);
      const prepareResponse = await request(app)
        .post('/api/subscriptions/paypal/create')
        .set(authHeader(token))
        .send({ planId: paidPlan._id });

      assert.equal(prepareResponse.status, 200);
      assert.equal(prepareResponse.body.data.mode, 'create');

      const verifyResponse = await request(app)
        .post('/api/subscriptions/paypal/verify')
        .set(authHeader(token))
        .send({
          localSubscriptionId: prepareResponse.body.data.localSubscriptionId,
          subscriptionId: 'I-FIRST-PAID-SUBSCRIPTION',
          planId: paidPlan._id,
        });

      assert.equal(verifyResponse.status, 200);
      assert.equal(verifyResponse.body.message, 'Subscription activated.');
      assert.equal(verifyResponse.body.data.planId._id, String(paidPlan._id));
      assert.equal(verifyResponse.body.data.paymentProvider, 'paypal');

      const previous = await Subscription.findById(currentSubscription._id).lean();
      assert.equal(previous.status, 'cancelled');
      assert.ok(previous.cancelledAt);
      assert.equal(
        await Subscription.countDocuments({
          userId: users.customer._id,
          status: { $in: ['trial', 'active', 'past_due', 'paused'] },
        }),
        1
      );
    } finally {
      PayPalService.config = originalConfig;
      PayPalService.getSubscription = originalGetSubscription;
    }
  });
});
