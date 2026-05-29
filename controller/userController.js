const { userRegisterValidation, userLoginValidation } = require('../validations/user.validations');
const UserService = require('../services/user.services');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const JWTService = require('../services/jwt.service');

const UserController = {
    login: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.AUTH_CONTROLLER+Message.LOGIN_ATTEMPT,req.body);
        try {
            if(!req.body.id){
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.LOGIN_ATTEMPT, { error: Message.ID_IS_REQUIRED });
                return res.status(400).send({data: null, message: Message.ID_IS_REQUIRED});
            }
            const user = await UserService.findUserById(req.body.id);
            if (!user) {
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.LOGIN_ATTEMPT, req.body.email);
                return res.status(404).send({data: null, message: Message.USER_NOT_FOUND});
            }
            const token = JWTService.sign({ id: user._id });
            logger.info(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.LOGIN_ATTEMPT+Message.SUCCESS);
            res.send({ data: { token, user }, message: Message.LOGIN_SUCCESS });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.LOGIN_ATTEMPT, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }
    },
    createUser: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.AUTH_CONTROLLER+Message.REGISTRATION_ATTEMPT,req.body);
        try {
            const { errors, isValid } = userRegisterValidation(req.body);
            if (!isValid) {
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.REGISTRATION_ATTEMPT, errors);
                return res.status(400).send({ errors });
            }
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
            if(!req.body.id){
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.FETCHING_USER_INFO, { error: Message.ID_IS_REQUIRED });
                return res.status(400).send({data: null, message: Message.ID_IS_REQUIRED});
            }
            const user = await UserService.findUserById(req.body.id);
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
    },
    deleteUser: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.AUTH_CONTROLLER+Message.DELETE_USER_ATTEMPT, { userId: req.body.id });
        try {
            if(!req.body.id){
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.DELETE_USER_ATTEMPT, { error: Message.ID_IS_REQUIRED });
                return res.status(400).send({data: null, message: Message.ID_IS_REQUIRED});
            }
            const user = await UserService.findUserById(req.body.id);
            if (!user) {
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.DELETE_USER_ATTEMPT, { userId: req.body.id });
                return res.status(404).send({data: null, message: Message.USER_NOT_FOUND});
            }
            await user.remove();
            logger.info(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.DELETE_USER_ATTEMPT+Message.SUCCESS, { userId: req.body.id });
            res.send({ data: null, message: Message.USER_DELETED });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.DELETE_USER_ATTEMPT, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }
    },
    updateUser: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.AUTH_CONTROLLER+Message.UPDATE_USER_ATTEMPT, { userId: req.body.id });
        try {
            if(!req.body.id){
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.UPDATE_USER_ATTEMPT, { error: Message.ID_IS_REQUIRED });
                return res.status(400).send({data: null, message: Message.ID_IS_REQUIRED});
            }
            const user = await UserService.findUserById(req.body.id);
            if (!user) {
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.UPDATE_USER_ATTEMPT, { userId: req.body.id });
                return res.status(404).send({data: null, message: Message.USER_NOT_FOUND});
            }
            Object.assign(user, req.body);
            await user.save();
            logger.info(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.UPDATE_USER_ATTEMPT+Message.SUCCESS, { userId: req.body.id });
            res.send({ data: user, message: Message.USER_UPDATED });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.UPDATE_USER_ATTEMPT, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }
    },
    getAllUsers: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.AUTH_CONTROLLER+Message.GET_ALL_USERS_ATTEMPT);
        try {
            const filter = {};
            if (req.query.role) {
                filter.role = req.query.role;
            }
            if (req.query.email) {
                filter.email = req.query.email;
            }
            if (req.query.name) {
                filter.name = { $regex: req.query.name, $options: 'i' };
            }   
            
            const users = await UserService.getAllUsers(filter, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 10);
            logger.info(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.GET_ALL_USERS_ATTEMPT+Message.SUCCESS);
            res.send({ data: users, message: Message.SUCCESS });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.GET_ALL_USERS_ATTEMPT+Message.ERROR_IN, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }
    }
};

module.exports = UserController;