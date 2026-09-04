const UserNotificationService = require('../services/userNotification.services');

const UserNotificationController = {
  list: async (req, res) => res.send({ data: await UserNotificationService.list(req.userId, Number(req.query.limit) || 30) }),
  markRead: async (req, res) => {
    await UserNotificationService.markRead(req.userId, req.params.id);
    res.send({ data: null, message: 'Notification marked as read.' });
  },
  markAllRead: async (req, res) => {
    await UserNotificationService.markAllRead(req.userId);
    res.send({ data: null, message: 'Notifications marked as read.' });
  },
};

module.exports = UserNotificationController;