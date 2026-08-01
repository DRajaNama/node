const express = require('express');
const router = express.Router();

const CampaignController = require('../controller/campaignController');
const authMiddleware = require('../middleware/auth.middleware');
const { validatePayload } = require('../middleware/common.middleware');

router.post('/campaign/create', authMiddleware, validatePayload, CampaignController.create);
router.get('/campaigns', authMiddleware, CampaignController.getAll);
router.get('/campaign/analytics/:id', authMiddleware, CampaignController.analytics);
router.get('/campaign/recipients/:id', authMiddleware, CampaignController.recipients);
router.get('/campaign/:id', authMiddleware, CampaignController.get);
router.put('/campaign/update/:id', authMiddleware, validatePayload, CampaignController.update);
router.delete('/campaign/delete/:id', authMiddleware, CampaignController.delete);
router.post('/campaign/send/:id', authMiddleware, CampaignController.send);
router.put('/campaign/pause/:id', authMiddleware, CampaignController.pause);
router.put('/campaign/resume/:id', authMiddleware, CampaignController.resume);
router.put('/campaign/cancel/:id', authMiddleware, CampaignController.cancel);

module.exports = router;
