const FormPopupService = require('../services/formPopup.services');
const {
  formPopupCreateValidation,
  formPopupUpdateValidation,
} = require('../validations/formPopup.validations');
const { getBlankFormPopupHtml } = require('../utils/landingPage.utils');
const EntitlementService = require('../services/entitlement.services');
const { handleQuotaError } = require('../middleware/quota.middleware');
const QuotaExceededError = require('../helpers/quotaError');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const fs = require('fs').promises;
const path = require('path');

const getOwnedFormPopup = async (req, res) => {
  if (!req.params.id) {
    res.status(400).send({ data: null, message: Message.ID_IS_REQUIRED });
    return null;
  }
  const record = await FormPopupService.findByIdAndUserId(req.params.id, req.userId);
  if (!record) {
    res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
    return null;
  }
  return record;
};

const FormPopupController = {
  create: async (req, res) => {
    try {
      const { errors, isValid } = formPopupCreateValidation(req.body);
      if (!isValid) {
        return res.status(400).send({ errors });
      }
      const data = {
        userId: req.userId,
        name: req.body.name.trim(),
        description: req.body.description || '',
        html: getBlankFormPopupHtml(),
        status: 'draft',
      };
      const record = await FormPopupService.createRecord(data);
      res.send({ data: record, message: Message.RECORD_CREATED });
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return handleQuotaError(res, error);
      }
      logger.error(Message.LOG_END + ' - FormPopupController Create error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  get: async (req, res) => {
    try {
      const record = await getOwnedFormPopup(req, res);
      if (!record) return;
      res.send({ data: record, message: Message.DATA_FOUND });
    } catch (error) {
      logger.error(Message.LOG_END + ' - FormPopupController Get error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getAll: async (req, res) => {
    try {
      const filter = { userId: req.userId };
      if (req.query.search) {
        filter.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } },
        ];
      }
      if (req.query.status && req.query.status !== 'all') {
        filter.status = req.query.status;
      }
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const records = await FormPopupService.getAllRecord(filter, page, limit);
      const total = await FormPopupService.getAllRecord({ ...filter, countOnly: true });
      res.send({
        data: records,
        message: Message.DATA_FOUND,
        meta: { page, limit, total },
      });
    } catch (error) {
      logger.error(Message.LOG_END + ' - FormPopupController GetAll error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  autocomplete: async (req, res) => {
    try {
      const filter = { userId: req.userId };
      if (req.query.search) {
        filter.name = { $regex: req.query.search, $options: 'i' };
      }
      const format = { _id: 1, name: 1, status: 1 };
      const data = await FormPopupService.getAllRecord(
        filter,
        parseInt(req.query.page) || 1,
        parseInt(req.query.limit) || 50,
        format
      );
      res.send({ data, message: Message.DATA_FOUND });
    } catch (error) {
      logger.error(Message.LOG_END + ' - FormPopupController Autocomplete error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  updateMeta: async (req, res) => {
    try {
      const record = await getOwnedFormPopup(req, res);
      if (!record) return;
      const { errors, isValid } = formPopupUpdateValidation(req.body);
      if (!isValid) {
        return res.status(400).send({ errors });
      }
      if (req.body.name) record.name = req.body.name.trim();
      if (req.body.description !== undefined) record.description = req.body.description;
      await record.save();
      res.send({ data: record, message: Message.RECORD_UPDATED });
    } catch (error) {
      logger.error(Message.LOG_END + ' - FormPopupController UpdateMeta error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  updateContent: async (req, res) => {
    try {
      const record = await getOwnedFormPopup(req, res);
      if (!record) return;
      if (req.file) {
        record.thumb = req.file.filename;
      }
      if (req.body.html) {
        record.html = req.body.html;
      }
      if (req.body.name) record.name = req.body.name;
      if (req.body.description !== undefined) record.description = req.body.description;
      await record.save();
      res.send({ data: record, message: Message.RECORD_UPDATED });
    } catch (error) {
      logger.error(Message.LOG_END + ' - FormPopupController UpdateContent error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  delete: async (req, res) => {
    try {
      const record = await getOwnedFormPopup(req, res);
      if (!record) return;
      if (record.thumb && record.thumb !== 'popup.png') {
        const filePath = path.join(__dirname, '..', 'uploads', 'templates', record.thumb);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          if (err.code !== 'ENOENT') console.error('Error deleting thumb:', err);
        }
      }
      await FormPopupService.deleteRecord(req.params.id);
      res.send({ data: null, message: Message.RECORD_DELETED });
    } catch (error) {
      logger.error(Message.LOG_END + ' - FormPopupController Delete error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  publish: async (req, res) => {
    try {
      const record = await getOwnedFormPopup(req, res);
      if (!record) return;
      record.status = 'published';
      record.publishedAt = new Date();
      await record.save();
      res.send({ data: record, message: 'Form popup published successfully' });
    } catch (error) {
      logger.error(Message.LOG_END + ' - FormPopupController Publish error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  unpublish: async (req, res) => {
    try {
      const record = await getOwnedFormPopup(req, res);
      if (!record) return;
      record.status = 'unpublished';
      await record.save();
      res.send({ data: record, message: 'Form popup unpublished successfully' });
    } catch (error) {
      logger.error(Message.LOG_END + ' - FormPopupController Unpublish error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },
};

module.exports = FormPopupController;
