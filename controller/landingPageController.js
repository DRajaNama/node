const LandingPageService = require('../services/landingPage.services');
const LandingPagePublishService = require('../services/landingPagePublish.services');
const {
  landingPageCreateValidation,
  landingPageUpdateValidation,
  landingPageScheduleValidation,
  landingPagePublishValidation,
} = require('../validations/landingPage.validations');
const { LANDING_PAGE_STATUS } = require('../constants/landingPage.constants');
const { getBlankLandingPageHtml } = require('../utils/landingPage.utils');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const fs = require('fs').promises;
const path = require('path');

const getOwnedLandingPage = async (req, res) => {
  if (!req.params.id) {
    res.status(400).send({ data: null, message: Message.ID_IS_REQUIRED });
    return null;
  }
  const record = await LandingPageService.findByIdAndUserId(req.params.id, req.userId);
  if (!record) {
    res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
    return null;
  }
  return record;
};

const LandingPageController = {
  create: async (req, res) => {
    logger.info(Message.LOG_START + ' - LandingPageController Create attempt', req.body);
    try {
      const { errors, isValid } = landingPageCreateValidation(req.body);
      if (!isValid) {
        return res.status(400).send({ errors });
      }
      const data = {
        userId: req.userId,
        name: req.body.name.trim(),
        slug: req.body.slug.trim().toLowerCase(),
        description: req.body.description || '',
        html: getBlankLandingPageHtml(),
        status: 'draft',
        stats: { views: 0, leads: 0 },
      };
      const record = await LandingPageService.createRecord(data);
      res.send({ data: record, message: Message.RECORD_CREATED });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).send({ data: null, message: Message.DUPLICATE_RECORD });
      }
      logger.error(Message.LOG_END + ' - LandingPageController Create error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  get: async (req, res) => {
    try {
      const record = await getOwnedLandingPage(req, res);
      if (!record) return;
      res.send({ data: record, message: Message.DATA_FOUND });
    } catch (error) {
      logger.error(Message.LOG_END + ' - LandingPageController Get error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getAll: async (req, res) => {
    try {
      const filter = { userId: req.userId };
      if (req.query.search) {
        filter.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { slug: { $regex: req.query.search, $options: 'i' } },
        ];
      }
      if (req.query.status && req.query.status !== 'all') {
        filter.status = req.query.status;
      }
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const records = await LandingPageService.getAllRecord(filter, page, limit);
      const total = await LandingPageService.getAllRecord({ ...filter, countOnly: true });
      const data = records.map((r) => {
        const doc = r.toObject();
        doc.conversionRate =
          doc.stats?.views > 0
            ? Math.round((doc.stats.leads / doc.stats.views) * 10000) / 100
            : 0;
        return doc;
      });
      res.send({
        data,
        message: Message.DATA_FOUND,
        meta: { page, limit, total },
      });
    } catch (error) {
      logger.error(Message.LOG_END + ' - LandingPageController GetAll error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  updateMeta: async (req, res) => {
    try {
      const record = await getOwnedLandingPage(req, res);
      if (!record) return;
      if (record.status === LANDING_PAGE_STATUS.PUBLISHED && req.body.slug) {
        return res.status(400).send({ data: null, message: 'Slug cannot be changed on a published landing page' });
      }
      const { errors, isValid } = landingPageUpdateValidation(req.body);
      if (!isValid) {
        return res.status(400).send({ errors });
      }
      if (req.body.name) record.name = req.body.name.trim();
      if (req.body.slug) record.slug = req.body.slug.trim().toLowerCase();
      if (req.body.description !== undefined) record.description = req.body.description;
      if (req.body.seo) {
        record.seo = {
          ...record.seo?.toObject?.() || record.seo || {},
          ...req.body.seo,
        };
      }
      await record.save();
      res.send({ data: record, message: Message.RECORD_UPDATED });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).send({ data: null, message: Message.DUPLICATE_RECORD });
      }
      logger.error(Message.LOG_END + ' - LandingPageController UpdateMeta error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  updateContent: async (req, res) => {
    try {
      const record = await getOwnedLandingPage(req, res);
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
      logger.error(Message.LOG_END + ' - LandingPageController UpdateContent error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  delete: async (req, res) => {
    try {
      const record = await getOwnedLandingPage(req, res);
      if (!record) return;
      if (record.scheduleJobId) {
        await LandingPagePublishService.removeScheduledJob(record);
      }
      if (record.thumb && record.thumb !== 'landing.png') {
        const filePath = path.join(__dirname, '..', 'uploads', 'templates', record.thumb);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          if (err.code !== 'ENOENT') console.error('Error deleting thumb:', err);
        }
      }
      await LandingPageService.deleteRecord(req.params.id);
      res.send({ data: null, message: Message.RECORD_DELETED });
    } catch (error) {
      logger.error(Message.LOG_END + ' - LandingPageController Delete error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  publish: async (req, res) => {
    try {
      const record = await getOwnedLandingPage(req, res);
      if (!record) return;
      const { errors, isValid } = landingPagePublishValidation({
        slug: record.slug,
        html: record.html,
      });
      if (!isValid) {
        return res.status(400).send({ errors });
      }
      const published = await LandingPagePublishService.publishNow(record, req.userId);
      res.send({ data: published, message: 'Landing page published successfully' });
    } catch (error) {
      if (error.message === Message.DUPLICATE_RECORD) {
        return res.status(400).send({ data: null, message: Message.DUPLICATE_RECORD });
      }
      logger.error(Message.LOG_END + ' - LandingPageController Publish error', error);
      res.status(500).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  schedule: async (req, res) => {
    try {
      const record = await getOwnedLandingPage(req, res);
      if (!record) return;
      const { errors, isValid } = landingPageScheduleValidation(req.body);
      if (!isValid) {
        return res.status(400).send({ errors });
      }
      const { errors: publishErrors, isValid: publishValid } = landingPagePublishValidation({
        slug: record.slug,
        html: record.html,
      });
      if (!publishValid) {
        return res.status(400).send({ errors: publishErrors });
      }
      const scheduled = await LandingPagePublishService.schedulePublish(
        record,
        req.userId,
        req.body.scheduledPublishAt,
        req.body.timezone
      );
      res.send({ data: scheduled, message: 'Landing page scheduled for publishing' });
    } catch (error) {
      if (error.message === Message.DUPLICATE_RECORD) {
        return res.status(400).send({ data: null, message: Message.DUPLICATE_RECORD });
      }
      logger.error(Message.LOG_END + ' - LandingPageController Schedule error', error);
      res.status(500).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  cancelSchedule: async (req, res) => {
    try {
      const record = await getOwnedLandingPage(req, res);
      if (!record) return;
      if (record.status !== LANDING_PAGE_STATUS.SCHEDULED) {
        return res.status(400).send({ data: null, message: 'Landing page is not scheduled' });
      }
      const updated = await LandingPagePublishService.cancelSchedule(record);
      res.send({ data: updated, message: 'Schedule cancelled successfully' });
    } catch (error) {
      logger.error(Message.LOG_END + ' - LandingPageController CancelSchedule error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  reschedule: async (req, res) => {
    try {
      const record = await getOwnedLandingPage(req, res);
      if (!record) return;
      if (record.status !== LANDING_PAGE_STATUS.SCHEDULED) {
        return res.status(400).send({ data: null, message: 'Landing page is not scheduled' });
      }
      const { errors, isValid } = landingPageScheduleValidation(req.body);
      if (!isValid) {
        return res.status(400).send({ errors });
      }
      const updated = await LandingPagePublishService.reschedule(
        record,
        req.userId,
        req.body.scheduledPublishAt,
        req.body.timezone
      );
      res.send({ data: updated, message: 'Schedule updated successfully' });
    } catch (error) {
      logger.error(Message.LOG_END + ' - LandingPageController Reschedule error', error);
      res.status(500).send({ data: null, message: error.message || Message.SERVER_ERROR });
    }
  },

  unpublish: async (req, res) => {
    try {
      const record = await getOwnedLandingPage(req, res);
      if (!record) return;
      if (record.scheduleJobId) {
        await LandingPagePublishService.removeScheduledJob(record);
      }
      record.status = LANDING_PAGE_STATUS.UNPUBLISHED;
      record.scheduledPublishAt = null;
      record.publishType = 'now';
      await record.save();
      res.send({ data: record, message: 'Landing page unpublished successfully' });
    } catch (error) {
      logger.error(Message.LOG_END + ' - LandingPageController Unpublish error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  duplicate: async (req, res) => {
    try {
      const record = await getOwnedLandingPage(req, res);
      if (!record) return;
      const copy = await LandingPageService.duplicateRecord(record, req.userId);
      res.send({ data: copy, message: 'Landing page duplicated successfully' });
    } catch (error) {
      logger.error(Message.LOG_END + ' - LandingPageController Duplicate error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },
};

module.exports = LandingPageController;
