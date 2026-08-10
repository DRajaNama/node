const mongoose = require('mongoose');

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
      enum: ['trial', 'active', 'past_due', 'cancelled', 'expired', 'paused'],
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
    planSnapshot: {
      planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
      name: String,
      slug: String,
      version: Number,
      entitlements: [{
        key: String,
        type: String,
        enabled: Boolean,
        limit: Number,
        isUnlimited: Boolean,
        period: String,
      }],
      snapshottedAt: Date,
    },
  },
  { timestamps: true, versionKey: false }
);

subscriptionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
