const express = require('express');
const router = express.Router();

const DashboardController = require('../controller/dashboardController');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/dashboard/events', authMiddleware, DashboardController.getEvents);
router.get('/dashboard/summary', authMiddleware, DashboardController.getSummary);
router.get('/dashboard/statistics', authMiddleware, DashboardController.getStatistics);

module.exports = router;
