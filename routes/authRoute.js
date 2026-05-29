
const express = require('express')
const router = express.Router();
const authController = require('../controller/authController');
const authMiddleware = require('../middleware/auth.middleware');
const { validatePayload } = require('../middleware/common.middleware');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');

router.post('/login',validatePayload, (req, res,next) => {
  logger.info(Message.LOG_START+' - '+Message.LOGIN_ATTEMPT);
  authController.login(req, res, next);
});

router.post('/register', validatePayload, (req, res,next) => {
  logger.info(Message.LOG_START+' - '+Message.REGISTRATION_ATTEMPT);
  authController.register(req, res, next);
});

router.get('/me', authMiddleware, (req, res,next) => {
  logger.info(Message.LOG_START+' - '+Message.FETCHING_USER_INFO);
  authController.getUser(req, res, next);
});

module.exports = router;
