const Subscription = require('../models/subscription.model');
const Payment = require('../models/payment.model');
const Plan = require('../models/plan.model');
const PlanService = require('./plan.services');
const EntitlementService = require('./entitlement.services');

const ACTIVE_STATUSES = ['trial', 'active', 'past_due', 'paused'];

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

  assignPlanToUser: async (userId, planId, status = 'active') => {
    const plan = await Plan.findById(planId);
    if (!plan) throw new Error('Plan not found');

    await Subscription.updateMany(
      { userId, status: { $in: ACTIVE_STATUSES } },
      { $set: { status: 'cancelled', cancelledAt: new Date() } }
    );

    const sub = await Subscription.create({
      userId,
      planId: plan._id,
      status,
      startDate: new Date(),
      planSnapshot: PlanService.snapshotPlan(plan),
      trialEndsAt: plan.trialDays > 0 ? new Date(Date.now() + plan.trialDays * 86400000) : null,
    });

    await PlanService.updateSubscriberCounts();
    return sub.populate('planId');
  },
};

module.exports = SubscriptionService;
