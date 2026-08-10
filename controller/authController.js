const { userRegisterValidation, userLoginValidation } = require('../validations/user.validations');
const UserService = require('../services/user.services');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const JWTService = require('../services/jwt.service');
const SystemSettings = require('../models/systemSettings.model');
const AuditLogService = require('../services/auditLog.services');

const AuthContoller = {
    login: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.AUTH_CONTROLLER+Message.LOGIN_ATTEMPT,req.body);
        try {
            const { errors, isValid } = userLoginValidation(req.body);
            if (!isValid) {
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.LOGIN_ATTEMPT, errors);
                return res.status(400).send({ errors });
            }
            const user = await UserService.findUserByEmail(req.body.email,true);
            if (!user) {
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.LOGIN_ATTEMPT, req.body.email);
                return res.status(404).send({data: null, message: Message.USER_NOT_FOUND});
            }
            if (!user.isActive) {
                return res.status(403).send({ data: null, message: 'Account is suspended' });
            }
            if (!await UserService.verifyPassword(user, req.body.password)) {
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.LOGIN_ATTEMPT, req.body.email);
                return res.status(401).send({data: null, message: Message.INVALID_CREDENTIALS});
            }
            const settings = await SystemSettings.findOne({ key: 'global' });
            const security = settings?.security || {};
            if (security.requireEmailVerification && !user.isVerified && user.role === 'user') {
                return res.status(403).send({ data: null, message: 'Email verification required' });
            }
            if (security.loginAlert) {
                try {
                    await AuditLogService.create({
                        userId: user._id,
                        action: 'Login Alert',
                        resource: 'Auth',
                        resourceId: String(user._id),
                        ip: req.ip,
                    });
                } catch (alertErr) {
                    logger.error('Login alert failed', alertErr);
                }
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
            const settings = await SystemSettings.findOne({ key: 'global' });
            if (settings?.security?.allowRegistration === false) {
                return res.status(403).send({ data: null, message: 'Registration is disabled' });
            }
            const { errors, isValid } = userRegisterValidation(req.body);
            if (!isValid) {
                logger.error(Message.LOG_END+' - '+Message.AUTH_CONTROLLER+Message.ERROR_IN+Message.REGISTRATION_ATTEMPT, errors);
                return res.status(400).send({ errors });
            }
            await new Promise(resolve => setTimeout(resolve, 10000));
            const user = await UserService.createUser(req.body);
            try {
                const Plan = require('../models/plan.model');
                const PlanService = require('../services/plan.services');
                const SubscriptionService = require('../services/subscription.services');
                await PlanService.seedDefaultPlansIfEmpty();
                const defaultPlan = await Plan.findOne({ status: 'active', isPublic: true }).sort({ displayOrder: 1 });
                if (defaultPlan) {
                    await SubscriptionService.assignPlanToUser(user._id, defaultPlan._id, 'trial');
                }
            } catch (subErr) {
                logger.error('Failed to assign default plan on registration', subErr);
            }
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
    },
    updateMe: async (req, res) => {
        try {
            const { name, mobile, password, currentPassword } = req.body;
            if (password) {
                const existing = await UserService.findUserById(req.userId, true);
                if (!existing) {
                    return res.status(404).send({ data: null, message: Message.USER_NOT_FOUND });
                }
                if (!currentPassword || !await UserService.verifyPassword(existing, currentPassword)) {
                    return res.status(400).send({ data: null, message: 'Invalid current password' });
                }
            }
            const user = await UserService.updateProfile(req.userId, { name, mobile, password });
            res.send({ data: { user }, message: Message.USER_UPDATED });
        } catch (error) {
            logger.error('updateMe error', error);
            res.status(500).send({ data: null, message: Message.SERVER_ERROR });
        }
    },
};

module.exports = AuthContoller;
