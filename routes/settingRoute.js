const express = require("express");
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');

const SettingsController = require("../controller/settingController");

// Get current user's settings
router.get("/settings", authMiddleware, SettingsController.get);

// Create or update user's settings
router.post("/settings", authMiddleware, SettingsController.create);

// Update settings
router.put("/settings", authMiddleware, SettingsController.update);


// Test SMTP configuration
router.get("/settings/test-smtp", authMiddleware, SettingsController.testSMTP);

module.exports = router;