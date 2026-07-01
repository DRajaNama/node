const Template = require('../models/template.model');
const Message = require('../helpers/constant.message');

const TemplateService = {
    createTemplate: async (templateData) => {
        try {
            const template = new Template(templateData);
            await template.save();
            return template;
        } catch (error) {
            console.log('error', error);
            throw new Error(Message.ERROR_IN + Message.TEMPLATE_CREATED);
        }
    },

    getTemplateById: async (id) => {
        try {
            return await Template.findById(id);
        } catch (error) {
            throw new Error(Message.ERROR_IN + Message.TEMPLATE_FETCH_ATTEMPT);
        }
    },

    getAllTemplates: async (filter = {}, page = 1, limit = 10) => {
        try {
            const countOnly = filter.countOnly;
            delete filter.countOnly;

            if (countOnly) {
                return await Template.countDocuments(filter);
            }

            return await Template.find(filter)
                .skip((page - 1) * limit)
                .limit(limit);
        } catch (error) {
            throw new Error(Message.ERROR_IN + Message.TEMPLATE_FETCH_ATTEMPT);
        }
    },

    updateTemplate: async (id, updateData) => {
        try {
            const template = await Template.findById(id);

            if (!template) {
                throw new Error(Message.TEMPLATE_NOT_FOUND);
            }

            Object.assign(template, updateData);
            await template.save();

            return template;
        } catch (error) {
            throw new Error(Message.ERROR_IN + Message.TEMPLATE_UPDATE_ATTEMPT);
        }
    },

    deleteTemplate: async (id) => {
        try {
            const template = await Template.findById(id);

            if (!template) {
                throw new Error(Message.TEMPLATE_NOT_FOUND);
            }

            await Template.deleteOne({ _id: id });
            return;
        } catch (error) {
            throw new Error(Message.ERROR_IN + Message.TEMPLATE_DELETED);
        }
    },
};

module.exports = TemplateService;