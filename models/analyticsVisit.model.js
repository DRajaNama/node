const mongoose = require('mongoose');

const analyticsVisitSchema = new mongoose.Schema(
  {
    resourceType: {
      type: String,
      enum: ['landing-page', 'form-popup'],
      required: true,
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    visitorKey: {
      type: String,
      required: true,
    },
    visitCount: {
      type: Number,
      default: 1,
    },
    firstVisitedAt: {
      type: Date,
      default: Date.now,
    },
    lastVisitedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

analyticsVisitSchema.index(
  { resourceType: 1, resourceId: 1, visitorKey: 1 },
  { unique: true }
);

module.exports = mongoose.model('AnalyticsVisit', analyticsVisitSchema);
