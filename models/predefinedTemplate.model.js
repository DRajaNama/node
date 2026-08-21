const mongoose = require('mongoose');
const {
  PREDEFINED_TEMPLATE_TYPES,
  PREDEFINED_TEMPLATE_STATUS,
} = require('../constants/predefinedTemplate.constants');

const predefinedTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    type: {
      type: String,
      enum: Object.values(PREDEFINED_TEMPLATE_TYPES),
      required: true,
      index: true,
    },
    description: { type: String, default: '' },
    thumb: { type: String, default: 'template.png' },
    previewUrl: { type: String, default: '' },
    html: { type: String, default: '' },
    htmlFile: { type: String, default: '' },
    category: { type: String, default: '', trim: true, index: true },
    tags: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: Object.values(PREDEFINED_TEMPLATE_STATUS),
      default: PREDEFINED_TEMPLATE_STATUS.DRAFT,
      index: true,
    },
    displayOrder: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
    useCount: { type: Number, default: 0 },
    ownerType: { type: String, enum: ['system'], default: 'system' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false }
);

predefinedTemplateSchema.index({ type: 1, slug: 1 }, { unique: true });
predefinedTemplateSchema.index({ type: 1, status: 1, displayOrder: 1 });

module.exports = mongoose.model('PredefinedTemplate', predefinedTemplateSchema);
