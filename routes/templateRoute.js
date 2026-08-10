const express = require('express')
const router = express.Router();

const templateController = require('../controller/templateController');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const { validatePayload } = require('../middleware/common.middleware');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const imageUpload = require('../middleware/image.upload.middleware');
const { checkQuota } = require('../middleware/quota.middleware');

const skipQuotaWhenPredefined = async (req) => {
  const rawId =
    req.body.defaultTemplateId ||
    req.body.predefinedTemplateId ||
    (req.body.templateId && req.body.templateId !== 'blank' ? req.body.templateId : null);
  return rawId ? 0 : 1;
};

router.post('/template/create', authMiddleware, validatePayload, checkQuota('custom_email_templates', skipQuotaWhenPredefined), (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.TEMPLATE_CREATE_ATTEMPT);
  templateController.createTemplate(req, res, next);
});

router.get('/template/:id', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.TEMPLATE_FETCH_ATTEMPT);
  templateController.getTemplate(req, res, next);
});

router.post('/template/update/:id', authMiddleware, imageUpload.single('thumb'), validatePayload ,  (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.TEMPLATE_UPDATE_ATTEMPT);
  templateController.updateTemplate(req, res, next);
});

router.post('/template/updateInfo/:id', authMiddleware, validatePayload ,  (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.TEMPLATE_UPDATE_ATTEMPT);
  templateController.updateTemplate(req, res, next);
});

router.delete('/template/delete/:id', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.TEMPLATE_DELETE_ATTEMPT);
  templateController.deleteTemplate(req, res, next);
});

router.get('/templates', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START + ' - ' + Message.GET_ALL_TEMPLATE_ATTEMPT);
  templateController.getAllTemplates(req, res, next);
});
router.get('/templates/autocomplete', authMiddleware, (req, res, next) => {
  logger.info(Message.LOG_START+' - '+Message.FETCHING_USER_INFO);
  templateController.autocomplete(req, res, next);
});
module.exports = router;