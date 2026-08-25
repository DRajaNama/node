const express = require('express');
const router = express.Router();
const AutomationController = require('../controller/automationController');
const authMiddleware = require('../middleware/auth.middleware');
const { validatePayload } = require('../middleware/common.middleware');
const { checkFeature, checkQuota } = require('../middleware/quota.middleware');
const { FEATURE_KEYS, RESOURCE_KEYS } = require('../config/entitlements.registry');
const permissionMiddleware = require('../middleware/permission.middleware');
const { PERMISSIONS } = require('../config/permissions');

const automationAccess = [authMiddleware, checkFeature(FEATURE_KEYS.MARKETING_AUTOMATION)];
const withPermission = (permission) => [...automationAccess, permissionMiddleware(permission)];

router.get('/automations/options', withPermission(PERMISSIONS.AUTOMATIONS_VIEW), AutomationController.options);
router.get('/automations', withPermission(PERMISSIONS.AUTOMATIONS_VIEW), AutomationController.list);
router.post(
  '/automations',
  withPermission(PERMISSIONS.AUTOMATIONS_CREATE),
  validatePayload,
  checkQuota(RESOURCE_KEYS.AUTOMATION_WORKFLOWS),
  AutomationController.create
);
router.get('/automations/:id/executions', withPermission(PERMISSIONS.AUTOMATIONS_LOGS_VIEW), AutomationController.executions);
router.patch('/automations/:id/status', withPermission(PERMISSIONS.AUTOMATIONS_TOGGLE), validatePayload, AutomationController.updateStatus);
router.post(
  '/automations/:id/duplicate',
  withPermission(PERMISSIONS.AUTOMATIONS_CREATE),
  checkQuota(RESOURCE_KEYS.AUTOMATION_WORKFLOWS),
  AutomationController.duplicate
);
router.get('/automations/:id', withPermission(PERMISSIONS.AUTOMATIONS_VIEW), AutomationController.get);
router.put('/automations/:id', withPermission(PERMISSIONS.AUTOMATIONS_EDIT), validatePayload, AutomationController.update);
router.delete('/automations/:id', withPermission(PERMISSIONS.AUTOMATIONS_DELETE), AutomationController.delete);

module.exports = router;
