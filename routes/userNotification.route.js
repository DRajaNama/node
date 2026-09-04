const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const controller = require('../controller/userNotification.controller');

router.get('/notifications', authMiddleware, controller.list);
router.put('/notifications/read-all', authMiddleware, controller.markAllRead);
router.put('/notifications/:id/read', authMiddleware, controller.markRead);

module.exports = router;