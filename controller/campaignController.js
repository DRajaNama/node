const { campaignCreateValidation } = require('../validations/campaign.validations');
const CampaignService = require('../services/campaign.services');
const CampaignSendService = require('../services/campaignSend.services');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const { ObjectId } = require('mongodb');
const { CAMPAIGN_STATUS, SENDABLE_STATUSES } = require('../constants/campaign.constants');

const CONTROLLER = Message.CAMPAIGN_CONTROLLER;

const logStart = (action, meta = {}) => logger.info(`${Message.LOG_START} - ${CONTROLLER}${action}`, meta);
const logEnd = (action, meta = {}) => logger.info(`${Message.LOG_END} - ${CONTROLLER}${action}${Message.SUCCESS}`, meta);
const logError = (action, error) => logger.error(`${Message.LOG_END} - ${CONTROLLER}${Message.ERROR_IN}${action}`, error);

const parsePagination = (query) => ({
    page: parseInt(query.page, 10) || 1,
    limit: parseInt(query.limit, 10) || 10
});

const requireCampaignId = (req, res) => {
    if (!req.params.id) {
        res.status(400).send({ data: null, message: Message.ID_IS_REQUIRED });
        return null;
    }
    return req.params.id;
};

const getOwnedCampaign = async (req, res, action) => {
    const campaignId = requireCampaignId(req, res);
    if (!campaignId) return null;

    const campaign = await CampaignService.findByIdAndUserId(campaignId, req.userId);
    if (!campaign) {
        logError(action, { campaignId });
        res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
        return null;
    }

    return campaign;
};

const handleServerError = (res, action, error) => {
    logError(action, error);
    res.status(500).send({ data: null, message: Message.SERVER_ERROR });
};

const CampaignController = {
    create: async (req, res) => {
        logStart(Message.CREATE_ATTEMPT, req.body);
        try {
            const { errors, isValid } = campaignCreateValidation(req.body);
            if (!isValid) {
                logError(Message.CREATE_ATTEMPT, errors);
                return res.status(400).send({ errors });
            }

            req.body.userId = req.userId;

            const existing = await CampaignService.findByNameAndUserId(req.body.name, req.userId);
            if (existing) {
                logError(Message.DUPLICATE_RECORD + Message.CREATE_ATTEMPT, {});
                return res.status(400).send({ data: null, message: Message.DUPLICATE_RECORD });
            }
            let body = req.body;
            // add fromName, fromEmail, replyTo from .env
            body.fromName = process.env.FROM_NAME || 'System';
            body.fromEmail = process.env.FROM_EMAIL || 'rajanamdav@gmail.com';
            body.replyTo = process.env.REPLY_TO || 'rajanamdav@gmail.com';

            const record = await CampaignService.createRecord(req.body);
            logEnd(Message.CREATE_ATTEMPT, { campaignId: record._id });
            res.send({ data: record, message: Message.RECORD_CREATED });
        } catch (error) {
            if (error.code === 11000) {
                logError(Message.CREATE_ATTEMPT, req.body.name);
                return res.status(400).send({ data: null, message: Message.DUPLICATE_RECORD });
            }
            handleServerError(res, Message.CREATE_ATTEMPT, error);
        }
    },

    get: async (req, res) => {
        logStart(Message.FETCHING_RECORD, { userId: req.userId });
        try {
            const campaign = await getOwnedCampaign(req, res, Message.FETCHING_RECORD);
            if (!campaign) return;

            logEnd(Message.FETCHING_RECORD, { campaignId: req.params.id });
            res.send({ data: { record: campaign }, message: Message.SUCCESS });
        } catch (error) {
            handleServerError(res, Message.FETCHING_RECORD, error);
        }
    },

    update: async (req, res) => {
        logStart(Message.UPDATE_RECORD_ATTEMPT, { campaignId: req.params.id });
        try {
            const campaign = await getOwnedCampaign(req, res, Message.UPDATE_RECORD_ATTEMPT);
            if (!campaign) return;

            const record = await CampaignService.updateRecord(req.params.id, req.body);
            logEnd(Message.UPDATE_RECORD_ATTEMPT, { campaignId: req.params.id });
            res.send({ data: record, message: Message.RECORD_UPDATED });
        } catch (error) {
            handleServerError(res, Message.UPDATE_RECORD_ATTEMPT, error);
        }
    },

    delete: async (req, res) => {
        logStart(Message.DELETE_RECORD_ATTEMPT, { campaignId: req.params.id });
        try {
            const campaign = await getOwnedCampaign(req, res, Message.DELETE_RECORD_ATTEMPT);
            if (!campaign) return;

            await CampaignService.deleteRecord(campaign._id);
            logEnd(Message.DELETE_RECORD_ATTEMPT, { campaignId: req.params.id });
            res.send({ data: null, message: Message.RECORD_DELETED });
        } catch (error) {
            handleServerError(res, Message.DELETE_RECORD_ATTEMPT, error);
        }
    },

    getAll: async (req, res) => {
        logStart(Message.GET_ALL_RECORD_ATTEMPT);
        try {
            const { page, limit } = parsePagination(req.query);

            let filter = { userId: new ObjectId(req.userId) };

            if (req.query.search) {
                filter = {
                    ...filter,
                    $or: [
                        { name: { $regex: req.query.search, $options: 'i' } },
                        { subject: { $regex: req.query.search, $options: 'i' } },
                        { status: { $regex: req.query.search, $options: 'i' } }
                    ]
                };
            }

            const data = await CampaignService.getAllRecord(filter, page, limit);
            const totalCampaigns = await CampaignService.getAllRecord({ ...filter, countOnly: true });

            logEnd(Message.GET_ALL_RECORD_ATTEMPT);
            res.send({
                data,
                message: Message.SUCCESS,
                meta: { page, limit, total: totalCampaigns }
            });
        } catch (error) {
            handleServerError(res, Message.GET_ALL_RECORD_ATTEMPT, error);
        }
    },

    send: async (req, res) => {
        logStart(Message.SEND_CAMPAIGN_ATTEMPT, { campaignId: req.params.id });
        try {
            const campaign = await getOwnedCampaign(req, res, Message.SEND_CAMPAIGN_ATTEMPT);
            if (!campaign) return;

            if (!SENDABLE_STATUSES.includes(campaign.status)) {
                logError(Message.SEND_CAMPAIGN_ATTEMPT, { status: campaign.status });
                return res.status(400).send({ data: null, message: Message.INVALID_STATUS });
            }

            const record = await CampaignSendService.startCampaign(req.params.id, req.userId);
            logEnd(Message.SEND_CAMPAIGN_ATTEMPT, { campaignId: req.params.id });
            res.send({ data: record, message: Message.CAMPAIGN_SEND_SUCCESS });
        } catch (error) {
            handleServerError(res, Message.SEND_CAMPAIGN_ATTEMPT, error);
        }
    },

    pause: async (req, res) => {
        logStart(Message.PAUSE_CAMPAIGN_ATTEMPT, { campaignId: req.params.id });
        try {
            const campaign = await getOwnedCampaign(req, res, Message.PAUSE_CAMPAIGN_ATTEMPT);
            if (!campaign) return;

            const record = await CampaignService.updateStatus(
                req.params.id,
                req.userId,
                CAMPAIGN_STATUS.PAUSED
            );
            logEnd(Message.PAUSE_CAMPAIGN_ATTEMPT, { campaignId: req.params.id });
            res.send({ data: record, message: Message.CAMPAIGN_PAUSED_SUCCESS });
        } catch (error) {
            handleServerError(res, Message.PAUSE_CAMPAIGN_ATTEMPT, error);
        }
    },

    resume: async (req, res) => {
        logStart(Message.RESUME_CAMPAIGN_ATTEMPT, { campaignId: req.params.id });
        try {
            const campaign = await getOwnedCampaign(req, res, Message.RESUME_CAMPAIGN_ATTEMPT);
            if (!campaign) return;

            const record = await CampaignService.updateStatus(
                req.params.id,
                req.userId,
                CAMPAIGN_STATUS.SENDING
            );
            logEnd(Message.RESUME_CAMPAIGN_ATTEMPT, { campaignId: req.params.id });
            res.send({ data: record, message: Message.CAMPAIGN_RESUME_SUCCESS });
        } catch (error) {
            handleServerError(res, Message.RESUME_CAMPAIGN_ATTEMPT, error);
        }
    },

    cancel: async (req, res) => {
        logStart(Message.CANCEL_CAMPAIGN_ATTEMPT, { campaignId: req.params.id });
        try {
            const campaign = await getOwnedCampaign(req, res, Message.CANCEL_CAMPAIGN_ATTEMPT);
            if (!campaign) return;

            const record = await CampaignService.updateStatus(
                req.params.id,
                req.userId,
                CAMPAIGN_STATUS.CANCELLED
            );
            logEnd(Message.CANCEL_CAMPAIGN_ATTEMPT, { campaignId: req.params.id });
            res.send({ data: record, message: Message.CAMPAIGN_CANCEL_SUCCESS });
        } catch (error) {
            handleServerError(res, Message.CANCEL_CAMPAIGN_ATTEMPT, error);
        }
    },

    analytics: async (req, res) => {
        logStart(Message.ANALYTICS_ATTEMPT, { campaignId: req.params.id });
        try {
            const campaign = await getOwnedCampaign(req, res, Message.ANALYTICS_ATTEMPT);
            if (!campaign) return;

            const analytics = await CampaignService.getAnalytics(req.params.id);
            logEnd(Message.ANALYTICS_ATTEMPT, { campaignId: req.params.id });
            res.send({ data: analytics, message: Message.SUCCESS });
        } catch (error) {
            handleServerError(res, Message.ANALYTICS_ATTEMPT, error);
        }
    },

    recipients: async (req, res) => {
        logStart(Message.RECIPIENT_ATTEMPT, { campaignId: req.params.id });
        try {
            const campaign = await getOwnedCampaign(req, res, Message.RECIPIENT_ATTEMPT);
            if (!campaign) return;

            const { page, limit } = parsePagination(req.query);
            const data = await CampaignService.getRecipients(req.params.id, page, limit);
            const totalRecipients = await CampaignService.getRecipients(req.params.id, null, null, true);

            logEnd(Message.RECIPIENT_ATTEMPT, { campaignId: req.params.id });
            res.send({
                data,
                message: Message.SUCCESS,
                meta: { page, limit, total: totalRecipients }
            });
        } catch (error) {
            handleServerError(res, Message.RECIPIENT_ATTEMPT, error);
        }
    }
};

module.exports = CampaignController;
