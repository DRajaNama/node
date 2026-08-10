const mongoose = require('mongoose');

const notificationTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    senderName: { type: String, default: '' },
    senderEmail: { type: String, default: '' },
    isEnabled: { type: Boolean, default: true },
    variables: [{ type: String }],
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('NotificationTemplate', notificationTemplateSchema);
