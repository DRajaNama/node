const mongoose = require('mongoose');

const userNotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['campaign', 'automation', 'system'], default: 'system' },
    link: { type: String, default: '' },
    readAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, versionKey: false }
);

userNotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('UserNotification', userNotificationSchema);