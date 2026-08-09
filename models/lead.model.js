const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    landingPageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LandingPage',
      default: null,
      index: true,
    },
    formPopupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FormPopup',
      default: null,
      index: true,
    },
    firstName: { type: String, default: '', trim: true },
    lastName: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    phone: { type: String, default: '', trim: true },
    fields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    source: {
      type: String,
      enum: ['landing-page', 'form-popup'],
      default: 'landing-page',
    },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

leadSchema.index({ userId: 1, createdAt: -1 });
leadSchema.index({ userId: 1, email: 1 });

module.exports = mongoose.model('Lead', leadSchema);
