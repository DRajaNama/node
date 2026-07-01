const express = require('express')
const router = express.Router();

const templateCategoryController = require('../controller/templateCategoryController');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const { validatePayload } = require('../middleware/common.middleware');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');

router.post('/template-category/create', authMiddleware, validatePayload, (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.TEMPLATE_CATEGORY_CREATE_ATTEMPT);
  templateCategoryController.createCategory(req, res, next);
});

router.get('/template-category/:id', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.TEMPLATE_CATEGORY_FETCH_ATTEMPT);
  templateCategoryController.getCategory(req, res, next);
});

router.put('/template-category/update/:id', authMiddleware, validatePayload, (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.TEMPLATE_CATEGORY_UPDATE_ATTEMPT);
  templateCategoryController.updateCategory(req, res, next);
});

router.delete('/template-category/delete/:id', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.TEMPLATE_CATEGORY_DELETE_ATTEMPT);
  templateCategoryController.deleteCategory(req, res, next);
});

router.get('/template-categories', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.GET_ALL_TEMPLATE_CATEGORY_ATTEMPT);
  templateCategoryController.getAllCategories(req, res, next);
});

module.exports = router;