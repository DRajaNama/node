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

const planSnapshotSchema = new mongoose.Schema(
  {
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    name: String,
    slug: String,
    version: Number,
    entitlements: [entitlementSchema],
    snapshottedAt: Date,
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'trial', 'active', 'past_due', 'cancelled', 'expired', 'paused'],
      default: 'trial',
      index: true,
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    renewalDate: { type: Date },
    trialEndsAt: { type: Date },
    cancelledAt: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    paymentProvider: { type: String, default: '' },
    externalSubscriptionId: { type: String, default: '' },
    planSnapshot: planSnapshotSchema,
  },
  { timestamps: true, versionKey: false }
);

subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ paymentProvider: 1, externalSubscriptionId: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
