const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const AdminService = require('../services/admin.services');
const AuditLogService = require('../services/auditLog.services');
const UserService = require('../services/user.services');
const { getEffectivePermissions } = require('../config/permissionsRuntime');

const audit = async (req, action, resource, resourceId, metadata) => {
  try {
    await AuditLogService.create({
      userId: req.userId,
      action,
      resource,
      resourceId,
      metadata,
      ip: req.ip,
    });
  } catch (e) {
    logger.error('Audit log failed', e);
  }
};

const parsePage = (query) => ({
  page: parseInt(query.page, 10) || 1,
  limit: parseInt(query.limit, 10) || 10,
});

const listHandler = async (req, res, modelFn, searchFields, resource) => {
  try {
    const { page, limit } = parsePage(req.query);
    let filter = {};
    if (req.query.search) {
      filter = AdminService.buildResourceFilter(req.query.search, searchFields);
    }
    if (req.query.status) filter.status = req.query.status;
    const data = await modelFn(filter, page, limit);
    const total = await modelFn({ ...filter, countOnly: true }, page, limit);
    res.send({ data, message: Message.SUCCESS, meta: { page, limit, total } });
  } catch (error) {
    logger.error(`Admin list ${resource} error`, error);
    res.status(500).send({ data: null, message: Message.SERVER_ERROR });
  }
};

const AdminController = {
  getDashboardStats: async (req, res) => {
    try {
      const data = await AdminService.getDashboardStats();
      res.send({ data, message: 'Admin dashboard stats loaded' });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getAnalytics: async (req, res) => {
    try {
      const data = await AdminService.getAnalytics();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getPermissions: async (req, res) => {
    try {
      const data = AdminService.getPermissions();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getRoles: async (req, res) => {
    try {
      const { rolePermissions, permissions } = AdminService.getPermissions();
      const roles = ['user', 'admin', 'super_admin'].map((role) => ({
        name: role,
        permissions: getEffectivePermissions(role),
        isSystem: true,
        editable: role !== 'super_admin',
      }));
      res.send({ data: { roles, allPermissions: permissions, rolePermissions }, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  updateRolePermissions: async (req, res) => {
    try {
      const data = await AdminService.updateRolePermissions(req.params.role, req.body.permissions);
      await audit(req, 'Role Permissions Updated', 'Role', req.params.role, { permissions: data.permissions });
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  getRoleStats: async (req, res) => {
    try {
      const data = await AdminService.getRoleStats();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getPlanStats: async (req, res) => {
    try {
      const data = await AdminService.getPlanStats();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getCouponStats: async (req, res) => {
    try {
      const data = await AdminService.getCouponStats();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getCampaignStats: async (req, res) => {
    try {
      const data = await AdminService.getCampaignStats();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getLogStats: async (req, res) => {
    try {
      const data = await AdminService.getLogStats();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getBlogStats: async (req, res) => {
    try {
      const data = await AdminService.getBlogStats();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getNotificationStats: async (req, res) => {
    try {
      const data = await AdminService.getNotificationStats();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getSupportStats: async (req, res) => {
    try {
      const data = await AdminService.getSupportStats();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  verifyUserEmail: async (req, res) => {
    try {
      const user = await AdminService.verifyUserEmail(req.params.id);
      await audit(req, 'Email Verified', 'User', user._id);
      res.send({ data: user, message: Message.USER_UPDATED });
    } catch (error) {
      res.status(404).send({ data: null, message: error.message || Message.USER_NOT_FOUND });
    }
  },

  updateUserPermissions: async (req, res) => {
    try {
      const user = await UserService.findUserById(req.params.id);
      if (!user) return res.status(404).send({ data: null, message: Message.USER_NOT_FOUND });
      user.permissions = req.body.permissions || [];
      await user.save();
      await audit(req, 'Permission Changed', 'User', user._id, { permissions: user.permissions });
      res.send({ data: user, message: Message.USER_UPDATED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  listCampaigns: (req, res) =>
    listHandler(req, res, AdminService.listCampaigns, ['name', 'subject', 'fromEmail'], 'campaigns'),

  listTemplates: (req, res) =>
    listHandler(req, res, AdminService.listTemplates, ['title', 'description'], 'templates'),

  listContacts: (req, res) =>
    listHandler(req, res, AdminService.listContacts, ['firstName', 'lastName', 'email', 'mobile'], 'contacts'),

  listLandingPages: (req, res) =>
    listHandler(req, res, AdminService.listLandingPages, ['name', 'slug'], 'landing-pages'),

  listLeads: (req, res) =>
    listHandler(req, res, AdminService.listLeads, ['email', 'firstName', 'lastName'], 'leads'),

  listPlans: async (req, res) => {
    try {
      const { page, limit } = parsePage(req.query);
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      const data = await AdminService.listPlans(filter, page, limit);
      const total = await AdminService.listPlans({ ...filter, countOnly: true }, page, limit);
      res.send({ data, message: Message.SUCCESS, meta: { page, limit, total } });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getEntitlementRegistry: async (req, res) => {
    try {
      const EntitlementService = require('../services/entitlement.services');
      res.send({ data: EntitlementService.getRegistry(), message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  createPlan: async (req, res) => {
    try {
      const data = await AdminService.createPlan(req.body);
      await audit(req, 'Plan Created', 'Plan', data._id);
      res.send({ data, message: Message.RECODE_CREATED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  updatePlan: async (req, res) => {
    try {
      const data = await AdminService.updatePlan(req.params.id, req.body);
      await audit(req, 'Plan Updated', 'Plan', req.params.id);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  duplicatePlan: async (req, res) => {
    try {
      const data = await AdminService.duplicatePlan(req.params.id);
      await audit(req, 'Plan Duplicated', 'Plan', data._id, { sourceId: req.params.id });
      res.send({ data, message: Message.RECODE_CREATED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  archivePlan: async (req, res) => {
    try {
      const result = await AdminService.archivePlan(req.params.id);
      await audit(req, 'Plan Archived', 'Plan', req.params.id);
      res.send({ data: result, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  deactivatePlan: async (req, res) => {
    try {
      const data = await AdminService.deactivatePlan(req.params.id);
      await audit(req, 'Plan Deactivated', 'Plan', req.params.id);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  activatePlan: async (req, res) => {
    try {
      const data = await AdminService.activatePlan(req.params.id);
      await audit(req, 'Plan Activated', 'Plan', req.params.id);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  deletePlan: async (req, res) => {
    try {
      await AdminService.deletePlan(req.params.id);
      await audit(req, 'Plan Deleted', 'Plan', req.params.id);
      res.send({ data: null, message: Message.USER_DELETED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  listSubscriptions: async (req, res) => {
    try {
      const { page, limit } = parsePage(req.query);
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      const data = await AdminService.listSubscriptions(filter, page, limit);
      const total = await AdminService.listSubscriptions({ ...filter, countOnly: true }, page, limit);
      res.send({ data, message: Message.SUCCESS, meta: { page, limit, total } });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  createSubscription: async (req, res) => {
    try {
      const data = await AdminService.createSubscription(req.body);
      await audit(req, 'Subscription Created', 'Subscription', data._id);
      res.send({ data, message: Message.RECODE_CREATED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  updateSubscription: async (req, res) => {
    try {
      const data = await AdminService.updateSubscription(req.params.id, req.body);
      await audit(req, 'Subscription Changed', 'Subscription', req.params.id);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  listPayments: async (req, res) => {
    try {
      const { page, limit } = parsePage(req.query);
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      const data = await AdminService.listPayments(filter, page, limit);
      const total = await AdminService.listPayments({ ...filter, countOnly: true }, page, limit);
      res.send({ data, message: Message.SUCCESS, meta: { page, limit, total } });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  createPayment: async (req, res) => {
    try {
      const data = await AdminService.createPayment(req.body);
      await audit(req, 'Payment Created', 'Payment', data._id);
      res.send({ data, message: Message.RECODE_CREATED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  updatePayment: async (req, res) => {
    try {
      const data = await AdminService.updatePayment(req.params.id, req.body);
      await audit(req, 'Payment Changed', 'Payment', req.params.id);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  refundPayment: async (req, res) => {
    try {
      const data = await AdminService.refundPayment(req.params.id);
      await audit(req, 'Payment Refunded', 'Payment', req.params.id);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  listCoupons: async (req, res) => {
    try {
      const { page, limit } = parsePage(req.query);
      const data = await AdminService.listCoupons({}, page, limit);
      const total = await AdminService.listCoupons({ countOnly: true }, page, limit);
      res.send({ data, message: Message.SUCCESS, meta: { page, limit, total } });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  createCoupon: async (req, res) => {
    try {
      const data = await AdminService.createCoupon(req.body);
      res.send({ data, message: Message.RECODE_CREATED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  updateCoupon: async (req, res) => {
    try {
      const data = await AdminService.updateCoupon(req.params.id, req.body);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  deleteCoupon: async (req, res) => {
    try {
      await AdminService.deleteCoupon(req.params.id);
      res.send({ data: null, message: Message.USER_DELETED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getSystemSettings: async (req, res) => {
    try {
      const data = await AdminService.getSystemSettings();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  updateSystemSettings: async (req, res) => {
    try {
      const data = await AdminService.updateSystemSettings(req.body);
      await audit(req, 'Settings Changed', 'SystemSettings', 'global');
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  testSystemSmtp: async (req, res) => {
    try {
      const data = await AdminService.testSystemSmtp();
      res.send({ data, message: 'SMTP connection verified' });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  listBlogPosts: async (req, res) => {
    try {
      const { page, limit } = parsePage(req.query);
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      if (req.query.search) {
        Object.assign(filter, AdminService.buildResourceFilter(req.query.search, ['title', 'excerpt']));
      }
      const data = await AdminService.listBlogPosts(filter, page, limit);
      const total = await AdminService.listBlogPosts({ ...filter, countOnly: true }, page, limit);
      res.send({ data, message: Message.SUCCESS, meta: { page, limit, total } });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  createBlogPost: async (req, res) => {
    try {
      req.body.authorId = req.userId;
      const data = await AdminService.createBlogPost(req.body);
      await audit(req, 'Blog Published', 'BlogPost', data._id, { status: data.status });
      res.send({ data, message: Message.RECODE_CREATED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  updateBlogPost: async (req, res) => {
    try {
      const data = await AdminService.updateBlogPost(req.params.id, req.body);
      await audit(req, 'Blog Updated', 'BlogPost', req.params.id);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  deleteBlogPost: async (req, res) => {
    try {
      await AdminService.deleteBlogPost(req.params.id);
      res.send({ data: null, message: Message.USER_DELETED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  listBlogCategories: async (req, res) => {
    try {
      const data = await AdminService.listBlogCategories();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  createBlogCategory: async (req, res) => {
    try {
      const data = await AdminService.createBlogCategory(req.body);
      res.send({ data, message: Message.RECODE_CREATED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  listNotificationTemplates: async (req, res) => {
    try {
      const data = await AdminService.listNotificationTemplates();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  createNotificationTemplate: async (req, res) => {
    try {
      const data = await AdminService.createNotificationTemplate(req.body);
      res.send({ data, message: Message.RECODE_CREATED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  updateNotificationTemplate: async (req, res) => {
    try {
      const data = await AdminService.updateNotificationTemplate(req.params.id, req.body);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  deleteNotificationTemplate: async (req, res) => {
    try {
      await AdminService.deleteNotificationTemplate(req.params.id);
      res.send({ data: null, message: Message.USER_DELETED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  listAuditLogs: async (req, res) => {
    try {
      const { page, limit } = parsePage(req.query);
      const filter = {};
      if (req.query.action) filter.action = { $regex: req.query.action, $options: 'i' };
      if (req.query.resource) filter.resource = req.query.resource;
      const data = await AuditLogService.list(filter, page, limit);
      const total = await AuditLogService.list({ ...filter, countOnly: true }, page, limit);
      res.send({ data, message: Message.SUCCESS, meta: { page, limit, total } });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  listSupportTickets: async (req, res) => {
    try {
      const { page, limit } = parsePage(req.query);
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      const data = await AdminService.listSupportTickets(filter, page, limit);
      const total = await AdminService.listSupportTickets({ ...filter, countOnly: true }, page, limit);
      res.send({ data, message: Message.SUCCESS, meta: { page, limit, total } });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  updateSupportTicket: async (req, res) => {
    try {
      const data = await AdminService.updateSupportTicket(req.params.id, req.body);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getSmtpProviders: async (req, res) => {
    try {
      const data = await AdminService.getSmtpProviders();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getEmailVerificationStats: async (req, res) => {
    try {
      const data = await AdminService.getEmailVerificationStats();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getQueueStats: async (req, res) => {
    try {
      const data = await AdminService.getQueueStats();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getSecuritySettings: async (req, res) => {
    try {
      const settings = await AdminService.getSystemSettings();
      res.send({ data: settings.security || {}, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getThemeSettings: async (req, res) => {
    try {
      const data = await AdminService.getThemeSettings();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  updateThemeSettings: async (req, res) => {
    try {
      const data = await AdminService.updateThemeSettings(req.body);
      await audit(req, 'Theme Changed', 'SystemSettings', 'global');
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  resetThemeSettings: async (req, res) => {
    try {
      const data = await AdminService.resetThemeSettings();
      await audit(req, 'Theme Reset', 'SystemSettings', 'global');
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },
};

module.exports = AdminController;
