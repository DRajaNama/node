const LandingPageService = require('../services/landingPage.services');
const FormPopupService = require('../services/formPopup.services');
const LeadService = require('../services/lead.services');
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
      logger.error(Message.LOG_END + ' - PublicController SubmitLead error', error);
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },
};

module.exports = PublicController;
