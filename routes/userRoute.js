
const express = require('express')
const router = express.Router();
const userController = require('../controller/userController');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const { validatePayload } = require('../middleware/common.middleware');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');

router.post('/user/login', authMiddleware, authMiddleware, validatePayload, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.LOGIN_ATTEMPT);
  userController.login(req, res, next);
});

router.post('/user/create', authMiddleware, adminMiddleware, validatePayload, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.REGISTRATION_ATTEMPT);
  userController.createUser(req, res, next);
});

router.get('/user/:id', authMiddleware, adminMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.FETCHING_USER_INFO);
  userController.getUser(req, res, next);
});

router.put('/user/update/:id', authMiddleware, adminMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.FETCHING_USER_INFO);
  userController.updateUser(req, res, next);
});

router.delete('/user/delete/:id', authMiddleware, adminMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.FETCHING_USER_INFO);
  userController.deleteUser(req, res, next);
});

router.get('/users', authMiddleware, adminMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.FETCHING_USER_INFO);
  userController.getAllUsers(req, res, next);
});


module.exports = router;
