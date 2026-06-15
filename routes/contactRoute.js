
const express = require('express')
const router = express.Router();
const ContactController = require('../controller/contactController');
const authMiddleware = require('../middleware/auth.middleware');
const { validatePayload } = require('../middleware/common.middleware');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');

router.post('/contact/create', authMiddleware, validatePayload, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.REGISTRATION_ATTEMPT);
  ContactController.create(req, res, next);
});

router.get('/contact/:id', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.FETCHING_USER_INFO);
  ContactController.get(req, res, next);
});

router.put('/contact/update/:id', authMiddleware, validatePayload, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.FETCHING_USER_INFO);
  ContactController.update(req, res, next);
});

router.delete('/contact/delete/:id', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.FETCHING_USER_INFO);
  ContactController.delete(req, res, next);
});

router.get('/contacts', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.FETCHING_USER_INFO);
  ContactController.getAll(req, res, next);
});


module.exports = router;
