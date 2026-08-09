const mongoose = require('mongoose');

const formPopupSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    html: {
      type: String,
      required: true,
    },
    thumb: {
      type: String,
      default: 'popup.png',
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'unpublished'],
      default: 'draft',
      index: true,
    },
    settings: {
      width: { type: Number, default: 420 },
      position: { type: String, default: 'center' },
      overlay: { type: String, default: '#00000099' },
      animation: { type: String, default: 'fade' },
      delay: { type: Number, default: 0 },
      trigger: { type: String, default: 'load' },
      closeButton: { type: Boolean, default: true },
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

formPopupSchema.index({ userId: 1, name: 1 });

module.exports = mongoose.model('FormPopup', formPopupSchema);
