const mongoose = require('mongoose');

const usageCounterSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    resourceKey: { type: String, required: true, index: true },
    period: { type: String, required: true, default: 'lifetime' },
    count: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

usageCounterSchema.index({ userId: 1, resourceKey: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('UsageCounter', usageCounterSchema);
