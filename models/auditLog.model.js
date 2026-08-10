const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    action: { type: String, required: true, index: true },
    resource: { type: String, default: '', index: true },
    resourceId: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
