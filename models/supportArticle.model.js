const mongoose = require('mongoose');

const supportArticleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  body: { type: String, required: true, trim: true, maxlength: 30000 },
  kind: { type: String, enum: ['article', 'faq'], default: 'article', index: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportCategory', default: null, index: true },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  sortOrder: { type: Number, default: 0 },
  helpfulYes: { type: Number, default: 0 },
  helpfulNo: { type: Number, default: 0 },
}, { timestamps: true, versionKey: false });

supportArticleSchema.index({ status: 1, kind: 1, sortOrder: 1, updatedAt: -1 });
module.exports = mongoose.model('SupportArticle', supportArticleSchema);
