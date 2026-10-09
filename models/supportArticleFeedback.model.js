const mongoose = require('mongoose');

const supportArticleFeedbackSchema = new mongoose.Schema({
  articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportArticle', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  helpful: { type: Boolean, required: true },
}, { timestamps: true, versionKey: false });

supportArticleFeedbackSchema.index({ articleId: 1, userId: 1 }, { unique: true });
module.exports = mongoose.model('SupportArticleFeedback', supportArticleFeedbackSchema);
