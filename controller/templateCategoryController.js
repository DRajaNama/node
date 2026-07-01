const TemplateCategoryService = require('../services/templateCategory.services');
const {
    templateCategoryCreateValidation,
    templateCategoryUpdateValidation
} = require('../validations/templateCategory.validations');

const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');

const TemplateCategoryController = {

    createCategory: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.CREATE_ATTEMPT, req.body);
        try {

            const { errors, isValid } = templateCategoryCreateValidation(req.body);
            if (!isValid) {
                logger.error(Message.LOG_END+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.ERROR_IN+Message.CREATE_ATTEMPT, errors);
                return res.status(400).send({ errors });
            }

            const category = await TemplateCategoryService.createCategory(req.body);

            logger.info(Message.LOG_END+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.CREATE_ATTEMPT+Message.SUCCESS, {
                categoryId: category._id
            });

            res.send({ data: category, message: Message.SUCCESS });

        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.ERROR_IN+Message.CREATE_ATTEMPT, error);
            res.status(500).send({ data: null, message: Message.SERVER_ERROR });
        }
    },

    getCategory: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.FETCHING_INFO, {
            categoryId: req.params.id
        });
        try {
            if (!req.params.id) {
                return res.status(400).send({ data: null, message: Message.ID_IS_REQUIRED });
            }

            const category = await TemplateCategoryService.getCategoryById(req.params.id);

            if (!category) {
                return res.status(404).send({ data: null, message: Message.NOT_FOUND });
            }

            logger.info(Message.LOG_END+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.FETCHING_INFO+Message.SUCCESS);

            res.send({ data: category, message: Message.SUCCESS });

        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.ERROR_IN+Message.FETCHING_INFO, error);
            res.status(500).send({ data: null, message: Message.SERVER_ERROR });
        }
    },

    updateCategory: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.UPDATE_ATTEMPT, {
            categoryId: req.params.id
        });

        try {

            if (!req.params.id) {
                return res.status(400).send({ data: null, message: Message.ID_IS_REQUIRED });
            }

            const { errors, isValid } = templateCategoryUpdateValidation(req.body);
            if (!isValid) {
                logger.error(Message.LOG_END+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.ERROR_IN+Message.UPDATE_ATTEMPT, errors);
                return res.status(400).send({ errors });
            }

            const category = await TemplateCategoryService.getCategoryById(req.params.id);

            if (!category) {
                return res.status(404).send({ data: null, message: Message.NOT_FOUND });
            }

            Object.assign(category, req.body);
            await category.save();

            logger.info(Message.LOG_END+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.UPDATE_ATTEMPT+Message.SUCCESS);

            res.send({ data: category, message: Message.SUCCESS });

        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.ERROR_IN+Message.UPDATE_ATTEMPT, error);
            res.status(500).send({ data: null, message: Message.SERVER_ERROR });
        }
    },

    deleteCategory: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.DELETE_ATTEMPT, {
            categoryId: req.params.id
        });

        try {

            if (!req.params.id) {
                return res.status(400).send({ data: null, message: Message.ID_IS_REQUIRED });
            }

            const category = await TemplateCategoryService.getCategoryById(req.params.id);

            if (!category) {
                return res.status(404).send({ data: null, message: Message.NOT_FOUND });
            }

            await TemplateCategoryService.deleteCategory(req.params.id);

            logger.info(Message.LOG_END+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.DELETE_ATTEMPT+Message.SUCCESS);

            res.send({ data: null, message: Message.SUCCESS });

        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.ERROR_IN+Message.DELETE_ATTEMPT, error);
            res.status(500).send({ data: null, message: Message.SERVER_ERROR });
        }
    },

    getAllCategories: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.GET_ALL_ATTEMPT);

        try {

            const filter = {};

            if (req.query.title) {
                filter.title = { $regex: req.query.title, $options: 'i' };
            }

            if (req.query.status) {
                filter.status = req.query.status;
            }

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;

            const categories = await TemplateCategoryService.getAllCategories(filter, page, limit);
            const total = await TemplateCategoryService.getAllCategories({ ...filter, countOnly: true });

            logger.info(Message.LOG_END+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.GET_ALL_ATTEMPT+Message.SUCCESS);

            res.send({
                data: categories,
                message: Message.SUCCESS,
                meta: {
                    page,
                    limit,
                    total
                }
            });

        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.TEMPLATE_CATEGORY_CONTROLLER+Message.ERROR_IN+Message.GET_ALL_ATTEMPT, error);
            res.status(500).send({ data: null, message: Message.SERVER_ERROR });
        }
    }
};

module.exports = TemplateCategoryController;