const LandingPage = require('../models/landingPage.model');
const Message = require('../helpers/constant.message');

const LandingPageService = {
  createRecord: async (data) => {
    const record = new LandingPage(data);
    await record.save();
    return record;
  },

  findById: async (id) => {
    return LandingPage.findById(id);
  },

  findByIdAndUserId: async (id, userId) => {
    return LandingPage.findOne({ _id: id, userId });
  },

  findBySlugPublished: async (slug) => {
    return LandingPage.findOne({ slug, status: 'published' });
  },

  getAllRecord: async (filter = {}, page = 1, limit = 10) => {
    const countOnly = filter.countOnly;
    delete filter.countOnly;
    if (countOnly) {
      return LandingPage.countDocuments(filter);
    }
    return LandingPage.find(filter)
      .select('-html')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
  },

  updateRecord: async (id, updateData) => {
    const record = await LandingPage.findById(id);
    if (!record) {
      throw new Error(Message.DATA_NOT_FOUND);
    }
    Object.assign(record, updateData);
    await record.save();
    return record;
  },

  deleteRecord: async (id) => {
    const record = await LandingPage.findById(id);
    if (!record) {
      throw new Error(Message.DATA_NOT_FOUND);
    }
    await LandingPage.deleteOne({ _id: id });
    return record;
  },

  incrementViews: async (id) => {
    return LandingPage.findByIdAndUpdate(id, { $inc: { 'stats.views': 1 } }, { new: true });
  },

  incrementLeads: async (id) => {
    return LandingPage.findByIdAndUpdate(id, { $inc: { 'stats.leads': 1 } }, { new: true });
  },

  duplicateRecord: async (record, userId) => {
    const copy = new LandingPage({
      userId,
      name: `${record.name} Copy`,
      slug: `${record.slug}-copy-${Date.now().toString(36)}`,
      description: record.description,
      html: record.html,
      thumb: record.thumb,
      status: 'draft',
      stats: { views: 0, leads: 0 },
      publishedAt: null,
    });
    await copy.save();
    return copy;
  },
};

module.exports = LandingPageService;
