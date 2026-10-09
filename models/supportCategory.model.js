const mongoose = require('mongoose');

const supportCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 300, default: '' },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true, versionKey: false });

supportCategorySchema.index({ name: 1 }, { unique: true });
module.exports = mongoose.model('SupportCategory', supportCategorySchema);
