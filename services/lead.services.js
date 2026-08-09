const Lead = require('../models/lead.model');
const Contact = require('../models/contacts.model');
const Message = require('../helpers/constant.message');

const LeadService = {
  createRecord: async (data) => {
    const record = new Lead(data);
    await record.save();
    return record;
  },

  findById: async (id) => {
    return Lead.findById(id)
      .populate('landingPageId', 'name slug')
      .populate('formPopupId', 'name');
  },

  findByIdAndUserId: async (id, userId) => {
    return Lead.findOne({ _id: id, userId })
      .populate('landingPageId', 'name slug')
      .populate('formPopupId', 'name');
  },

  getAllRecord: async (filter = {}, page = 1, limit = 10) => {
    const countOnly = filter.countOnly;
    delete filter.countOnly;
    if (countOnly) {
      return Lead.countDocuments(filter);
    }
    return Lead.find(filter)
      .populate('landingPageId', 'name slug')
      .populate('formPopupId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
  },

  upsertContactFromLead: async (userId, leadData) => {
    if (!leadData.email) return null;
    const existing = await Contact.findOne({ userId, email: leadData.email.toLowerCase() });
    if (existing) {
      if (!existing.tags.includes('lead')) {
        existing.tags = [...(existing.tags || []), 'lead'];
        await existing.save();
      }
      return existing;
    }
    const contact = new Contact({
      userId,
      firstName: leadData.firstName || '',
      lastName: leadData.lastName || '',
      email: leadData.email.toLowerCase(),
      mobile: leadData.phone || '',
      tags: ['lead'],
      status: 'active',
      isUnsubscribed: false,
    });
    await contact.save();
    return contact;
  },
};

module.exports = LeadService;
