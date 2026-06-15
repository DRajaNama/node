const Contact = require('../models/contact.model');
const Message = require('../helpers/constant.message');

const ContactService = {
    createRecord: async (userData) => {
        try {
            const record = new Contact(userData);
            await record.save();
            return record;
        } catch (error) {
            throw error;
        }
    },
    findRecordById: async (id) => {
        try {
            return await Contact.findById(id);
        } catch (error) {
            throw error;
        }
    },
    getAllRecord: async (filter,page = 1, limit = 10) => {
        try {
            const countOnly = filter.countOnly;
            delete filter.countOnly;
            if (countOnly) {
                return await Contact.countDocuments(filter);
            }
            return await Contact.find(filter).skip((page - 1) * limit).limit(limit);
        } catch (error) {
            throw error;
        }
    },
    updateRecord: async (id, updateData) => {
        try {
            const record = await Contact.findById(id);
            if (!record) {
                throw new Error(Message.USER_NOT_FOUND);
            }
            Object.assign(record, updateData);
            await record.save();
            return record;
        } catch (error) {
            throw error;
        }
    },
    deleteRecord: async (id) => {
        try {
            const record = await Contact.findById(id);
            if (!record) {
                throw new Error(Message.DATA_NOT_FOUND);
            }
            await Contact.deleteOne({ _id: id });
            return;
        } catch (error) {
            throw error;
        }
    },

};

module.exports = ContactService;