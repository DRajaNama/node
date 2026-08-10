const PredefinedTemplateService = require('../services/predefinedTemplate.services');
const Message = require('../helpers/constant.message');

const PredefinedTemplateController = {
  list: async (req, res) => {
    try {
      await PredefinedTemplateService.seedDefaultTemplatesIfEmpty();
      const { data, total } = await PredefinedTemplateService.listForCustomer(req.userId, req.query);
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      res.send({ data, message: Message.SUCCESS, meta: { page, limit, total } });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  getCategories: async (req, res) => {
    try {
      const data = await PredefinedTemplateService.getCategories(req.query.type);
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  getById: async (req, res) => {
    try {
      const record = await PredefinedTemplateService.getById(req.params.id);
      if (!record || record.status !== 'published') {
        return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
      }
      const hasAccess = await PredefinedTemplateService.hasPredefinedAccess(req.userId, record.type);
      if (!hasAccess) {
        return res.status(403).send({ data: null, message: 'Plan does not include this template library' });
      }
      res.send({ data: record, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  useTemplate: async (req, res) => {
    try {
      const result = await PredefinedTemplateService.useTemplate(
        req.userId,
        req.params.id,
        req.body
      );
      res.send({ data: result, message: Message.RECORD_CREATED });
    } catch (error) {
      const QuotaExceededError = require('../helpers/quotaError');
      if (error instanceof QuotaExceededError) {
        const { handleQuotaError } = require('../middleware/quota.middleware');
        return handleQuotaError(res, error);
      }
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },
};

module.exports = PredefinedTemplateController;
