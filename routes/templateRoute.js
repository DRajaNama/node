const express = require('express')
const router = express.Router();

const templateController = require('../controller/templateController');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const { validatePayload } = require('../middleware/common.middleware');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');

router.post('/template/create', authMiddleware, validatePayload, (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.TEMPLATE_CREATE_ATTEMPT);
  templateController.createTemplate(req, res, next);
});

router.get('/template/:id', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.TEMPLATE_FETCH_ATTEMPT);
  templateController.getTemplate(req, res, next);
});

router.put('/template/update/:id', authMiddleware, validatePayload, (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.TEMPLATE_UPDATE_ATTEMPT);
  templateController.updateTemplate(req, res, next);
});

router.delete('/template/delete/:id', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.TEMPLATE_DELETE_ATTEMPT);
  templateController.deleteTemplate(req, res, next);
});

router.get('/templates', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.GET_ALL_TEMPLATE_ATTEMPT);
  templateController.getAllCategories(req, res, next);
});

module.exports = router;