const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const SubscriptionController = require('../controller/subscriptionController');

router.get('/plans', SubscriptionController.listPlans);
router.get('/subscription', authMiddleware, SubscriptionController.getMySubscription);
router.get('/payments', authMiddleware, SubscriptionController.getMyPayments);
router.get('/usage', authMiddleware, SubscriptionController.getUsageSummary);
router.get('/entitlements/registry', authMiddleware, SubscriptionController.getEntitlementRegistry);

module.exports = router;
