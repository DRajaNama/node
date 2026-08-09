const express = require('express');
const router = express.Router();
const publicController = require('../controller/publicController');
const { validatePayload } = require('../middleware/common.middleware');

router.get('/public/landing-page/:slug', publicController.getLandingPage);
router.get('/public/landing-pages/:slug', publicController.getLandingPage);
router.get('/public/form-popup/:id', publicController.getFormPopup);
router.post('/public/lead/submit', validatePayload, publicController.submitLead);

module.exports = router;
