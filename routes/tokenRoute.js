const express = require("express");
const router = express.Router();
const TrackingController = require("../controller/tracking.controller");

router.get("/track/open/:token.png", TrackingController.open);
router.get( "/track/click/:token", TrackingController.click);

module.exports = router;