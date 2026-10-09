
const express = require('express')
const router = express.Router();
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const authMiddleware = require('../middleware/auth.middleware');
const aiController = require('../controller/aiController');
const aiIntegrationController = require('../controller/aiIntegration.controller');

router.get('/ai/integration', authMiddleware, aiIntegrationController.status);
router.post('/ai/integration/test', authMiddleware, aiIntegrationController.test);
router.put('/ai/integration', authMiddleware, aiIntegrationController.save);
router.delete('/ai/integration', authMiddleware, aiIntegrationController.disconnect);

router.post('/ai/generate-template', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START + ' AI template generation');
  aiController.generateTemplate(req, res, next);
});


module.exports = router;
