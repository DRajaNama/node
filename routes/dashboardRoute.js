const express = require('express');
const router = express.Router();

const DashboardController = require('../controller/dashboardController');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/dashboard/events', authMiddleware, DashboardController.getEvents);

module.exports = router;
