const { userRegisterValidation, userLoginValidation } = require('../validations/user.validations');
const UserService = require('../services/user.services');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const JWTService = require('../services/jwt.service');

const AuthContoller = {
    login: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.AUTH_CONTROLLER+Message.LOGIN_ATTEMPT,req.body);
        try {
            const { errors, isValid } = userLoginValidation(req.body);
            if (!isValid) {
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.LOGIN_ATTEMPT, errors);
                return res.status(400).send({ errors });
            }
            const user = await UserService.findUserByEmail(req.body.email);
            if (!user) {
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.LOGIN_ATTEMPT, req.body.email);
                return res.status(404).send({data: null, message: Message.USER_NOT_FOUND});
            }
            if (!await UserService.verifyPassword(user, req.body.password)) {
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.LOGIN_ATTEMPT, req.body.email);
                return res.status(401).send({data: null, message: Message.INVALID_CREDENTIALS});
            }
            const token = JWTService.sign({ id: user._id });
            logger.info(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.LOGIN_ATTEMPT+Message.SUCCESS);
            res.send({ data: { token, user }, message: Message.LOGIN_SUCCESS });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.LOGIN_ATTEMPT, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }
    },
    register: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.AUTH_CONTROLLER+Message.REGISTRATION_ATTEMPT,req.body);
        try {
            const { errors, isValid } = userRegisterValidation(req.body);
            if (!isValid) {
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.REGISTRATION_ATTEMPT, errors);
                return res.status(400).send({ errors });
            }
            // take 10 second delay then after create user
            await new Promise(resolve => setTimeout(resolve, 10000));
            const user = await UserService.createUser(req.body);
            logger.info(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.REGISTRATION_ATTEMPT+Message.SUCCESS, { userId: user._id });
            res.send({ data: user, message: Message.USER_CREATED });
        } catch (error) {
            if (error.code === 11000) {
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.REGISTRATION_ATTEMPT, req.body.email);
                return res.status(400).send({data: null, message: Message.EMAIL_ALREADY_EXISTS });
            }
            logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.REGISTRATION_ATTEMPT, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR });
        }
    },
    getUser: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.AUTH_CONTROLLER+Message.FETCHING_USER_INFO, { userId: req.userId });
        try {
            const user = await UserService.findUserById(req.userId);
            if (!user) {
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.FETCHING_USER_INFO, { userId: req.userId });
                return res.status(404).send({data: null, message: Message.USER_NOT_FOUND});
            }
            logger.info(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.FETCHING_USER_INFO+Message.SUCCESS, { userId: req.userId });
            res.send({ data: { user }, message: Message.USER_FOUND });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.FETCHING_USER_INFO, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }  
    }
};

module.exports = AuthContoller;