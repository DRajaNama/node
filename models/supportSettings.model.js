const mongoose = require('mongoose');

const supportSettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  defaultsSeeded: { type: Boolean, default: false },
  enabled: { type: Boolean, default: true },
  supportEmail: { type: String, trim: true, lowercase: true, default: '' },
  responseSlaHours: { type: Number, default: 24, min: 1, max: 720 },
  allowTicketCreation: { type: Boolean, default: true },
  showKnowledgeBase: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('SupportSettings', supportSettingsSchema);
