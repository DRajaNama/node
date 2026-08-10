const Plan = require('../models/plan.model');
const Subscription = require('../models/subscription.model');
const UsageService = require('./usage.services');
const QuotaExceededError = require('../helpers/quotaError');
const {
  REGISTRY,
  ENTITLEMENT_TYPES,
  RESOURCE_KEYS,
  getRegistryEntry,
} = require('../config/entitlements.registry');

const ACTIVE_STATUSES = ['trial', 'active', 'past_due', 'paused'];

const resolveEntitlements = (plan) => {
  if (!plan) return [];
  if (plan.planSnapshot?.entitlements?.length) return plan.planSnapshot.entitlements;
  if (plan.entitlements?.length) return plan.entitlements;
  return [];
};

const findEntitlement = (entitlements, key) =>
  entitlements.find((e) => e.key === key);

const isUnlimited = (ent) => ent?.isUnlimited === true;

const getLimitValue = (ent) => {
  if (!ent) return 0;
  if (ent.type === ENTITLEMENT_TYPES.BOOLEAN) return ent.enabled ? Infinity : 0;
  if (isUnlimited(ent)) return Infinity;
  return typeof ent.limit === 'number' ? ent.limit : 0;
};

const EntitlementService = {
  getTenantId: (userId) => userId,

  async getCurrentSubscription(userId) {
    return Subscription.findOne({
      userId,
      status: { $in: ACTIVE_STATUSES },
    })
      .populate('planId')
      .sort({ createdAt: -1 });
  },

  async getCurrentPlan(userId) {
    const sub = await this.getCurrentSubscription(userId);
    if (!sub) return null;
    if (sub.planSnapshot?.entitlements) {
      return {
        _id: sub.planId?._id || sub.planSnapshot.planId,
        name: sub.planSnapshot.name,
        slug: sub.planSnapshot.slug,
        entitlements: sub.planSnapshot.entitlements,
        fromSnapshot: true,
      };
    }
    return sub.planId;
  },

  async getEffectiveEntitlements(userId) {
    const plan = await this.getCurrentPlan(userId);
    if (!plan) return [];
    return resolveEntitlements(plan);
  },

  async getPlanEntitlement(userId, key) {
    const entitlements = await this.getEffectiveEntitlements(userId);
    return findEntitlement(entitlements, key);
  },

  async hasFeature(userId, featureKey) {
    const ent = await this.getPlanEntitlement(userId, featureKey);
    if (!ent) return false;
    return ent.type === ENTITLEMENT_TYPES.BOOLEAN && ent.enabled === true;
  },

  async getLimit(userId, resourceKey) {
    const ent = await this.getPlanEntitlement(userId, resourceKey);
    return getLimitValue(ent);
  },

  async getUsage(userId, resourceKey) {
    const ent = await this.getPlanEntitlement(userId, resourceKey);
    const period =
      ent?.type === ENTITLEMENT_TYPES.PERIOD_LIMIT
        ? UsageService.getBillingPeriod()
        : 'lifetime';
    return UsageService.getUsage(userId, resourceKey, period);
  },

  async canCreate(userId, resourceKey, quantity = 1) {
    const limit = await this.getLimit(userId, resourceKey);
    if (limit === Infinity) return true;
    const usage = await this.getUsage(userId, resourceKey);
    return usage + quantity <= limit;
  },

  async checkLimit(userId, resourceKey, quantity = 1) {
    const entry = getRegistryEntry(resourceKey);
    if (entry && !entry.enforceOnCreate) return true;

    const limit = await this.getLimit(userId, resourceKey);
    if (limit === Infinity) return true;

    const usage = await this.getUsage(userId, resourceKey);
    const remaining = Math.max(0, limit - usage);

    if (usage + quantity > limit) {
      const plan = await this.getCurrentPlan(userId);
      const upgrade = await this.getRecommendedUpgradePlan(userId, resourceKey);
      throw new QuotaExceededError(
        `Plan limit reached for ${entry?.label || resourceKey}. You can add ${remaining} more.`,
        {
          resourceKey,
          label: entry?.label || resourceKey,
          usage,
          limit,
          remaining,
          requested: quantity,
          currentPlan: plan ? { id: plan._id, name: plan.name, slug: plan.slug } : null,
          recommendedPlan: upgrade,
        }
      );
    }
    return true;
  },

  async checkFeature(userId, featureKey) {
    const enabled = await this.hasFeature(userId, featureKey);
    if (!enabled) {
      const entry = getRegistryEntry(featureKey);
      const plan = await this.getCurrentPlan(userId);
      const upgrade = await this.getRecommendedUpgradePlan(userId, featureKey);
      throw new QuotaExceededError(
        `${entry?.label || featureKey} is not available on your current plan.`,
        {
          resourceKey: featureKey,
          label: entry?.label || featureKey,
          feature: true,
          currentPlan: plan ? { id: plan._id, name: plan.name, slug: plan.slug } : null,
          recommendedPlan: upgrade,
        }
      );
    }
    return true;
  },

  async recordEmailSends(userId, count) {
    const period = UsageService.getBillingPeriod();
    return UsageService.incrementCounter(userId, RESOURCE_KEYS.EMAIL_SENDS, period, count);
  },

  async checkEmailSendQuota(userId, recipientCount) {
    return this.checkLimit(userId, RESOURCE_KEYS.EMAIL_SENDS, recipientCount);
  },

  async getUsageSummary(userId) {
    const plan = await this.getCurrentPlan(userId);
    const entitlements = resolveEntitlements(plan || {});
    const summary = [];

    for (const ent of entitlements) {
      if (ent.type === ENTITLEMENT_TYPES.BOOLEAN) {
        summary.push({
          key: ent.key,
          label: getRegistryEntry(ent.key)?.label || ent.key,
          category: 'feature',
          enabled: ent.enabled,
        });
        continue;
      }
      const usage = await this.getUsage(userId, ent.key);
      const limit = getLimitValue(ent);
      const percent = limit === Infinity ? null : limit > 0 ? Math.round((usage / limit) * 100) : 0;
      summary.push({
        key: ent.key,
        label: getRegistryEntry(ent.key)?.label || ent.key,
        category: 'resource',
        usage,
        limit: limit === Infinity ? null : limit,
        isUnlimited: isUnlimited(ent),
        percent,
        period: ent.period || null,
        warning: percent !== null && percent >= 80,
      });
    }

    return {
      plan: plan
        ? { id: plan._id, name: plan.name, slug: plan.slug }
        : null,
      entitlements: summary,
    };
  },

  async getRecommendedUpgradePlan(userId, resourceKey) {
    const current = await this.getCurrentSubscription(userId);
    const currentPlan = current?.planId;
    const currentOrder = currentPlan?.displayOrder ?? 0;
    const usage = await this.getUsage(userId, resourceKey);
    const currentLimit = await this.getLimit(userId, resourceKey);

    const candidates = await Plan.find({
      status: 'active',
      isPublic: true,
      displayOrder: { $gt: currentOrder },
    }).sort({ displayOrder: 1 });

    for (const plan of candidates) {
      const planEnt = findEntitlement(plan.entitlements, resourceKey);
      const planLimit = getLimitValue(planEnt);
      if (planLimit === Infinity || planLimit > currentLimit || planLimit > usage) {
        return {
          id: plan._id,
          name: plan.name,
          slug: plan.slug,
          monthlyPrice: plan.monthlyPrice,
          currency: plan.currency,
        };
      }
    }
    return null;
  },

  getRegistry: () => REGISTRY,
};

module.exports = EntitlementService;
