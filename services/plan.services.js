const Plan = require('../models/plan.model');
const Subscription = require('../models/subscription.model');
const {
  REGISTRY,
  ENTITLEMENT_TYPES,
  getDefaultEntitlement,
  getRegistryEntry,
} = require('../config/entitlements.registry');

const buildEntitlementsFromRegistry = (overrides = {}) =>
  REGISTRY.map((entry) => {
    const base = getDefaultEntitlement(entry);
    const custom = overrides[entry.key];
    if (!custom) return base;
    return { ...base, ...custom };
  });

const STARTER_ENTITLEMENTS = {
  contacts: { type: 'limit', enabled: true, limit: 1000, isUnlimited: false },
  lists: { type: 'limit', enabled: true, limit: 5, isUnlimited: false },
  email_sends: { type: 'period_limit', enabled: true, limit: 5000, isUnlimited: false, period: 'monthly' },
  custom_email_templates: { type: 'limit', enabled: true, limit: 5, isUnlimited: false },
  predefined_email_templates: { type: 'limit', enabled: true, isUnlimited: true },
  custom_landing_pages: { type: 'limit', enabled: true, limit: 0, isUnlimited: false },
  predefined_landing_pages: { type: 'limit', enabled: true, isUnlimited: true },
  predefined_popup_templates: { type: 'limit', enabled: true, isUnlimited: true },
  lead_capture_forms: { type: 'limit', enabled: true, limit: 3, isUnlimited: false },
  team_members: { type: 'limit', enabled: true, limit: 1, isUnlimited: false },
  marketing_automation: { type: 'boolean', enabled: false },
  ab_testing: { type: 'boolean', enabled: false },
  advanced_reporting: { type: 'boolean', enabled: true },
  web_event_tracking: { type: 'boolean', enabled: false },
};

const STANDARD_ENTITLEMENTS = {
  contacts: { limit: 10000 },
  lists: { limit: 25 },
  email_sends: { limit: 50000 },
  custom_email_templates: { limit: 25 },
  custom_landing_pages: { limit: 1 },
  lead_capture_forms: { limit: 10 },
  marketing_automation: { type: 'boolean', enabled: true },
  ab_testing: { type: 'boolean', enabled: true },
  advanced_reporting: { type: 'boolean', enabled: true },
  web_event_tracking: { type: 'boolean', enabled: true },
};

const PROFESSIONAL_ENTITLEMENTS = {
  contacts: { limit: 50000 },
  lists: { isUnlimited: true },
  email_sends: { limit: 150000 },
  custom_email_templates: { isUnlimited: true },
  custom_landing_pages: { limit: 10 },
  lead_capture_forms: { isUnlimited: true },
  team_members: { limit: 10 },
  marketing_automation: { type: 'boolean', enabled: true },
  ab_testing: { type: 'boolean', enabled: true },
  advanced_reporting: { type: 'boolean', enabled: true },
  web_event_tracking: { type: 'boolean', enabled: true },
  contact_scoring: { type: 'boolean', enabled: true },
  ai_segmentation: { type: 'boolean', enabled: true },
  multi_user_access: { type: 'boolean', enabled: true },
};

const ENTERPRISE_ENTITLEMENTS = {
  contacts: { isUnlimited: true },
  lists: { isUnlimited: true },
  email_sends: { isUnlimited: true },
  custom_email_templates: { isUnlimited: true },
  custom_landing_pages: { isUnlimited: true },
  lead_capture_forms: { isUnlimited: true },
  team_members: { isUnlimited: true },
  marketing_automation: { type: 'boolean', enabled: true },
  ab_testing: { type: 'boolean', enabled: true },
  advanced_reporting: { type: 'boolean', enabled: true },
  web_event_tracking: { type: 'boolean', enabled: true },
  contact_scoring: { type: 'boolean', enabled: true },
  ai_segmentation: { type: 'boolean', enabled: true },
  multi_user_access: { type: 'boolean', enabled: true },
  multi_account: { type: 'boolean', enabled: true },
  custom_objects: { type: 'boolean', enabled: true },
};

const mergeEntitlements = (baseOverrides) => {
  const merged = buildEntitlementsFromRegistry();
  return merged.map((ent) => {
    const o = baseOverrides[ent.key];
    if (!o) return ent;
    return { ...ent, ...o };
  });
};

const PlanService = {
  validatePlanData(data) {
    const errors = [];
    if (!data.name?.trim()) errors.push('Plan name is required');
    if (!data.slug?.trim()) errors.push('Slug is required');
    if (data.monthlyPrice < 0) errors.push('Monthly price cannot be negative');
    if (data.yearlyPrice < 0) errors.push('Yearly price cannot be negative');
    if (data.entitlements) {
      for (const ent of data.entitlements) {
        const reg = getRegistryEntry(ent.key);
        if (!reg) errors.push(`Unknown entitlement key: ${ent.key}`);
        if (ent.type === ENTITLEMENT_TYPES.PERIOD_LIMIT && !ent.period) {
          errors.push(`Period required for ${ent.key}`);
        }
      }
    }
    return errors;
  },

  async seedDefaultPlansIfEmpty() {
    const count = await Plan.countDocuments();
    if (count > 0) return;

    const defaults = [
      {
        name: 'Starter',
        slug: 'starter',
        description: 'For small teams getting started with email marketing.',
        monthlyPrice: 562.5,
        yearlyPrice: 5625,
        currency: 'INR',
        billingInterval: 'monthly',
        displayOrder: 1,
        isPublic: true,
        entitlements: mergeEntitlements(STARTER_ENTITLEMENTS),
      },
      {
        name: 'Standard',
        slug: 'standard',
        description: 'Growing teams with automation needs.',
        monthlyPrice: 1210.5,
        yearlyPrice: 12105,
        currency: 'INR',
        billingInterval: 'monthly',
        displayOrder: 2,
        isMostPopular: true,
        isPublic: true,
        entitlements: mergeEntitlements({ ...STARTER_ENTITLEMENTS, ...STANDARD_ENTITLEMENTS }),
      },
      {
        name: 'Professional',
        slug: 'professional',
        description: 'Advanced marketing for scaling businesses.',
        monthlyPrice: 40212.42,
        yearlyPrice: 402124.2,
        currency: 'INR',
        billingInterval: 'monthly',
        displayOrder: 3,
        isPublic: true,
        entitlements: mergeEntitlements({ ...STARTER_ENTITLEMENTS, ...STANDARD_ENTITLEMENTS, ...PROFESSIONAL_ENTITLEMENTS }),
      },
      {
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'Custom solutions for large organizations.',
        monthlyPrice: 0,
        yearlyPrice: 0,
        currency: 'INR',
        billingInterval: 'custom',
        displayOrder: 4,
        isPublic: true,
        ctaText: 'Contact Sales',
        entitlements: mergeEntitlements({ ...STARTER_ENTITLEMENTS, ...STANDARD_ENTITLEMENTS, ...PROFESSIONAL_ENTITLEMENTS, ...ENTERPRISE_ENTITLEMENTS }),
      },
    ];

    await Plan.insertMany(defaults);
  },

  async listPublicPlans() {
    await this.seedDefaultPlansIfEmpty();
    return Plan.find({ status: 'active', isPublic: true }).sort({ displayOrder: 1 });
  },

  async duplicatePlan(planId) {
    const plan = await Plan.findById(planId);
    if (!plan) throw new Error('Plan not found');
    const slug = `${plan.slug}-copy-${Date.now()}`;
    const copy = await Plan.create({
      name: `${plan.name} Copy`,
      slug,
      description: plan.description,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      currency: plan.currency,
      billingInterval: plan.billingInterval,
      trialDays: plan.trialDays,
      status: 'deactivated',
      isPublic: false,
      isMostPopular: false,
      displayOrder: plan.displayOrder + 1,
      ctaText: plan.ctaText,
      ctaUrl: plan.ctaUrl,
      entitlements: plan.entitlements,
      version: 1,
    });
    return copy;
  },

  async archivePlan(planId) {
    const activeSubs = await Subscription.countDocuments({
      planId,
      status: { $in: ['trial', 'active', 'past_due', 'paused'] },
    });
    const plan = await Plan.findByIdAndUpdate(
      planId,
      { $set: { status: 'archived', isPublic: false } },
      { new: true }
    );
    return { plan, activeSubscriptions: activeSubs };
  },

  async deactivatePlan(planId) {
    return Plan.findByIdAndUpdate(
      planId,
      { $set: { status: 'deactivated', isPublic: false } },
      { new: true }
    );
  },

  async activatePlan(planId) {
    return Plan.findByIdAndUpdate(
      planId,
      { $set: { status: 'active' } },
      { new: true }
    );
  },

  async updateSubscriberCounts() {
    const plans = await Plan.find();
    for (const plan of plans) {
      const count = await Subscription.countDocuments({
        planId: plan._id,
        status: { $in: ['trial', 'active', 'past_due', 'paused'] },
      });
      plan.subscriberCount = count;
      await plan.save();
    }
  },

  snapshotPlan(plan) {
    return {
      planId: plan._id,
      name: plan.name,
      slug: plan.slug,
      version: plan.version,
      entitlements: plan.entitlements.map((e) => ({ ...e.toObject?.() || e })),
      snapshottedAt: new Date(),
    };
  },
};

module.exports = PlanService;
