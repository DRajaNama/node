const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const PredefinedTemplateController = require('../controller/predefinedTemplateController');

router.get('/predefined-templates/categories', authMiddleware, PredefinedTemplateController.getCategories);
router.get('/predefined-templates', authMiddleware, PredefinedTemplateController.list);
router.get('/predefined-templates/:id', authMiddleware, PredefinedTemplateController.getById);
router.post('/predefined-templates/:id/use', authMiddleware, PredefinedTemplateController.useTemplate);

module.exports = router;
