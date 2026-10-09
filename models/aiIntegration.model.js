const mongoose = require('mongoose');

const aiIntegrationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  apiKeyEncrypted: { type: String, required: true, select: false },
  lastVerifiedAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('AIIntegration', aiIntegrationSchema);
