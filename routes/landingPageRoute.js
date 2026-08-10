const express = require('express');
const router = express.Router();
const landingPageController = require('../controller/landingPageController');
const authMiddleware = require('../middleware/auth.middleware');
const { validatePayload } = require('../middleware/common.middleware');
const imageUpload = require('../middleware/image.upload.middleware');
const { checkQuota } = require('../middleware/quota.middleware');

router.post('/landing-page/create', authMiddleware, validatePayload, checkQuota('custom_landing_pages'), landingPageController.create);
router.get('/landing-pages', authMiddleware, landingPageController.getAll);
router.get('/landing-page/:id', authMiddleware, landingPageController.get);
router.put('/landing-page/update/:id', authMiddleware, validatePayload, landingPageController.updateMeta);
router.post('/landing-page/update/:id', authMiddleware, imageUpload.single('thumb'), validatePayload, landingPageController.updateContent);
router.delete('/landing-page/delete/:id', authMiddleware, landingPageController.delete);
router.put('/landing-page/publish/:id', authMiddleware, landingPageController.publish);
router.put('/landing-page/schedule/:id', authMiddleware, validatePayload, landingPageController.schedule);
router.put('/landing-page/cancel-schedule/:id', authMiddleware, landingPageController.cancelSchedule);
router.put('/landing-page/reschedule/:id', authMiddleware, validatePayload, landingPageController.reschedule);
router.put('/landing-page/unpublish/:id', authMiddleware, landingPageController.unpublish);
router.post('/landing-page/duplicate/:id', authMiddleware, landingPageController.duplicate);

module.exports = router;
