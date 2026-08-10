const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, default: '' },
    content: { type: String, default: '' },
    featuredImage: { type: String, default: '' },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogCategory', index: true },
    tags: [{ type: String }],
    seoTitle: { type: String, default: '' },
    seoDescription: { type: String, default: '' },
    status: {
      type: String,
      enum: ['draft', 'published', 'scheduled'],
      default: 'draft',
      index: true,
    },
    publishedAt: { type: Date },
    scheduledAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

blogPostSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model('BlogPost', blogPostSchema);
