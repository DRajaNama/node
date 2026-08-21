const PredefinedTemplateService = require('../services/predefinedTemplate.services');
const PredefinedTemplate = require('../models/predefinedTemplate.model');
const Message = require('../helpers/constant.message');
const auditLogService = require('../services/auditLog.services');
const { PREDEFINED_TEMPLATE_STATUS } = require('../constants/predefinedTemplate.constants');
const PredefinedTemplateZipService = require('../services/predefinedTemplateZip.services');
const fs = require('fs/promises');

const audit = async (req, action, resourceId, metadata) => {
  try {
    await auditLogService.create({
      userId: req.userId,
      action,
      resource: 'PredefinedTemplate',
      resourceId,
      metadata,
      ip: req.ip,
    });
  } catch {
    // non-blocking
  }
};

const pickBodyString = (value) => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value);
};

const AdminPredefinedTemplateController = {
  stats: async (req, res) => {
    try {
      const data = await PredefinedTemplateService.getStats();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  list: async (req, res) => {
    try {
      await PredefinedTemplateService.seedDefaultTemplatesIfEmpty();
      const filter = {};
      if (req.query.type) filter.type = req.query.type;
      if (req.query.status) filter.status = req.query.status;
      if (req.query.category) filter.category = req.query.category;
      if (req.query.isFeatured === 'true') filter.isFeatured = true;
      if (req.query.isFeatured === 'false') filter.isFeatured = false;
      if (req.query.search) {
        filter.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } },
        ];
      }
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const { data, total } = await PredefinedTemplateService.listAdmin(filter, page, limit);
      res.send({ data, message: Message.SUCCESS, meta: { page, limit, total } });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getCategories: async (req, res) => {
    try {
      const data = await PredefinedTemplateService.getCategories(req.query.type);
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getById: async (req, res) => {
    try {
      const data = await PredefinedTemplateService.getById(req.params.id);
      if (!data) return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
      const record = data.toObject();
      if (!record.html && record.htmlFile?.startsWith('/uploads/predefinedtemplates/')) {
        const localPath = require('path').resolve(__dirname, '..', record.htmlFile.replace(/^\/uploads\//, 'uploads/'));
        record.html = await fs.readFile(localPath, 'utf8');
      }
      res.send({ data: record, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  create: async (req, res) => {
    try {
      const data = await PredefinedTemplateService.create(req.body, req.userId);
      await audit(req, 'Predefined Template Created', data._id);
      res.send({ data, message: Message.RECODE_CREATED });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).send({ data: null, message: Message.DUPLICATE_RECORD });
      }
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  update: async (req, res) => {
    try {
      const data = await PredefinedTemplateService.update(req.params.id, req.body, req.userId);
      if (!data) return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
      await audit(req, 'Predefined Template Updated', req.params.id);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  updateContent: async (req, res) => {
    try {
      const updates = {};
      const html = pickBodyString(req.body.html);
      const name = pickBodyString(req.body.name);
      const description = pickBodyString(req.body.description);
      if (html) updates.html = html;
      if (name) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (req.file?.filename) updates.thumb = req.file.filename;

      const data = await PredefinedTemplateService.update(req.params.id, updates, req.userId);
      if (!data) return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
      await audit(req, 'Predefined Template Content Updated', req.params.id);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  uploadZip: async (req, res) => {
    try {
      if (!req.file?.path) return res.status(400).send({ data: null, message: 'A template ZIP file is required.' });
      const template = await PredefinedTemplateService.getById(req.params.id);
      if (!template) return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
      const processed = await PredefinedTemplateZipService.extractAndProcess(req.file.path, template._id.toString());
      const updates = template.type === 'email' || template.type === 'popup'
        ? { html: processed.html, htmlFile: processed.htmlFile }
        : { html: '', htmlFile: processed.htmlFile };
      const data = await PredefinedTemplateService.update(req.params.id, updates, req.userId);
      await audit(req, 'Predefined Template ZIP Uploaded', req.params.id, { fileCount: processed.fileCount });
      return res.send({ data, message: 'Template ZIP extracted and processed successfully.' });
    } catch (error) {
      return res.status(400).send({ data: null, message: error.message || 'Unable to process template ZIP.' });
    } finally {
      if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    }
  },

  duplicate: async (req, res) => {
    try {
      const data = await PredefinedTemplateService.duplicate(req.params.id, req.userId);
      await audit(req, 'Predefined Template Duplicated', data._id, { sourceId: req.params.id });
      res.send({ data, message: Message.RECODE_CREATED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  publish: async (req, res) => {
    try {
      const data = await PredefinedTemplateService.publish(req.params.id, req.userId);
      if (!data) return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
      await audit(req, 'Predefined Template Published', req.params.id);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  unpublish: async (req, res) => {
    try {
      const data = await PredefinedTemplateService.unpublish(req.params.id, req.userId);
      if (!data) return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
      await audit(req, 'Predefined Template Unpublished', req.params.id);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  archive: async (req, res) => {
    try {
      const data = await PredefinedTemplateService.archive(req.params.id, req.userId);
      if (!data) return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
      await audit(req, 'Predefined Template Archived', req.params.id);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  delete: async (req, res) => {
    try {
      await PredefinedTemplateService.delete(req.params.id);
      await audit(req, 'Predefined Template Deleted', req.params.id);
      res.send({ data: null, message: Message.USER_DELETED });
    } catch (error) {
      res.status(400).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },
};

module.exports = AdminPredefinedTemplateController;
