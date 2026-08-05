const DashboardService = require("../services/dashboard.services");
const Message = require("../helpers/constant.message");
const logger = require("../helpers/logging");

const CONTROLLER = Message.DASHBOARD_CONTROLLER;

const logStart = (action, meta = {}) => logger.info(`${Message.LOG_START} - ${CONTROLLER}${action}`, meta);
const logEnd = (action, meta = {}) => logger.info(`${Message.LOG_END} - ${CONTROLLER}${action}${Message.SUCCESS}`, meta);
const logError = (action, error) => logger.error(`${Message.LOG_END} - ${CONTROLLER}${Message.ERROR_IN}${action}`, error);

const DashboardController = {

    getEvents: async (req, res) => {

        logStart(Message.FETCHING_RECORD, { userId: req.userId });

        try {

            const events = await DashboardService.getCalendarEvents(req.userId, req.query.start, req.query.end );

            logEnd(Message.FETCHING_RECORD, { userId: req.userId });

            return res.send({
                data: events,
                message: Message.SUCCESS
            });

        } catch (error) {

            logError(Message.FETCHING_RECORD, error);

            return res.status(500).send({
                data: null,
                message: Message.SERVER_ERROR
            });

        }

    }

};

module.exports = DashboardController;