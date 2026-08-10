const AuditLog = require('../models/auditLog.model');

const AuditLogService = {
  create: async ({ userId, action, resource, resourceId, metadata, ip }) => {
    return AuditLog.create({
      userId,
      action,
      resource,
      resourceId: resourceId ? String(resourceId) : '',
      metadata,
      ip: ip || '',
    });
  },

  list: async (filter = {}, page = 1, limit = 20) => {
    const countOnly = filter.countOnly;
    delete filter.countOnly;
    if (countOnly) return AuditLog.countDocuments(filter);
    return AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name email role');
  },
};

module.exports = AuditLogService;
