const User = require('../models/user.model');
const Campaign = require('../models/campaign.model');
const LandingPage = require('../models/landingPage.model');
const Lead = require('../models/lead.model');
const Contact = require('../models/contacts.model');
const Template = require('../models/template.model');
const Plan = require('../models/plan.model');
const PlanService = require('./plan.services');
const Subscription = require('../models/subscription.model');
const Payment = require('../models/payment.model');
const Coupon = require('../models/coupon.model');
const SystemSettings = require('../models/systemSettings.model');
const BlogPost = require('../models/blogPost.model');
const BlogCategory = require('../models/blogCategory.model');
const NotificationTemplate = require('../models/notificationTemplate.model');
const SupportTicket = require('../models/supportTicket.model');
const AuditLog = require('../models/auditLog.model');
const Settings = require('../models/settings.model');
const {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  getEffectivePermissions,
  getRuntimeRolePermissions,
  updateRolePermissions: persistRolePermissions,
} = require('../config/permissionsRuntime');
const emailQueue = require('../queues/email.queue');
const { EMAIL_QUEUE_NAME } = require('../constants/campaign.constants');
const { DEFAULT_THEME, normalizeTheme, validateTheme } = require('../constants/theme.constants');

const paginate = async (model, filter, page = 1, limit = 10, sort = { createdAt: -1 }, populate = '') => {
  const countOnly = filter.countOnly;
  delete filter.countOnly;
  if (countOnly) return model.countDocuments(filter);
  let query = model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit);
  if (populate) query = query.populate(populate);
  return query;
};

const buildSearchFilter = (search, fields) => {
  if (!search) return {};
  return {
    $or: fields.map((field) => ({ [field]: { $regex: search, $options: 'i' } })),
  };
};

const resolveThemeFromSettings = (settings) => {
  const theme = settings?.theme || {};
  const legacy = settings?.branding || {};
  return normalizeTheme({
    primary: theme.primary || legacy.primaryColor,
    secondary: theme.secondary || legacy.secondaryColor,
    background: theme.background,
    accent: theme.accent,
    accentHover: theme.accentHover,
  });
};

const AdminService = {
  getDashboardStats: async () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [
      totalUsers, verifiedUsers, activeUsers, suspendedUsers,
      totalCampaigns, totalLandingPages, totalLeads, totalContacts, totalTemplates,
      totalPlans, activeSubscriptions, totalRevenue, totalBlogPosts, publishedPosts,
      recentUsers, recentCampaigns, recentPayments, recentAuditLogs,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      Campaign.countDocuments(),
      LandingPage.countDocuments(),
      Lead.countDocuments(),
      Contact.countDocuments(),
      Template.countDocuments(),
      Plan.countDocuments(),
      Subscription.countDocuments({ status: { $in: ['active', 'trial'] } }),
      Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      BlogPost.countDocuments(),
      BlogPost.countDocuments({ status: 'published' }),
      User.find().sort({ createdAt: -1 }).limit(5).select('name email role isVerified isActive createdAt'),
      Campaign.find().sort({ createdAt: -1 }).limit(5).select('name status createdAt stats'),
      Payment.find().sort({ createdAt: -1 }).limit(5).select('amount status createdAt userId').populate('userId', 'name email'),
      AuditLog.find().sort({ createdAt: -1 }).limit(8).populate('userId', 'name email'),
    ]);

    return {
      users: { total: totalUsers, verified: verifiedUsers, active: activeUsers, suspended: suspendedUsers },
      marketing: {
        campaigns: totalCampaigns, landingPages: totalLandingPages, leads: totalLeads,
        contacts: totalContacts, templates: totalTemplates,
      },
      billing: {
        plans: totalPlans,
        activeSubscriptions,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
      content: { blogPosts: totalBlogPosts, publishedPosts },
      recent: {
        users: recentUsers,
        campaigns: recentCampaigns,
        payments: recentPayments,
        auditLogs: recentAuditLogs,
      },
    };
  },

  getAnalytics: async () => {
    const [subscriptionStats, paymentStats, userGrowth] = await Promise.all([
      Subscription.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Payment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: { $month: '$paidAt' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    return { subscriptionStats, paymentStats, userGrowth };
  },

  getPermissions: () => ({ permissions: ALL_PERMISSIONS, rolePermissions: getRuntimeRolePermissions() }),

  updateRolePermissions: (role, permissions) => persistRolePermissions(role, permissions),

  getRoleStats: async () => {
    const rolePermissions = getRuntimeRolePermissions();
    const [adminUsers, superAdminUsers, usersWithCustomPerms] = await Promise.all([
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'super_admin' }),
      User.countDocuments({ permissions: { $exists: true, $not: { $size: 0 } } }),
    ]);
    return {
      totalRoles: 3,
      activeRoles: 3,
      totalPermissions: ALL_PERMISSIONS.length,
      usersWithCustomPermissions: usersWithCustomPerms,
      rolePermissions,
      usersPerRole: { user: await User.countDocuments({ role: 'user' }), admin: adminUsers, super_admin: superAdminUsers },
    };
  },

  getPlanStats: async () => {
    const [total, active, subscribers, revenue] = await Promise.all([
      Plan.countDocuments(),
      Plan.countDocuments({ status: 'active' }),
      Subscription.countDocuments({ status: { $in: ['active', 'trial'] } }),
      Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);
    return {
      total,
      active,
      subscribers,
      revenue: revenue[0]?.total || 0,
    };
  },

  getCouponStats: async () => {
    const now = new Date();
    const [total, active, expired, usedAgg] = await Promise.all([
      Coupon.countDocuments(),
      Coupon.countDocuments({
        isActive: true,
        $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
      }),
      Coupon.countDocuments({ expiresAt: { $lte: now } }),
      Coupon.aggregate([{ $group: { _id: null, totalUsed: { $sum: '$usedCount' } } }]),
    ]);
    return { total, active, expired, totalUsed: usedAgg[0]?.totalUsed || 0 };
  },

  getCampaignStats: async () => {
    const statusAgg = await Campaign.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const map = Object.fromEntries(statusAgg.map((s) => [s._id, s.count]));
    const sentFailed = await Campaign.aggregate([
      { $group: { _id: null, sent: { $sum: '$stats.sent' }, failed: { $sum: '$stats.failed' } } },
    ]);
    const total = statusAgg.reduce((sum, s) => sum + s.count, 0);
    const activeStatuses = ['processing', 'sending', 'scheduled'];
    const active = activeStatuses.reduce((sum, st) => sum + (map[st] || 0), 0);
    return {
      total,
      active,
      scheduled: map.scheduled || 0,
      completed: map.completed || 0,
      sent: sentFailed[0]?.sent || 0,
      failed: sentFailed[0]?.failed || 0,
    };
  },

  getContactStats: async () => {
    const [total, active, inactive, bounced, unsubscribed] = await Promise.all([
      Contact.countDocuments(),
      Contact.countDocuments({ status: 'active' }),
      Contact.countDocuments({ status: 'inactive' }),
      Contact.countDocuments({ status: 'bounced' }),
      Contact.countDocuments({ status: 'unsubscribed' }),
    ]);
    return { total, active, inactive, bounced, unsubscribed };
  },

  getLogStats: async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [today, errors, warnings, success] = await Promise.all([
      AuditLog.countDocuments({ createdAt: { $gte: startOfDay } }),
      AuditLog.countDocuments({ action: { $regex: /error|fail/i } }),
      AuditLog.countDocuments({ action: { $regex: /warn/i } }),
      AuditLog.countDocuments({ action: { $regex: /success|created|updated/i } }),
    ]);
    return { today, errors, warnings, success, total: await AuditLog.countDocuments() };
  },

  getBlogStats: async () => {
    const [total, published, draft, scheduled] = await Promise.all([
      BlogPost.countDocuments(),
      BlogPost.countDocuments({ status: 'published' }),
      BlogPost.countDocuments({ status: 'draft' }),
      BlogPost.countDocuments({ status: 'scheduled' }),
    ]);
    return { total, published, draft, scheduled };
  },

  getNotificationStats: async () => {
    const [total, active, disabled] = await Promise.all([
      NotificationTemplate.countDocuments(),
      NotificationTemplate.countDocuments({ isEnabled: true }),
      NotificationTemplate.countDocuments({ isEnabled: false }),
    ]);
    return { total, active, disabled };
  },

  getSupportStats: async () => {
    const [open, inProgress, resolved, closed, total] = await Promise.all([
      SupportTicket.countDocuments({ status: 'open' }),
      SupportTicket.countDocuments({ status: 'in_progress' }),
      SupportTicket.countDocuments({ status: 'resolved' }),
      SupportTicket.countDocuments({ status: 'closed' }),
      SupportTicket.countDocuments(),
    ]);
    return { open, inProgress, resolved, closed, total, pending: open + inProgress };
  },

  verifyUserEmail: async (userId) => {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { isVerified: true } },
      { new: true }
    );
    if (!user) throw new Error('User not found');
    return user;
  },

  listCampaigns: (filter, page, limit) =>
    paginate(Campaign, filter, page, limit, { createdAt: -1 }, 'userId'),

  listTemplates: async (filter, page, limit) => {
    const countOnly = filter.countOnly;
    delete filter.countOnly;
    if (countOnly) return Template.countDocuments(filter);
    return Template.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name email')
      .populate('defaultTemplateId', 'type name');
  },

  listContacts: (filter, page, limit) =>
    paginate(Contact, filter, page, limit, { createdAt: -1 }, 'userId'),

  listLandingPages: (filter, page, limit) =>
    paginate(LandingPage, filter, page, limit, { createdAt: -1 }, 'userId'),

  listLeads: (filter, page, limit) =>
    paginate(Lead, filter, page, limit, { createdAt: -1 }, 'userId landingPageId'),

  listPlans: async (filter, page, limit) => {
    await PlanService.seedDefaultPlansIfEmpty();
    await PlanService.updateSubscriberCounts();
    return paginate(Plan, filter, page, limit, { displayOrder: 1, createdAt: -1 });
  },

  createPlan: async (data) => {
    const errors = PlanService.validatePlanData(data);
    if (errors.length) throw new Error(errors.join(', '));
    return Plan.create({ ...data, version: 1 });
  },

  updatePlan: async (id, data) => {
    const errors = PlanService.validatePlanData(data);
    if (errors.length) throw new Error(errors.join(', '));
    const existing = await Plan.findById(id);
    if (!existing) throw new Error('Plan not found');
    return Plan.findByIdAndUpdate(
      id,
      { $set: { ...data, version: (existing.version || 1) + 1 } },
      { new: true, runValidators: true }
    );
  },

  deletePlan: async (id) => {
    const activeSubs = await Subscription.countDocuments({
      planId: id,
      status: { $in: ['trial', 'active', 'past_due', 'paused'] },
    });
    if (activeSubs > 0) {
      throw new Error('Cannot delete plan with active subscriptions. Deactivate or archive instead.');
    }
    return Plan.findByIdAndDelete(id);
  },

  duplicatePlan: (id) => PlanService.duplicatePlan(id),
  archivePlan: (id) => PlanService.archivePlan(id),
  deactivatePlan: (id) => PlanService.deactivatePlan(id),
  activatePlan: (id) => PlanService.activatePlan(id),

  listSubscriptions: (filter, page, limit) =>
    paginate(Subscription, filter, page, limit, { createdAt: -1 }, 'userId planId'),

  createSubscription: async (data) => {
    const SubscriptionService = require('./subscription.services');
    if (data.userId && data.planId) {
      return SubscriptionService.assignPlanToUser(data.userId, data.planId, data.status || 'active');
    }
    return SubscriptionService.createSubscriptionWithSnapshot(data);
  },
  updateSubscription: async (id, data) =>
    Subscription.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }),

  listPayments: (filter, page, limit) =>
    paginate(Payment, filter, page, limit, { createdAt: -1 }, 'userId planId subscriptionId'),

  createPayment: (data) => Payment.create(data),
  updatePayment: async (id, data) =>
    Payment.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }),

  refundPayment: async (id) => {
    const payment = await Payment.findById(id);
    if (!payment) throw new Error('Payment not found');
    if (payment.status === 'refunded') throw new Error('Already refunded');
    payment.status = 'refunded';
    await payment.save();
    return payment;
  },

  listCoupons: (filter, page, limit) =>
    paginate(Coupon, filter, page, limit, { createdAt: -1 }),

  createCoupon: (data) => Coupon.create(data),
  updateCoupon: async (id, data) =>
    Coupon.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }),
  deleteCoupon: (id) => Coupon.findByIdAndDelete(id),

  getSystemSettings: async () => {
    let settings = await SystemSettings.findOne({ key: 'global' });
    if (!settings) settings = await SystemSettings.create({ key: 'global' });
    return settings;
  },

  getThemeSettings: async () => {
    let settings = await SystemSettings.findOne({ key: 'global' });
    if (!settings) settings = await SystemSettings.create({ key: 'global' });
    return resolveThemeFromSettings(settings);
  },

  updateThemeSettings: async (payload) => {
    const errors = validateTheme(payload);
    if (errors.length) {
      throw new Error(errors.join(', '));
    }
    const theme = normalizeTheme(payload);
    const settings = await SystemSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: { theme } },
      { new: true, upsert: true, runValidators: true }
    );
    return resolveThemeFromSettings(settings);
  },

  resetThemeSettings: async () => {
    const settings = await SystemSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: { theme: { ...DEFAULT_THEME } } },
      { new: true, upsert: true, runValidators: true }
    );
    return resolveThemeFromSettings(settings);
  },

  getPublicTheme: async () => {
    let settings = await SystemSettings.findOne({ key: 'global' });
    if (!settings) settings = await SystemSettings.create({ key: 'global' });
    return resolveThemeFromSettings(settings);
  },

  getMaintenanceStatus: async () => {
    const settings = await SystemSettings.findOne({ key: 'global' });
    return {
      maintenanceMode: settings?.security?.maintenanceMode || false,
      message: settings?.general?.maintenanceMessage || 'We are currently performing maintenance. Please try again later.',
    };
  },

  getPublicSiteSettings: async () => {
    const settings = await SystemSettings.findOne({ key: 'global' });
    const general = settings?.general || {};
    const seo = settings?.seo || {};
    const social = settings?.social || {};
    return {
      companyName: general.siteName || 'App',
      siteName: general.siteName || 'App',
      siteDescription: general.siteDescription || '',
      logoUrl: general.logo || '',
      faviconUrl: general.favicon || '',
      seoTitle: seo.defaultTitle || '',
      seoDescription: seo.metaDescription || '',
      keywords: seo.keywords || '',
      robots: seo.robots || 'index,follow',
      canonicalUrl: seo.canonicalUrl || '',
      ogTitle: seo.ogTitle || '',
      ogDescription: seo.ogDescription || '',
      ogImage: seo.ogImage || '',
      twitterCard: seo.twitterCard || 'summary_large_image',
      social: {
        facebook: social.facebook || '',
        twitter: social.twitter || '',
        linkedin: social.linkedin || '',
        instagram: social.instagram || '',
      },
    };
  },

  updateSystemSettings: async (data) => {
    if (data.smtp?.password) {
      const existing = await SystemSettings.findOne({ key: 'global' }).select('+smtp.password');
      if (existing) {
        existing.smtp = { ...existing.smtp.toObject(), ...data.smtp };
        Object.keys(data).forEach((k) => {
          if (k !== 'smtp') existing[k] = data[k];
        });
        await existing.save();
        return existing;
      }
    }
    const settings = await SystemSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: data },
      { new: true, upsert: true, runValidators: true }
    );
    return settings;
  },

  testSystemSmtp: async () => {
    const settings = await SystemSettings.findOne({ key: 'global' }).select('+smtp.password');
    if (!settings?.smtp?.host) throw new Error('SMTP not configured');
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: settings.smtp.host,
      port: settings.smtp.port,
      secure: settings.smtp.encryption === 'SSL',
      auth: settings.smtp.username ? { user: settings.smtp.username, pass: settings.smtp.password } : undefined,
    });
    await transporter.verify();
    return { success: true };
  },

  listBlogPosts: (filter, page, limit) =>
    paginate(BlogPost, filter, page, limit, { createdAt: -1 }, 'authorId categoryId'),

  createBlogPost: (data) => BlogPost.create(data),
  updateBlogPost: async (id, data) =>
    BlogPost.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }),
  deleteBlogPost: (id) => BlogPost.findByIdAndDelete(id),

  listBlogCategories: () => BlogCategory.find().sort({ name: 1 }),
  createBlogCategory: (data) => BlogCategory.create(data),
  updateBlogCategory: async (id, data) =>
    BlogCategory.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }),
  deleteBlogCategory: (id) => BlogCategory.findByIdAndDelete(id),

  listNotificationTemplates: async () => {
    const count = await NotificationTemplate.countDocuments();
    if (count === 0) {
      const defaults = [
        { key: 'welcome', name: 'Welcome', subject: 'Welcome to our platform', body: 'Hello {{name}}, welcome!', isEnabled: true, variables: ['name'] },
        { key: 'registration', name: 'Registration', subject: 'Confirm your registration', body: 'Thank you for registering.', isEnabled: true },
        { key: 'password_reset', name: 'Password Reset', subject: 'Reset your password', body: 'Use this link to reset: {{link}}', isEnabled: true, variables: ['link'] },
        { key: 'payment_success', name: 'Payment Successful', subject: 'Payment received', body: 'Your payment of {{amount}} was successful.', isEnabled: true, variables: ['amount'] },
      ];
      await NotificationTemplate.insertMany(defaults);
    }
    return NotificationTemplate.find().sort({ name: 1 });
  },
  createNotificationTemplate: (data) => NotificationTemplate.create(data),
  updateNotificationTemplate: async (id, data) =>
    NotificationTemplate.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }),
  deleteNotificationTemplate: (id) => NotificationTemplate.findByIdAndDelete(id),

  listSupportTickets: (filter, page, limit) =>
    paginate(SupportTicket, filter, page, limit, { createdAt: -1 }, 'userId assignedTo'),

  updateSupportTicket: async (id, data) =>
    SupportTicket.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }),

  getSmtpProviders: async () => {
    const count = await Settings.countDocuments();
    const withSmtp = await Settings.countDocuments({ 'smtp.host': { $exists: true, $ne: '' } });
    return { totalUserSettings: count, usersWithSmtp: withSmtp };
  },

  getEmailVerificationStats: async () => {
    const [verified, unverified] = await Promise.all([
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ isVerified: false }),
    ]);
    return { verified, unverified, total: verified + unverified };
  },

  getQueueStats: async () => {
    try {
      const counts = await emailQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      return { queueName: EMAIL_QUEUE_NAME, counts };
    } catch {
      return { queueName: EMAIL_QUEUE_NAME, counts: null, error: 'Queue unavailable' };
    }
  },

  buildResourceFilter: (search, fields) => buildSearchFilter(search, fields),
};

module.exports = AdminService;
