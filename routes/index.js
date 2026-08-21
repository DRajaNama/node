const express = require("express");
const router = express.Router();
const maintenanceMiddleware = require('../middleware/maintenance.middleware');

router.use(maintenanceMiddleware);

router.use(require("./authRoute"));
router.use(require("./userRoute"));
router.use(require("./aiRoute"));
router.use(require("./mediaRoute"));
router.use(require("./stockLibraryRoute"));
router.use(require("./contactRoute"));
router.use(require("./listRoute"));
router.use(require("./templateCategoryRoute"));
router.use(require("./templateRoute"));
router.use(require("./campaignRoute"));
router.use(require("./dashboardRoute"));
router.use(require("./tokenRoute"));
router.use(require("./settingRoute"));
router.use(require("./landingPageRoute"));
router.use(require("./formPopupRoute"));
router.use(require("./leadRoute"));
router.use(require("./predefinedTemplateRoute"));
router.use("/admin", require("./adminRoute"));
router.use(require("./subscriptionRoute"));
router.post('/webhooks/paypal', require('../controller/subscriptionController').paypalWebhook);
router.use(require("./publicRoute"));
router.use(require('./whatsapp.routes'));

module.exports = router;
