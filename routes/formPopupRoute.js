const express = require('express');
const router = express.Router();
const formPopupController = require('../controller/formPopupController');
const authMiddleware = require('../middleware/auth.middleware');
const { validatePayload } = require('../middleware/common.middleware');
const imageUpload = require('../middleware/image.upload.middleware');
const { checkQuota } = require('../middleware/quota.middleware');

router.post('/form-popup/create', authMiddleware, validatePayload, checkQuota('lead_capture_forms'), formPopupController.create);
router.get('/form-popups', authMiddleware, formPopupController.getAll);
router.get('/form-popups/autocomplete', authMiddleware, formPopupController.autocomplete);
router.get('/form-popup/:id', authMiddleware, formPopupController.get);
router.put('/form-popup/update/:id', authMiddleware, validatePayload, formPopupController.updateMeta);
router.post('/form-popup/update/:id', authMiddleware, imageUpload.single('thumb'), validatePayload, formPopupController.updateContent);
router.delete('/form-popup/delete/:id', authMiddleware, formPopupController.delete);
router.put('/form-popup/publish/:id', authMiddleware, formPopupController.publish);
router.put('/form-popup/unpublish/:id', authMiddleware, formPopupController.unpublish);

module.exports = router;
