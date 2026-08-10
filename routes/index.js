const express = require("express");
const router = express.Router();

router.use(require("./authRoute"));
router.use(require("./userRoute"));
router.use(require("./aiRoute"));
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
router.use(require("./publicRoute"));

module.exports = router;