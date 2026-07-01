const mongoose = require('mongoose')

const templateCategorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    useCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TemplateCategory', templateCategorySchema);




// Welcome
// Promotion
// Newsletter
// Transactional
// Abandoned Cart
// Product Launch
// Re-engagement
// Post-Purchase
// Event / Webinar
// Survey / Feedback
// Seasonal / Holiday
// Referral
