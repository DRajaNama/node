const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const controller = require('../controller/integration.controller');

router.get('/integrations/providers', authMiddleware, controller.providers);
router.get('/integrations/mailchimp/audiences', authMiddleware, controller.mailchimpAudiences);
router.get('/integrations', authMiddleware, controller.list);
router.get('/integrations/:id', authMiddleware, controller.get);
router.post('/integrations/verify', authMiddleware, controller.verify);
router.post('/integrations', authMiddleware, controller.create);
router.put('/integrations/:id', authMiddleware, controller.update);
router.patch('/integrations/:id', authMiddleware, controller.update);
router.patch('/integrations/:id/status', authMiddleware, controller.status);
router.delete('/integrations/:id', authMiddleware, controller.remove);

module.exports = router;