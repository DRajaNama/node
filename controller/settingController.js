const SettingsService = require('../services/setting.services');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const nodemailer = require("nodemailer");
const { ObjectId } = require('mongodb');
const SettingsController = {

    create: async (req, res) => {
        logger.info(
            Message.LOG_START + ' - SETTINGS_CONTROLLER_CREATE_ATTEMPT',
            { userId: req.userId }
        );

        try {
            req.body.userId = req.userId;

            const query = [{
                $match: {
                    user: req.userId
                }
            }];

            const existing = await SettingsService.findByQuery(query);

            if (existing.length > 0) {
                const record = await SettingsService.updateRecord(
                    existing[0]._id,
                    req.body
                );

                logger.info(
                    Message.LOG_END + ' - SETTINGS_CONTROLLER_CREATE_ATTEMPT_SUCCESS',
                    { userId: req.userId }
                );

                return res.send({
                    data: record,
                    message: Message.RECORD_UPDATED
                });
            }

            const record = await SettingsService.createRecord(req.body);

            logger.info(
                Message.LOG_END + ' - SETTINGS_CONTROLLER_CREATE_ATTEMPT_SUCCESS',
                { userId: record._id }
            );

            res.send({
                data: record,
                message: Message.RECODE_CREATED
            });

        } catch(error) {
            logger.error(
                Message.LOG_END + ' - SETTINGS_CONTROLLER_CREATE_ERROR',
                error
            );

            res.status(500).send({
                data: null,
                message: Message.SERVER_ERROR
            });
        }
    },

    get: async (req, res) => {
        logger.info(
            Message.LOG_START + ' - SETTINGS_CONTROLLER_FETCH_ATTEMPT',
            { userId: req.userId }
        );

        try {
            const query = [{
                $match: {
                    user: new ObjectId(req.userId)
                }
            }];
            const record = await SettingsService.findByQuery(query);
           
            if (record.length === 0) {
                return res.status(404).send({
                    data: null,
                    message: Message.DATA_NOT_FOUND
                });
            }

            logger.info(
                Message.LOG_END + ' - SETTINGS_CONTROLLER_FETCH_SUCCESS',
                { userId: req.userId }
            );

            res.send({
                data: record[0],
                message: Message.SUCCESS
            });

        } catch(error) {
            logger.error(
                Message.LOG_END + ' - SETTINGS_CONTROLLER_FETCH_ERROR',
                error
            );

            res.status(500).send({
                data: null,
                message: Message.SERVER_ERROR
            });
        }
    },

    update: async (req, res) => {
        logger.info(
            Message.LOG_START + ' - SETTINGS_CONTROLLER_UPDATE_ATTEMPT',
            { userId: req.userId }
        );

        try {
            const query = [{
                $match: {
                    user: new ObjectId(req.userId)
                }
            }];
            const existing = await SettingsService.findByQuery(query);

            if (existing.length === 0) {
                return res.status(404).send({
                    data: null,
                    message: Message.DATA_NOT_FOUND
                });
            }

            const record = await SettingsService.updateRecord(
                existing[0]._id,
                req.body
            );

            logger.info(
                Message.LOG_END + ' - SETTINGS_CONTROLLER_UPDATE_SUCCESS',
                { userId: req.userId }
            );

            res.send({
                data: record,
                message: Message.RECORD_UPDATED
            });

        } catch(error) {
            logger.error(
                Message.LOG_END + ' - SETTINGS_CONTROLLER_UPDATE_ERROR',
                error
            );

            res.status(500).send({
                data: null,
                message: Message.SERVER_ERROR
            });
        }
    },

    delete: async (req, res) => {
        logger.info(
            Message.LOG_START + ' - SETTINGS_CONTROLLER_DELETE_ATTEMPT',
            { userId: req.userId }
        );

        try {
            const query = [{
                $match: {
                    user: new ObjectId(req.userId)
                }
            }];

            const record = await SettingsService.findByQuery(query);

            if (record.length === 0) {
                return res.status(404).send({
                    data: null,
                    message: Message.DATA_NOT_FOUND
                });
            }

            await SettingsService.deleteRecord(record[0]._id);

            logger.info(
                Message.LOG_END + ' - SETTINGS_CONTROLLER_DELETE_SUCCESS',
                { userId: req.userId }
            );

            res.send({
                data: null,
                message: Message.USER_DELETED
            });

        } catch(error) {
            logger.error(
                Message.LOG_END + ' - SETTINGS_CONTROLLER_DELETE_ERROR',
                error
            );

            res.status(500).send({
                data: null,
                message: Message.SERVER_ERROR
            });
        }
    },

    testSMTP: async (req, res) => {
        logger.info(
            Message.LOG_START + ' - SETTINGS_CONTROLLER_SMTP_TEST_ATTEMPT',
            { userId: req.userId }
        );

        try {
            const query = [{
                $match: {
                    user: new ObjectId(req.userId)
                }
            }];
            const record = await SettingsService.findByQuery(query);
            if (record.length === 0) {
                return res.status(404).send({
                    data: null,
                    message: Message.DATA_NOT_FOUND
                });
            }
            const transporter = nodemailer.createTransport({
                host: record[0].smtp.host,
                port: record[0].smtp.port,
                secure: record[0].smtp.encryption === "SSL",
                auth: record[0].smtp.authentication ? {
                    user: record[0].smtp.username,
                    pass: record[0].smtp.password
                } : undefined
            });

            await transporter.verify();

            res.send({
                data: null,
                message: "SMTP connection successful."
            });

        } catch(error) {
            logger.error(
                Message.LOG_END + ' - SETTINGS_CONTROLLER_SMTP_TEST_ERROR',
                error
            );

            res.status(400).send({
                data: null,
                message: "SMTP connection failed."
            });
        }
    }

};

module.exports = SettingsController;