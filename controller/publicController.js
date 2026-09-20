const LandingPageService = require('../services/landingPage.services');
const FormPopupService = require('../services/formPopup.services');
const LeadService = require('../services/lead.services');
const EntitlementService = require('../services/entitlement.services');
const { handleQuotaError } = require('../middleware/quota.middleware');
const QuotaExceededError = require('../helpers/quotaError');
const BlogPost = require('../models/blogPost.model');
const { leadSubmitValidation } = require('../validations/lead.validations');
// const { preparePublishHtml } = require('../helpers/landingPage.helper');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const AutomationDispatchService = require('../services/automationDispatch.services');
const Contact = require('../models/contacts.model');
const CampaignRecipient = require('../models/campaignRecipient.model');
const CampaignEvent = require('../models/campaignEvent.model');
const CampaignService = require('../services/campaign.services');
const List = require('../models/list.model');
const ListContact = require('../models/listContact.model');
const Lead = require('../models/lead.model');
const WebAnalyticsService = require('../services/webAnalytics.services');

const LEAD_FIELD_ALIASES = {
  firstName: ['firstname', 'first', 'fname', 'givenname'],
  lastName: ['lastname', 'last', 'lname', 'surname', 'familyname'],
  email: ['email', 'emailaddress', 'emailid', 'mail'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'telephone', 'tel', 'contactnumber'],
};

const LEAD_METADATA_FIELDS = new Set([
  'landingpageid',
  'formpopupid',
  'source',
  'popupname',
]);

const normalizeLeadFieldName = (name) => String(name || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const toLeadFieldValue = (value) => {
  const candidate = Array.isArray(value)
    ? value.find((item) => item !== null && item !== undefined && String(item).trim() !== '')
    : value;

  if (candidate === null || candidate === undefined || typeof candidate === 'object') {
    return '';
  }

  return String(candidate).trim();
};

const mapStandardLeadFields = (body) => {
  const submittedFields = Object.entries(body || {}).map(([key, value]) => ({
    normalizedKey: normalizeLeadFieldName(key),
    value,
  }));

  return Object.fromEntries(
    Object.entries(LEAD_FIELD_ALIASES).map(([field, aliases]) => {
      const match = submittedFields.find(({ normalizedKey, value }) => (
        aliases.includes(normalizedKey) && toLeadFieldValue(value) !== ''
      ));
      return [field, match ? toLeadFieldValue(match.value) : ''];
    })
  );
};

const extractLeadFields = (body) => {
  const knownFields = new Set([
    ...LEAD_METADATA_FIELDS,
    ...Object.values(LEAD_FIELD_ALIASES).flat(),
  ]);
  const fields = {};

  Object.entries(body || {}).forEach(([key, value]) => {
    const normalizedKey = normalizeLeadFieldName(key);
    if (
      !knownFields.has(normalizedKey)
      && !['proto', 'prototype', 'constructor'].includes(normalizedKey)
    ) {
      fields[key] = value;
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
      if (req.query.visitorId) {
        await WebAnalyticsService.recordVisit({
          resourceType: 'landing-page',
          resourceId: record._id,
          visitorId: req.query.visitorId,
          ip: req.ip || req.headers['x-forwarded-for'],
          userAgent: req.headers['user-agent'],
        }).catch((trackingError) => {
          logger.error('Landing page visit tracking failed', trackingError);
        });
      }
      const html = record.html;
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
      const html = record.html;
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

  trackFormPopup: async (req, res) => {
    try {
      if (!req.params.id) {
        return res.status(400).send({ data: null, message: Message.ID_IS_REQUIRED });
      }
      const record = await FormPopupService.findPublishedById(req.params.id);
      if (!record) {
        return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
      }

      const event = String(req.body?.event || '').toLowerCase();
      let updated;
      if (event === 'view') {
        updated = await WebAnalyticsService.recordVisit({
          resourceType: 'form-popup',
          resourceId: record._id,
          visitorId: req.body?.visitorId,
          ip: req.ip || req.headers['x-forwarded-for'],
          userAgent: req.headers['user-agent'],
        });
      } else if (event === 'close') {
        updated = await WebAnalyticsService.recordPopupClose(record._id);
      } else {
        return res.status(400).send({ data: null, message: 'Unsupported popup event' });
      }

      return res.send({ data: updated?.stats || record.stats, message: Message.SUCCESS });
    } catch (error) {
      logger.error('Form popup tracking failed', error);
      return res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  submitLead: async (req, res) => {
    try {
      const standardFields = mapStandardLeadFields(req.body);
      const { errors, isValid } = leadSubmitValidation({
        ...req.body,
        email: standardFields.email,
      });
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

      //await EntitlementService.checkLimit(userId, 'contacts', 1);

      const leadData = {
        userId,
        landingPageId: landingPage?._id || null,
        formPopupId: formPopup?._id || null,
        firstName: standardFields.firstName,
        lastName: standardFields.lastName,
        email: standardFields.email,
        phone: standardFields.phone,
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

      void AutomationDispatchService.dispatchLead({
        leadId: record._id,
        userId,
      }).catch((dispatchError) => {
        const safeError = AutomationDispatchService.safeQueueError(dispatchError);
        logger.error('Lead automation dispatch failed', {
          leadId: String(record._id),
          userId: String(userId),
          code: safeError.code,
          message: safeError.message,
        });
      });

      if (landingPage) {
        await LandingPageService.incrementLeads(landingPage._id);
      }
      if (formPopup) {
        await FormPopupService.incrementLeads(formPopup._id);
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

  unsubscribe: async (req, res) => {
    try {
      const email = String(req.params.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).send({ data: null, message: 'A valid email address is required' });
      }

      const contactsToUnsubscribe = await Contact.find({
        email,
        isUnsubscribed: { $ne: true },
        status: { $ne: 'unsubscribed' }
      }).select('_id');
      const contactIds = contactsToUnsubscribe.map((contact) => contact._id);

      await Contact.updateMany(
        { email },
        { $set: { isUnsubscribed: true, status: 'unsubscribed' } }
      );

      if (contactIds.length > 0) {
        const listMemberships = await ListContact.find({ contactId: { $in: contactIds } })
          .select('listId contactId');
        const listCounts = new Map();
        listMemberships.forEach(({ listId }) => {
          const key = listId.toString();
          listCounts.set(key, (listCounts.get(key) || 0) + 1);
        });
        await List.bulkWrite([...listCounts].map(([listId, count]) => ({
          updateOne: {
            filter: { _id: listId },
            update: { $inc: { unsubscribedCount: count } }
          }
        })));
      }

      const leadsToUnsubscribe = await Lead.find({
        email,
        isUnsubscribed: { $ne: true }
      }).select('_id landingPageId formPopupId');
      if (leadsToUnsubscribe.length > 0) {
        await Lead.updateMany(
          { _id: { $in: leadsToUnsubscribe.map((lead) => lead._id) } },
          { $set: { isUnsubscribed: true } }
        );

        const landingPageCounts = new Map();
        const formPopupCounts = new Map();
        leadsToUnsubscribe.forEach((lead) => {
          if (lead.landingPageId) {
            const key = lead.landingPageId.toString();
            landingPageCounts.set(key, (landingPageCounts.get(key) || 0) + 1);
          }
          if (lead.formPopupId) {
            const key = lead.formPopupId.toString();
            formPopupCounts.set(key, (formPopupCounts.get(key) || 0) + 1);
          }
        });
        await Promise.all([
          LandingPageService.incrementUnsubscribed([...landingPageCounts]),
          FormPopupService.incrementUnsubscribed([...formPopupCounts])
        ]);
      }

      const recipients = await CampaignRecipient.find({ email, status: { $ne: 'unsubscribed' } })
        .select('_id campaignId');
      if (recipients.length > 0) {
        await CampaignRecipient.updateMany(
          { _id: { $in: recipients.map((recipient) => recipient._id) } },
          { $set: { status: 'unsubscribed' } }
        );

        await CampaignEvent.insertMany(recipients.map((recipient) => ({
          campaignId: recipient.campaignId,
          recipientId: recipient._id,
          event: 'unsubscribed',
          ip: req.ip,
          userAgent: req.headers['user-agent']
        })));

        await Promise.all(recipients.map((recipient) =>
          CampaignService.incrementStats(recipient.campaignId, { 'stats.unsubscribed': 1 })
        ));
      }

      res.status(200).type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Unsubscribed</title></head>
<body style="margin:0;padding:48px 20px;background:#f8fafc;color:#172033;font-family:Arial,sans-serif;text-align:center"><main><h1>You have been unsubscribed</h1><p>You will no longer receive marketing emails at this address.</p></main></body></html>`);
    } catch (error) {
      logger.error('Failed to unsubscribe contact', { error: error.message });
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  }
};

module.exports = PublicController;
