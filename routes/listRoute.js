
const express = require('express')
const router = express.Router();
const ListController = require('../controller/listController');
const authMiddleware = require('../middleware/auth.middleware');
const { validatePayload } = require('../middleware/common.middleware');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');

router.post('/list/create', authMiddleware, validatePayload, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.REGISTRATION_ATTEMPT);
  ListController.create(req, res, next);
});

router.get('/list/:id', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.FETCHING_USER_INFO);
  ListController.get(req, res, next);
});

router.put('/list/update/:id', authMiddleware, validatePayload, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.FETCHING_USER_INFO);
  ListController.update(req, res, next);
});

router.delete('/list/delete/:id', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.FETCHING_USER_INFO);
  ListController.delete(req, res, next);
});

router.get('/lists', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.FETCHING_USER_INFO);
  ListController.getAll(req, res, next);
});

router.post('/list/add-contacts', authMiddleware, validatePayload, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.REGISTRATION_ATTEMPT);
  ListController.addContacts(req, res, next);
});

module.exports = router;
