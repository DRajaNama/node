const TemplateService = require('../services/template.services');
const { templateCreateValidation, templateUpdateValidation } = require('../validations/template.validations');
const { getBlankTemplate } = require('../utils/template.utils');
const EntitlementService = require('../services/entitlement.services');
const PredefinedTemplate = require('../models/predefinedTemplate.model');
const { handleQuotaError } = require('../middleware/quota.middleware');
const QuotaExceededError = require('../helpers/quotaError');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const fs = require('fs').promises;
const path = require('path');


const TemplateController = {

    createTemplate: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.TEMPLATE_CONTROLLER+Message.CREATE_ATTEMPT, req.body);
        try {

            const { errors, isValid } = templateCreateValidation(req.body);
            if (!isValid) {
                logger.error(Message.LOG_END+' - '+Message.TEMPLATE_CONTROLLER+Message.ERROR_IN+Message.CREATE_ATTEMPT, errors);
                return res.status(400).send({ errors });
            }
            let templateData = req.body;
            templateData.userId = req.userId;

            const rawPredefinedId =
              templateData.defaultTemplateId ||
              templateData.predefinedTemplateId ||
              (templateData.templateId && templateData.templateId !== 'blank' ? templateData.templateId : null);

            let predefined = null;
            if (rawPredefinedId) {
              predefined = await PredefinedTemplate.findById(rawPredefinedId);
            }

            if (predefined) {
              templateData.html = predefined.html;
              templateData.defaultTemplateId = predefined._id;
              templateData.predefinedTemplateVersion = predefined.version || 1;
              templateData.thumb = predefined.thumb || 'template.png';
              await PredefinedTemplate.findByIdAndUpdate(predefined._id, { $inc: { useCount: 1 } });
            } else {
              templateData.defaultTemplateId = null;
              templateData.predefinedTemplateVersion = null;
              templateData.status = 'draft';
              templateData.html = templateData.html || getBlankTemplate(templateData).html;
            }

            if (!templateData.status) templateData.status = 'draft';
            const template = await TemplateService.createTemplate(templateData);

            logger.info(Message.LOG_END+' - '+Message.TEMPLATE_CONTROLLER+Message.CREATE_ATTEMPT+Message.SUCCESS, {
                templateId: template._id
            });

            res.send({ data: template, message: Message.SUCCESS });

        } catch (error) {
            if (error instanceof QuotaExceededError) {
                return handleQuotaError(res, error);
            }
            logger.error(Message.LOG_END+' - '+Message.TEMPLATE_CONTROLLER+Message.ERROR_IN+Message.CREATE_ATTEMPT, error);
            res.status(500).send({ data: null, message: Message.SERVER_ERROR });
        }
    },

    getTemplate: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.TEMPLATE_CONTROLLER+Message.FETCHING_INFO, {
            templateId: req.params.id
        });
        try {
            if (!req.params.id) {
                return res.status(400).send({ data: null, message: Message.ID_IS_REQUIRED });
            }

            const template = await TemplateService.getTemplateById(req.params.id);

            if (!template) {
                return res.status(404).send({ data: null, message: Message.NOT_FOUND });
            }
            if (template.userId.toString() !== req.userId) {
                return res.status(403).send({ data: null, message: 'Access denied' });
            }

            logger.info(Message.LOG_END+' - '+Message.TEMPLATE_CONTROLLER+Message.FETCHING_INFO+Message.SUCCESS);

            res.send({ data: template, message: Message.SUCCESS });

        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.TEMPLATE_CONTROLLER+Message.ERROR_IN+Message.FETCHING_INFO, error);
            res.status(500).send({ data: null, message: Message.SERVER_ERROR });
        }
    },

    updateTemplate: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.TEMPLATE_CONTROLLER+Message.UPDATE_ATTEMPT, {
            templateId: req.params.id
        });

        try {

            if (!req.params.id) {
                return res.status(400).send({ data: null, message: Message.ID_IS_REQUIRED });
            }

            const { errors, isValid } = templateUpdateValidation(req.body);
            if (!isValid) {
                logger.error(Message.LOG_END+' - '+Message.TEMPLATE_CONTROLLER+Message.ERROR_IN+Message.UPDATE_ATTEMPT, errors);
                return res.status(400).send({ errors });
            }

            const template = await TemplateService.getTemplateById(req.params.id);

            if (!template) {
                return res.status(404).send({ data: null, message: Message.NOT_FOUND });
            }
            if (template.userId.toString() !== req.userId) {
                return res.status(403).send({ data: null, message: 'Access denied' });
            }
            // HANDLE FILE UPLOAD
            if (req.file) {
            req.body.thumb = req.file.filename; // save only filename
            }
            Object.assign(template, req.body);
            await template.save();

            logger.info(Message.LOG_END+' - '+Message.TEMPLATE_CONTROLLER+Message.UPDATE_ATTEMPT+Message.SUCCESS);

            res.send({ data: template, message: Message.SUCCESS });

        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.TEMPLATE_CONTROLLER+Message.ERROR_IN+Message.UPDATE_ATTEMPT, error);
            res.status(500).send({ data: null, message: Message.SERVER_ERROR });
        }
    },

    deleteTemplate: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.TEMPLATE_CONTROLLER+Message.DELETE_ATTEMPT, {
            templateId: req.params.id
        });

        try {

            if (!req.params.id) {
                return res.status(400).send({ data: null, message: Message.ID_IS_REQUIRED });
            }

            const template = await TemplateService.getTemplateById(req.params.id);

            if (!template) {
                return res.status(404).send({ data: null, message: Message.NOT_FOUND });
            }
            if (template.userId.toString() !== req.userId) {
                return res.status(403).send({ data: null, message: 'Access denied' });
            }

            if(template.thumb){
                 const filePath = path.join(__dirname, '..', 'uploads', 'templates', template.thumb);
                try {
                    await fs.unlink(filePath);
                    console.log('Old thumbnail deleted');
                } catch (err) {
                    // Ignore if file doesn't exist
                    if (err.code !== 'ENOENT') {
                        console.error('Error deleting thumbnail:', err);
                    }
                }
            }

            await TemplateService.deleteTemplate(req.params.id);

            logger.info(Message.LOG_END+' - '+Message.TEMPLATE_CONTROLLER+Message.DELETE_ATTEMPT+Message.SUCCESS);

            res.send({ data: null, message: Message.SUCCESS });

        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.TEMPLATE_CONTROLLER+Message.ERROR_IN+Message.DELETE_ATTEMPT, error);
            res.status(500).send({ data: null, message: Message.SERVER_ERROR });
        }
    },

    getAllTemplates: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.TEMPLATE_CONTROLLER+Message.GET_ALL_ATTEMPT);

        try {

            const ownerFilter = { userId: req.userId };
            let filter = { ...ownerFilter };
            if (req.query.search) {
               filter = {
                    $and: [
                        ownerFilter,
                        {
                            $or: [
                                { title: { $regex: req.query.search, $options: 'i' } },
                            ]
                        }
                    ]
                };
            }
           
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;

            const templates = await TemplateService.getAllTemplates(filter, page, limit);
            const total = await TemplateService.getAllTemplates({ ...filter, countOnly: true });

            logger.info(Message.LOG_END+' - '+Message.TEMPLATE_CONTROLLER+Message.GET_ALL_ATTEMPT+Message.SUCCESS);

            res.send({
                data: templates,
                message: Message.SUCCESS,
                meta: {
                    page,
                    limit,
                    total
                }
            });

        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.TEMPLATE_CONTROLLER+Message.ERROR_IN+Message.GET_ALL_ATTEMPT, error);
            res.status(500).send({ data: null, message: Message.SERVER_ERROR });
        }
    },

    autocomplete: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.TEMPLATE_CONTROLLER+Message.GET_ALL_RECORD_ATTEMPT);
        try {
            const ownerFilter = { userId: req.userId };
            let filter = { ...ownerFilter };
            if (req.query.search) {
               filter = {
                    $and: [
                        ownerFilter,
                        {
                            $or: [
                                { title: { $regex: req.query.search, $options: 'i' } },
                                { description: { $regex: req.query.search, $options: 'i' } },
                                { type: { $regex: req.query.search, $options: 'i' } },
                            ]
                        }
                    ]
                };
            }
            let format = {
                    _id: 1,
                    title: 1,
                    thumb: 1,
                    description:1,
                    templateCount:1
                }
            const data = await TemplateService.getAllTemplates(filter, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 10,format);
            const totalUsers = await TemplateService.getAllTemplates({ ...filter, countOnly: true });
            logger.info(Message.LOG_END+' - '+Message.TEMPLATE_CONTROLLER+Message.GET_ALL_RECORD_ATTEMPT+Message.SUCCESS);
            res.send({ data: data, message: Message.SUCCESS, meta: { page: parseInt(req.query.page) || 1, limit: parseInt(req.query.limit) || 10, total: totalUsers } });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.TEMPLATE_CONTROLLER+Message.GET_ALL_RECORD_ATTEMPT+Message.ERROR_IN, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }
    },
};

module.exports = TemplateController;
