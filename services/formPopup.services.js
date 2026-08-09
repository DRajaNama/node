const FormPopup = require('../models/formPopup.model');
const Message = require('../helpers/constant.message');

const FormPopupService = {
  createRecord: async (data) => {
    const record = new FormPopup(data);
    await record.save();
    return record;
  },

  findById: async (id) => {
    return FormPopup.findById(id);
  },

  findByIdAndUserId: async (id, userId) => {
    return FormPopup.findOne({ _id: id, userId });
  },

  findPublishedById: async (id) => {
    return FormPopup.findOne({ _id: id, status: 'published' });
  },

  getAllRecord: async (filter = {}, page = 1, limit = 10, format = {}) => {
    const countOnly = filter.countOnly;
    delete filter.countOnly;
    if (countOnly) {
      return FormPopup.countDocuments(filter);
    }
    const query = FormPopup.find(filter, format)
      .select('-html')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    return query;
  },

  updateRecord: async (id, updateData) => {
    const record = await FormPopup.findById(id);
    if (!record) {
      throw new Error(Message.DATA_NOT_FOUND);
    }
    Object.assign(record, updateData);
    await record.save();
    return record;
  },

  deleteRecord: async (id) => {
    const record = await FormPopup.findById(id);
    if (!record) {
      throw new Error(Message.DATA_NOT_FOUND);
    }
    await FormPopup.deleteOne({ _id: id });
    return record;
  },
};

module.exports = FormPopupService;
