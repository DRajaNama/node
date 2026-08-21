const mongoose = require('mongoose');

const entitlementSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    type: { type: String, enum: ['boolean', 'limit', 'period_limit'], required: true },
    enabled: { type: Boolean, default: false },
    limit: { type: Number, default: null },
    isUnlimited: { type: Boolean, default: false },
    period: { type: String, enum: ['monthly', 'yearly', 'lifetime', null], default: null },
  },
  { _id: false }
);

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    monthlyPrice: { type: Number, default: 0 },
    yearlyPrice: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    billingInterval: { type: String, enum: ['monthly', 'yearly', 'custom'], default: 'monthly' },
    trialDays: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'deactivated', 'archived'], default: 'active', index: true },
    isPublic: { type: Boolean, default: true },
    isMostPopular: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    ctaText: { type: String, default: 'Get Started' },
    ctaUrl: { type: String, default: '' },
    entitlements: [entitlementSchema],
    version: { type: Number, default: 1 },
    subscriberCount: { type: Number, default: 0 },
    paypalPlanId: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false }
);

planSchema.index({ status: 1, isPublic: 1, displayOrder: 1 });

module.exports = mongoose.model('Plan', planSchema);
