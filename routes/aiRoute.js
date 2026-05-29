
const express = require('express')
const router = express.Router();
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const { validatePayload } = require('../middleware/common.middleware');

const aiController = require('../controller/aiController');

router.post('/ai/search', authMiddleware, adminMiddleware, validatePayload, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.AI_SEARCH_ATTEMPT);
  aiController.search(req, res, next);
});


module.exports = router;
