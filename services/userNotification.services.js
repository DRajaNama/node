const UserNotification = require('../models/userNotification.model');

const UserNotificationService = {
  create(data) {
    return UserNotification.create(data);
  },
  async list(userId, limit = 30) {
    const notifications = await UserNotification.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
    const unread = await UserNotification.countDocuments({ userId, readAt: null });
    return { notifications, unread };
  },
  markRead(userId, id) {
    return UserNotification.findOneAndUpdate({ _id: id, userId }, { $set: { readAt: new Date() } });
  },
  markAllRead(userId) {
    return UserNotification.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });
  },
};

module.exports = UserNotificationService;