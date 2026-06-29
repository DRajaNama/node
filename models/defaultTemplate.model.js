import mongoose from "mongoose";

const defaultTemplateSchema = new mongoose.Schema(
  {
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TemplateCategory",
      required: true,
    },
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
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    useCount: {
      type: Number,
      default: 0,
    },
    plans: [
      {
        type: String, // e.g. "free", "pro", "enterprise"
      },
    ],
  },
  { timestamps: true }
);

export const DefaultTemplate = mongoose.model(
  "DefaultTemplate",
  defaultTemplateSchema
);