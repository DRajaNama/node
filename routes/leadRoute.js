const express = require('express');
const router = express.Router();
const leadController = require('../controller/leadController');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/leads', authMiddleware, leadController.getAll);
router.get('/lead/:id', authMiddleware, leadController.get);

module.exports = router;
