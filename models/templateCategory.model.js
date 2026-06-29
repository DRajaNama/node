import mongoose from "mongoose";

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

export const TemplateCategory = mongoose.model(
  "TemplateCategory",
  templateCategorySchema
);