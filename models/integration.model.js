const mongoose = require('mongoose');

const integrationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, required: true, trim: true, index: true },
    type: { type: String, required: true, enum: ['email', 'crm', 'alert', 'leads', 'other'] },
    name: { type: String, required: true, trim: true },
    config: { type: String, required: true, select: false },
    enabled: { type: Boolean, default: true },
    verifiedAt: { type: Date, required: true },
    lastVerifiedAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false }
);

integrationSchema.index({ userId: 1, provider: 1 }, { unique: true });
integrationSchema.set('toJSON', { transform: (_doc, result) => { delete result.config; delete result.userId; return result; } });

module.exports = mongoose.model('Integration', integrationSchema);