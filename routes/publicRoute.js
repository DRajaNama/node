const express = require('express');
const router = express.Router();
const publicController = require('../controller/publicController');
const { validatePayload } = require('../middleware/common.middleware');

router.get('/public/landing-page/:slug', publicController.getLandingPage);
router.get('/public/landing-pages/:slug', publicController.getLandingPage);
router.get('/public/form-popup/:id', publicController.getFormPopup);
router.post('/public/lead/submit', validatePayload, publicController.submitLead);
router.get('/public/blog/posts', publicController.getBlogPosts);
router.get('/public/blog/:slug', publicController.getBlogPost);
router.get('/public/plans', publicController.getPublicPlans);
router.get('/public/entitlements/registry', publicController.getPublicEntitlementRegistry);
router.get('/public/theme', publicController.getPublicTheme);
router.get('/public/maintenance-status', publicController.getMaintenanceStatus);
router.get('/public/site-settings', publicController.getSiteSettings);

module.exports = router;
