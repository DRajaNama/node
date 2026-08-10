const Contact = require('../models/contacts.model');
const List = require('../models/list.model');
const Template = require('../models/template.model');
const LandingPage = require('../models/landingPage.model');
const FormPopup = require('../models/formPopup.model');
const UsageCounter = require('../models/usageCounter.model');
const { RESOURCE_KEYS } = require('../config/entitlements.registry');

const getBillingPeriod = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const UsageService = {
  getBillingPeriod,

  async countContacts(userId) {
    return Contact.countDocuments({ userId });
  },

  async countLists(userId) {
    return List.countDocuments({ userId });
  },

  async countCustomEmailTemplates(userId) {
    return Template.countDocuments({ userId, defaultTemplateId: null });
  },

  async countCustomLandingPages(userId) {
    return LandingPage.countDocuments({ userId, predefinedTemplateId: null });
  },

  async countLeadCaptureForms(userId) {
    return FormPopup.countDocuments({ userId });
  },

  async countTeamMembers(userId) {
    return 1;
  },

  async countAutomationWorkflows(userId) {
    return 0;
  },

  async getCounterUsage(userId, resourceKey, period) {
    const doc = await UsageCounter.findOne({ userId, resourceKey, period });
    return doc?.count || 0;
  },

  async incrementCounter(userId, resourceKey, period, amount = 1) {
    const result = await UsageCounter.findOneAndUpdate(
      { userId, resourceKey, period },
      { $inc: { count: amount } },
      { upsert: true, new: true }
    );
    return result.count;
  },

  async getUsage(userId, resourceKey, period = null) {
    switch (resourceKey) {
      case RESOURCE_KEYS.CONTACTS:
        return this.countContacts(userId);
      case RESOURCE_KEYS.LISTS:
        return this.countLists(userId);
      case RESOURCE_KEYS.CUSTOM_EMAIL_TEMPLATES:
        return this.countCustomEmailTemplates(userId);
      case RESOURCE_KEYS.CUSTOM_LANDING_PAGES:
        return this.countCustomLandingPages(userId);
      case RESOURCE_KEYS.LEAD_CAPTURE_FORMS:
        return this.countLeadCaptureForms(userId);
      case RESOURCE_KEYS.TEAM_MEMBERS:
        return this.countTeamMembers(userId);
      case RESOURCE_KEYS.AUTOMATION_WORKFLOWS:
        return this.countAutomationWorkflows(userId);
      case RESOURCE_KEYS.EMAIL_SENDS:
        const p = period || getBillingPeriod();
        return this.getCounterUsage(userId, resourceKey, p);
      case RESOURCE_KEYS.PREDEFINED_EMAIL_TEMPLATES:
      case RESOURCE_KEYS.PREDEFINED_LANDING_PAGES:
      case RESOURCE_KEYS.PREDEFINED_POPUP_TEMPLATES:
        return 0;
      default:
        return 0;
    }
  },
};

module.exports = UsageService;
