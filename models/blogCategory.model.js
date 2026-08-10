const mongoose = require('mongoose');

const blogCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('BlogCategory', blogCategorySchema);
