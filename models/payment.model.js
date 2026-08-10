const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      index: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    provider: { type: String, default: 'manual' },
    transactionId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['paid', 'pending', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paidAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, versionKey: false }
);

paymentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
