const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const SubscriptionController = require('../controller/subscriptionController');

router.get('/plans', SubscriptionController.listPlans);
router.get('/subscription', authMiddleware, SubscriptionController.getMySubscription);
router.get('/payments', authMiddleware, SubscriptionController.getMyPayments);
router.get('/usage', authMiddleware, SubscriptionController.getUsageSummary);
router.get('/entitlements/registry', authMiddleware, SubscriptionController.getEntitlementRegistry);
router.get('/subscriptions/paypal/config', authMiddleware, SubscriptionController.paypalConfig);
router.post('/subscriptions/paypal/create', authMiddleware, SubscriptionController.preparePayPal);
router.post('/subscriptions/paypal/verify', authMiddleware, SubscriptionController.verifyPayPal);
router.post('/subscriptions/paypal/cancel', authMiddleware, SubscriptionController.cancelPayPal);

module.exports = router;
