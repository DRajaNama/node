const LeadService = require('../services/lead.services');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');

const LeadController = {
  getAll: async (req, res) => {
    try {
      const filter = { userId: req.userId };
      if (req.query.search) {
        filter.$or = [
          { firstName: { $regex: req.query.search, $options: 'i' } },
          { lastName: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } },
          { phone: { $regex: req.query.search, $options: 'i' } },
        ];
      }
      if (req.query.landingPageId) {
        filter.landingPageId = req.query.landingPageId;
      }
      if (req.query.formPopupId) {
        filter.formPopupId = req.query.formPopupId;
      }
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const records = await LeadService.getAllRecord(filter, page, limit);
      const total = await LeadService.getAllRecord({ ...filter, countOnly: true });
      res.send({
        data: records,
        message: Message.DATA_FOUND,
        meta: { page, limit, total },
      });
    } catch (error) {
      logger.error(Message.LOG_END + ' - LeadController GetAll error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  get: async (req, res) => {
    try {
      if (!req.params.id) {
        return res.status(400).send({ data: null, message: Message.ID_IS_REQUIRED });
      }
      const record = await LeadService.findByIdAndUserId(req.params.id, req.userId);
      if (!record) {
        return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
      }
      res.send({ data: record, message: Message.DATA_FOUND });
    } catch (error) {
      logger.error(Message.LOG_END + ' - LeadController Get error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },
};

module.exports = LeadController;
