const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One SMTP configuration per user
    },

    smtp: {
      host: {
        type: String,
        required: true,
        trim: true,
      },
      port: {
        type: Number,
        required: true,
        default: 587,
      },
      username: {
        type: String,
        required: true,
        trim: true,
      },
      password: {
        type: String,
        required: true, // Encrypt before storing
      },
      encryption: {
        type: String,
        enum: ["TLS", "SSL", "None"],
        default: "TLS",
      },
      authentication: {
        type: Boolean,
        default: true,
      },
    },

    email: {
      senderName: {
        type: String,
        trim: true,
      },
      senderEmail: {
        type: String,
        trim: true,
      },
      replyTo: {
        type: String,
        trim: true,
      },
    },

    company: {
      companyName: {
        type: String,
        trim: true,
      },
      website: {
        type: String,
        trim: true,
      },
      supportEmail: {
        type: String,
        trim: true,
      },
    },

    security: {
      twoFactorEnabled: {
        type: Boolean,
        default: false,
      },
      strongPassword: {
        type: Boolean,
        default: true,
      },
      loginNotifications: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Settings", settingsSchema);