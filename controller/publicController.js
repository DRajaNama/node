const LandingPageService = require('../services/landingPage.services');
const FormPopupService = require('../services/formPopup.services');
const LeadService = require('../services/lead.services');
const EntitlementService = require('../services/entitlement.services');
const { handleQuotaError } = require('../middleware/quota.middleware');
const QuotaExceededError = require('../helpers/quotaError');
const BlogPost = require('../models/blogPost.model');
const { leadSubmitValidation } = require('../validations/lead.validations');
const { preparePublishHtml } = require('../helpers/landingPage.helper');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');

const extractLeadFields = (body) => {
  const known = ['landingPageId', 'formPopupId', 'firstName', 'lastName', 'email', 'phone', 'source'];
  const fields = {};
  Object.keys(body).forEach((key) => {
    if (!known.includes(key)) {
      fields[key] = body[key];
    }
  });
  return fields;
};

const PublicController = {
  getLandingPage: async (req, res) => {
    try {
      const slug = req.params.slug;
      if (!slug) {
        return res.status(400).send({ data: null, message: Message.ID_IS_REQUIRED });
      }
      const record = await LandingPageService.findBySlugPublished(slug);
      if (!record) {
        return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
      }
      await LandingPageService.incrementViews(record._id);
      const html = preparePublishHtml(record.html);
      const seo = record.seo?.toObject?.() || record.seo || {};
      res.send({
        data: {
          _id: record._id,
          name: record.name,
          slug: record.slug,
          html,
          seo,
        },
        message: Message.DATA_FOUND,
      });
    } catch (error) {
      logger.error(Message.LOG_END + ' - PublicController GetLandingPage error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getFormPopup: async (req, res) => {
    try {
      if (!req.params.id) {
        return res.status(400).send({ data: null, message: Message.ID_IS_REQUIRED });
      }
      const record = await FormPopupService.findPublishedById(req.params.id);
      if (!record) {
        return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
      }
      const html = preparePublishHtml(record.html);
      res.send({
        data: {
          _id: record._id,
          name: record.name,
          html,
          settings: record.settings,
          userId: record.userId,
        },
        message: Message.DATA_FOUND,
      });
    } catch (error) {
      logger.error(Message.LOG_END + ' - PublicController GetFormPopup error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  submitLead: async (req, res) => {
    try {
      const { errors, isValid } = leadSubmitValidation(req.body);
      if (!isValid) {
        return res.status(400).send({ errors });
      }

      let userId = null;
      let landingPage = null;
      let formPopup = null;

      if (req.body.landingPageId) {
        landingPage = await LandingPageService.findById(req.body.landingPageId);
        if (!landingPage || landingPage.status !== 'published') {
          return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
        }
        userId = landingPage.userId;
      }

      if (req.body.formPopupId) {
        formPopup = await FormPopupService.findPublishedById(req.body.formPopupId);
        if (!formPopup) {
          return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
        }
        userId = formPopup.userId;
      }

      if (!userId) {
        return res.status(400).send({ data: null, message: Message.DATA_NOT_FOUND });
      }

      await EntitlementService.checkLimit(userId, 'contacts', 1);

      const leadData = {
        userId,
        landingPageId: landingPage?._id || null,
        formPopupId: formPopup?._id || null,
        firstName: req.body.firstName || req.body.first_name || '',
        lastName: req.body.lastName || req.body.last_name || '',
        email: req.body.email || '',
        phone: req.body.phone || req.body.mobile || '',
        fields: extractLeadFields(req.body),
        source: formPopup ? 'form-popup' : 'landing-page',
        ip: req.ip || req.headers['x-forwarded-for'] || '',
        userAgent: req.headers['user-agent'] || '',
      };

      const record = await LeadService.createRecord(leadData);

      try {
        await LeadService.upsertContactFromLead(userId, leadData);
      } catch (contactErr) {
        logger.error('Contact upsert from lead failed', contactErr);
      }

      if (landingPage) {
        await LandingPageService.incrementLeads(landingPage._id);
      }

      res.send({ data: { _id: record._id }, message: 'Thank you! Your information has been submitted.' });
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return handleQuotaError(res, error);
      }
      logger.error(Message.LOG_END + ' - PublicController SubmitLead error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getBlogPosts: async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const filter = { status: 'published' };
      const data = await BlogPost.find(filter)
        .sort({ publishedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('categoryId', 'name slug')
        .select('-content');
      const total = await BlogPost.countDocuments(filter);
      res.send({ data, message: Message.SUCCESS, meta: { page, limit, total } });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getBlogPost: async (req, res) => {
    try {
      const post = await BlogPost.findOne({ slug: req.params.slug, status: 'published' })
        .populate('categoryId', 'name slug')
        .populate('authorId', 'name');
      if (!post) return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
      res.send({ data: post, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getPublicPlans: async (req, res) => {
    try {
      const PlanService = require('../services/plan.services');
      const data = await PlanService.listPublicPlans();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getPublicEntitlementRegistry: async (req, res) => {
    try {
      const EntitlementService = require('../services/entitlement.services');
      res.send({ data: EntitlementService.getRegistry(), message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getPublicTheme: async (req, res) => {
    try {
      const AdminService = require('../services/admin.services');
      const data = await AdminService.getPublicTheme();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getMaintenanceStatus: async (req, res) => {
    try {
      const AdminService = require('../services/admin.services');
      const data = await AdminService.getMaintenanceStatus();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getSiteSettings: async (req, res) => {
    try {
      const AdminService = require('../services/admin.services');
      const data = await AdminService.getPublicSiteSettings();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },
};

module.exports = PublicController;
