const Subscription = require('../models/subscription.model');
const Payment = require('../models/payment.model');
const Plan = require('../models/plan.model');
const User = require('../models/user.model');
const PlanService = require('./plan.services');
const EntitlementService = require('./entitlement.services');
const mongoose = require('mongoose');

const ACTIVE_STATUSES = ['trial', 'active', 'past_due', 'paused'];
const SUPERSEDED_STATUSES = ['pending', ...ACTIVE_STATUSES];
const ASSIGNABLE_STATUSES = ['active', 'trial'];

const serviceError = (message, status) => Object.assign(new Error(message), { status });

const SubscriptionService = {
  getUserSubscription: async (userId) => {
    return Subscription.findOne({ userId, status: { $in: ACTIVE_STATUSES } })
      .populate('planId')
      .sort({ createdAt: -1 });
  },

  getUserPayments: async (userId, page = 1, limit = 10) => {
    return Payment.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('planId');
  },

  listActivePlans: async () => {
    return PlanService.listPublicPlans();
  },

  getUsageSummary: async (userId) => {
    return EntitlementService.getUsageSummary(userId);
  },

  getEntitlementRegistry: () => EntitlementService.getRegistry(),

  createSubscriptionWithSnapshot: async (data) => {
    const plan = await Plan.findById(data.planId);
    if (!plan) throw new Error('Plan not found');
    if (plan.status !== 'active') throw new Error('Plan is not available for subscription');

    const snapshot = PlanService.snapshotPlan(plan);
    return Subscription.create({
      ...data,
      planSnapshot: snapshot,
    });
  },

  assignPlanToUser: async (userId, planId, status = 'active', options = {}) => {
    if (!ASSIGNABLE_STATUSES.includes(status)) {
      throw serviceError('Subscription status must be active or trial', 400);
    }
    if (!mongoose.isValidObjectId(userId)) {
      throw serviceError('Invalid user ID', 400);
    }
    if (!mongoose.isValidObjectId(planId)) {
      throw serviceError('Invalid plan ID', 400);
    }

    const [user, plan] = await Promise.all([
      User.findById(userId).select('_id'),
      Plan.findById(planId),
    ]);
    if (!user) throw serviceError('User not found', 404);
    if (!plan) throw serviceError('Plan not found', 404);
    if (plan.status !== 'active') {
      throw serviceError('Plan is not active', 400);
    }

    if (options.paymentProvider === 'manual') {
      const activePayPal = await Subscription.exists({
        userId,
        status: { $in: ACTIVE_STATUSES },
        paymentProvider: 'paypal',
        externalSubscriptionId: { $ne: '' },
      });
      if (activePayPal) {
        throw serviceError(
          "Cancel the user's active PayPal subscription before assigning a plan manually",
          409
        );
      }
    }

    const sub = new Subscription({
      userId,
      planId: plan._id,
      status,
      startDate: new Date(),
      paymentProvider: options.paymentProvider || '',
      planSnapshot: PlanService.snapshotPlan(plan),
      trialEndsAt: status === 'trial' && plan.trialDays > 0
        ? new Date(Date.now() + plan.trialDays * 86400000)
        : null,
    });
    await sub.validate();

    const supersededAt = new Date();
    await Subscription.updateMany(
      { userId, status: { $in: SUPERSEDED_STATUSES } },
      { $set: { status: 'cancelled', cancelledAt: supersededAt } }
    );

    await sub.save();

    await PlanService.updateSubscriberCounts();
    return sub.populate('planId');
  },
};

module.exports = SubscriptionService;
