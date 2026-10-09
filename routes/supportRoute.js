const express = require('express');
const fs = require('fs');
const auth = require('../middleware/auth.middleware');
const admin = require('../middleware/admin.middleware');
const permission = require('../middleware/permission.middleware');
const { PERMISSIONS } = require('../config/permissions');
const controller = require('../controller/support.controller');
const { upload } = require('../middleware/supportAttachment.upload.middleware');

const router = express.Router();
const supportFiles = (req, res, next) => upload.array('attachments', 5)(req, res, (error) => {
  if (error) return res.status(400).send({ message: error.message || 'Attachment upload failed.' });
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      for (const file of req.files || []) fs.promises.unlink(file.path).catch(() => {});
    }
  });
  next();
});
router.use('/support', auth);
router.get('/support/overview', controller.overview);
router.get('/support/tickets', controller.listTickets);
router.post('/support/tickets', supportFiles, controller.createTicket);
router.get('/support/tickets/:id', controller.getTicket);
router.post('/support/tickets/:id/messages', supportFiles, controller.reply);
router.get('/support/tickets/:id/attachments/:storedName', controller.downloadAttachment);
router.post('/support/articles/:id/feedback', controller.articleFeedback);

const adminRead = [auth, admin, permission(PERMISSIONS.SETTINGS_VIEW)];
const adminWrite = [auth, admin, permission(PERMISSIONS.SETTINGS_MANAGE)];
router.get('/admin/support/stats', ...adminRead, controller.adminStats);
router.get('/admin/support/agents', ...adminRead, controller.adminAgents);
router.get('/admin/support', ...adminRead, controller.adminListTickets);
router.patch('/admin/support/:id', ...adminWrite, controller.adminUpdateTicket);
router.post('/admin/support/:id/messages', ...adminWrite, supportFiles, controller.adminReply);
router.get('/admin/support/:id/attachments/:storedName', ...adminRead, controller.downloadAttachment);
router.get('/admin/support/categories', ...adminRead, controller.adminCategories);
router.post('/admin/support/categories', ...adminWrite, controller.saveCategory);
router.put('/admin/support/categories/:id', ...adminWrite, controller.saveCategory);
router.delete('/admin/support/categories/:id', ...adminWrite, controller.deleteCategory);
router.get('/admin/support/articles', ...adminRead, controller.adminArticles);
router.post('/admin/support/articles', ...adminWrite, controller.saveArticle);
router.put('/admin/support/articles/:id', ...adminWrite, controller.saveArticle);
router.delete('/admin/support/articles/:id', ...adminWrite, controller.deleteArticle);
router.get('/admin/support/settings', ...adminRead, controller.adminSettings);
router.put('/admin/support/settings', ...adminWrite, controller.updateSettings);
router.put('/admin/support/:id', ...adminWrite, controller.adminUpdateTicket);
router.get('/admin/support/:id', ...adminRead, controller.adminGetTicket);

module.exports = router;
