const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['image', 'video'], required: true, index: true },
  source: { type: String, enum: ['upload', 'pixabay'], default: 'upload' },
  sourceId: { type: String, default: '' },
  originalName: { type: String, required: true },
  fileName: { type: String, default: '' },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  storageKey: { type: String, default: '' },
  url: { type: String, required: true },
}, { timestamps: true, versionKey: false });

mediaSchema.index({ userId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('Media', mediaSchema);
