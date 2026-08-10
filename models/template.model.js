const mongoose = require('mongoose')

const userTemplateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TemplateCategory",
      required: true,
    },
    defaultTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PredefinedTemplate",
      default: null,
    },
    predefinedTemplateVersion: { type: Number, default: null },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    html: {
      type: String,
      required: true,
    },
    thumb: {
      type: String,
      required: true,
      default:'template.png'
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "Template",
  userTemplateSchema
);