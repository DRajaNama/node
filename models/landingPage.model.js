const mongoose = require('mongoose');

const landingPageSchema = new mongoose.Schema(
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
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
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
      default: 'landing.png',
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'published', 'unpublished'],
      default: 'draft',
      index: true,
    },
    publishType: {
      type: String,
      enum: ['now', 'schedule'],
      default: 'now',
    },
    scheduledPublishAt: {
      type: Date,
      default: null,
      index: true,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    scheduleJobId: {
      type: String,
      default: null,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    stats: {
      views: { type: Number, default: 0 },
      leads: { type: Number, default: 0 },
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    seo: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      ogTitle: { type: String, default: '' },
      ogDescription: { type: String, default: '' },
      ogImage: { type: String, default: '' },
      canonicalUrl: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

landingPageSchema.index({ userId: 1, slug: 1 }, { unique: true });
landingPageSchema.index({ userId: 1, status: 1 });
landingPageSchema.index({ slug: 1, status: 1 });

module.exports = mongoose.model('LandingPage', landingPageSchema);
