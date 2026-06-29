const TemplateCategory = require('../models/templateCategory.model');
const Message = require('../helpers/constant.message');

const TemplateCategoryService = {
    createCategory: async (categoryData) => {
        try {
            const category = new TemplateCategory(categoryData);
            await category.save();
            return category;
        } catch (error) {
            throw error;
        }
    },

    getCategoryById: async (id) => {
        try {
            return await TemplateCategory.findById(id);
        } catch (error) {
            throw error;
        }
    },

    getAllCategories: async (filter = {}, page = 1, limit = 10) => {
        try {
            const countOnly = filter.countOnly;
            delete filter.countOnly;

            if (countOnly) {
                return await TemplateCategory.countDocuments(filter);
            }

            return await TemplateCategory.find(filter)
                .skip((page - 1) * limit)
                .limit(limit);
        } catch (error) {
            throw error;
        }
    },

    updateCategory: async (id, updateData) => {
        try {
            const category = await TemplateCategory.findById(id);

            if (!category) {
                throw new Error(Message.NOT_FOUND || 'Category not found');
            }

            Object.assign(category, updateData);
            await category.save();

            return category;
        } catch (error) {
            throw error;
        }
    },

    deleteCategory: async (id) => {
        try {
            const category = await TemplateCategory.findById(id);

            if (!category) {
                throw new Error(Message.NOT_FOUND || 'Category not found');
            }

            await TemplateCategory.deleteOne({ _id: id });
            return;
        } catch (error) {
            throw error;
        }
    },
};

module.exports = TemplateCategoryService;