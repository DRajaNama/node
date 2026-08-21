const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');
const AdminController = require('../controller/adminController');
const { PERMISSIONS } = require('../config/permissions');
const superAdminMiddleware = require('../middleware/superAdmin.middleware');

const admin = [authMiddleware, adminMiddleware];
const withPerm = (perm) => [authMiddleware, adminMiddleware, permissionMiddleware(perm)];

router.get('/dashboard/stats', admin, AdminController.getDashboardStats);
router.get('/analytics', withPerm(PERMISSIONS.ANALYTICS_VIEW), AdminController.getAnalytics);

router.get('/permissions', withPerm(PERMISSIONS.ROLES_VIEW), AdminController.getPermissions);
router.get('/roles', withPerm(PERMISSIONS.ROLES_VIEW), AdminController.getRoles);
router.get('/roles/stats', withPerm(PERMISSIONS.ROLES_VIEW), AdminController.getRoleStats);
router.put('/roles/:role/permissions', withPerm(PERMISSIONS.ROLES_MANAGE), AdminController.updateRolePermissions);
router.put('/users/:id/permissions', withPerm(PERMISSIONS.ROLES_MANAGE), AdminController.updateUserPermissions);
router.post('/users/:id/verify-email', withPerm(PERMISSIONS.USERS_EDIT), AdminController.verifyUserEmail);

router.get('/campaigns', withPerm(PERMISSIONS.MARKETING_VIEW), AdminController.listCampaigns);
router.get('/campaigns/stats', withPerm(PERMISSIONS.MARKETING_VIEW), AdminController.getCampaignStats);
router.get('/templates', withPerm(PERMISSIONS.MARKETING_VIEW), AdminController.listTemplates);
router.get('/contacts/stats', withPerm(PERMISSIONS.MARKETING_VIEW), AdminController.getContactStats);
router.get('/contacts', withPerm(PERMISSIONS.MARKETING_VIEW), AdminController.listContacts);
router.get('/landing-pages', withPerm(PERMISSIONS.MARKETING_VIEW), AdminController.listLandingPages);
router.get('/leads', withPerm(PERMISSIONS.MARKETING_VIEW), AdminController.listLeads);

router.get('/plans', withPerm(PERMISSIONS.PLANS_VIEW), AdminController.listPlans);
router.get('/plans/stats', withPerm(PERMISSIONS.PLANS_VIEW), AdminController.getPlanStats);
router.get('/entitlements/registry', withPerm(PERMISSIONS.PLANS_VIEW), AdminController.getEntitlementRegistry);
router.post('/plans', withPerm(PERMISSIONS.PLANS_MANAGE), AdminController.createPlan);
router.put('/plans/:id', withPerm(PERMISSIONS.PLANS_MANAGE), AdminController.updatePlan);
router.post('/plans/:id/duplicate', withPerm(PERMISSIONS.PLANS_MANAGE), AdminController.duplicatePlan);
router.post('/plans/:id/archive', withPerm(PERMISSIONS.PLANS_MANAGE), AdminController.archivePlan);
router.post('/plans/:id/deactivate', withPerm(PERMISSIONS.PLANS_MANAGE), AdminController.deactivatePlan);
router.post('/plans/:id/activate', withPerm(PERMISSIONS.PLANS_MANAGE), AdminController.activatePlan);
router.delete('/plans/:id', withPerm(PERMISSIONS.PLANS_MANAGE), AdminController.deletePlan);

router.get('/subscriptions', withPerm(PERMISSIONS.SUBSCRIPTIONS_VIEW), AdminController.listSubscriptions);
router.post('/subscriptions', withPerm(PERMISSIONS.SUBSCRIPTIONS_MANAGE), AdminController.createSubscription);
router.put('/subscriptions/:id', withPerm(PERMISSIONS.SUBSCRIPTIONS_MANAGE), AdminController.updateSubscription);

router.get('/payments', withPerm(PERMISSIONS.PAYMENTS_VIEW), AdminController.listPayments);
router.post('/payments', withPerm(PERMISSIONS.PAYMENTS_MANAGE), AdminController.createPayment);
router.put('/payments/:id', withPerm(PERMISSIONS.PAYMENTS_MANAGE), AdminController.updatePayment);
router.post('/payments/:id/refund', withPerm(PERMISSIONS.PAYMENTS_MANAGE), AdminController.refundPayment);

router.get('/coupons', withPerm(PERMISSIONS.PLANS_MANAGE), AdminController.listCoupons);
router.get('/coupons/stats', withPerm(PERMISSIONS.PLANS_MANAGE), AdminController.getCouponStats);
router.post('/coupons', withPerm(PERMISSIONS.PLANS_MANAGE), AdminController.createCoupon);
router.put('/coupons/:id', withPerm(PERMISSIONS.PLANS_MANAGE), AdminController.updateCoupon);
router.delete('/coupons/:id', withPerm(PERMISSIONS.PLANS_MANAGE), AdminController.deleteCoupon);

router.get('/settings', withPerm(PERMISSIONS.SETTINGS_VIEW), AdminController.getSystemSettings);
router.put('/settings', withPerm(PERMISSIONS.SETTINGS_MANAGE), AdminController.updateSystemSettings);
router.post(
  '/settings/upload',
  withPerm(PERMISSIONS.SETTINGS_MANAGE),
  require('../middleware/branding.upload.middleware').single('file'),
  AdminController.uploadBrandingAsset
);
router.get('/settings/test-smtp', withPerm(PERMISSIONS.SETTINGS_MANAGE), AdminController.testSystemSmtp);
router.get('/settings/theme', withPerm(PERMISSIONS.SETTINGS_VIEW), AdminController.getThemeSettings);
router.put('/settings/theme', admin, superAdminMiddleware, AdminController.updateThemeSettings);
router.post('/settings/theme/reset', admin, superAdminMiddleware, AdminController.resetThemeSettings);
router.get('/security', withPerm(PERMISSIONS.SETTINGS_VIEW), AdminController.getSecuritySettings);

router.get('/blog/posts', withPerm(PERMISSIONS.BLOGS_VIEW), AdminController.listBlogPosts);
router.get('/blog/stats', withPerm(PERMISSIONS.BLOGS_VIEW), AdminController.getBlogStats);
router.post('/blog/posts', withPerm(PERMISSIONS.BLOGS_MANAGE), AdminController.createBlogPost);
router.put('/blog/posts/:id', withPerm(PERMISSIONS.BLOGS_MANAGE), AdminController.updateBlogPost);
router.delete('/blog/posts/:id', withPerm(PERMISSIONS.BLOGS_MANAGE), AdminController.deleteBlogPost);
router.get('/blog/categories', withPerm(PERMISSIONS.BLOGS_VIEW), AdminController.listBlogCategories);
router.post('/blog/categories', withPerm(PERMISSIONS.BLOGS_MANAGE), AdminController.createBlogCategory);

router.get('/notifications', withPerm(PERMISSIONS.SETTINGS_VIEW), AdminController.listNotificationTemplates);
router.get('/notifications/stats', withPerm(PERMISSIONS.SETTINGS_VIEW), AdminController.getNotificationStats);
router.post('/notifications', withPerm(PERMISSIONS.SETTINGS_MANAGE), AdminController.createNotificationTemplate);
router.put('/notifications/:id', withPerm(PERMISSIONS.SETTINGS_MANAGE), AdminController.updateNotificationTemplate);
router.delete('/notifications/:id', withPerm(PERMISSIONS.SETTINGS_MANAGE), AdminController.deleteNotificationTemplate);

router.get('/logs', withPerm(PERMISSIONS.LOGS_VIEW), AdminController.listAuditLogs);
router.get('/logs/stats', withPerm(PERMISSIONS.LOGS_VIEW), AdminController.getLogStats);
router.get('/support', withPerm(PERMISSIONS.SETTINGS_VIEW), AdminController.listSupportTickets);
router.get('/support/stats', withPerm(PERMISSIONS.SETTINGS_VIEW), AdminController.getSupportStats);
router.put('/support/:id', withPerm(PERMISSIONS.SETTINGS_MANAGE), AdminController.updateSupportTicket);
router.get('/smtp/providers', withPerm(PERMISSIONS.SETTINGS_VIEW), AdminController.getSmtpProviders);
router.get('/email-verification', withPerm(PERMISSIONS.ANALYTICS_VIEW), AdminController.getEmailVerificationStats);
router.get('/queue', withPerm(PERMISSIONS.ANALYTICS_VIEW), AdminController.getQueueStats);

const AdminPredefinedTemplateController = require('../controller/adminPredefinedTemplateController');
const imageUpload = require('../middleware/image.upload.middleware');
const predefinedTemplateZipUpload = require('../middleware/predefinedTemplateZip.upload.middleware');

router.get('/predefined-templates/stats', withPerm(PERMISSIONS.MARKETING_VIEW), AdminPredefinedTemplateController.stats);
router.get('/predefined-templates/categories', withPerm(PERMISSIONS.MARKETING_VIEW), AdminPredefinedTemplateController.getCategories);
router.get('/predefined-templates', withPerm(PERMISSIONS.MARKETING_VIEW), AdminPredefinedTemplateController.list);
router.get('/predefined-templates/:id', withPerm(PERMISSIONS.MARKETING_VIEW), AdminPredefinedTemplateController.getById);
router.post('/predefined-templates', withPerm(PERMISSIONS.MARKETING_MANAGE), AdminPredefinedTemplateController.create);
router.put('/predefined-templates/:id', withPerm(PERMISSIONS.MARKETING_MANAGE), AdminPredefinedTemplateController.update);
router.post('/predefined-templates/:id/content', withPerm(PERMISSIONS.MARKETING_MANAGE), imageUpload.single('thumb'), AdminPredefinedTemplateController.updateContent);
router.post('/predefined-templates/:id/zip', withPerm(PERMISSIONS.MARKETING_MANAGE), predefinedTemplateZipUpload.single('file'), AdminPredefinedTemplateController.uploadZip);
router.post('/predefined-templates/:id/duplicate', withPerm(PERMISSIONS.MARKETING_MANAGE), AdminPredefinedTemplateController.duplicate);
router.post('/predefined-templates/:id/publish', withPerm(PERMISSIONS.MARKETING_MANAGE), AdminPredefinedTemplateController.publish);
router.post('/predefined-templates/:id/unpublish', withPerm(PERMISSIONS.MARKETING_MANAGE), AdminPredefinedTemplateController.unpublish);
router.post('/predefined-templates/:id/archive', withPerm(PERMISSIONS.MARKETING_MANAGE), AdminPredefinedTemplateController.archive);
router.delete('/predefined-templates/:id', withPerm(PERMISSIONS.MARKETING_MANAGE), AdminPredefinedTemplateController.delete);

module.exports = router;
