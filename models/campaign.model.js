const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    subject: {
      type: String,
      required: true,
      trim: true
    },

    previewText: {
      type: String,
      default: ""
    },

    fromName: {
      type: String,
      required: true
    },

    fromEmail: {
      type: String,
      required: true
    },

    replyTo: {
      type: String,
      default: ""
    },

    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      required: true
    },

    listIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "List"
    }],

    excludedListIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "List"
    }],

    status: {
      type: String,
      enum: [
        "draft",
        "scheduled",
        "processing",
        "sending",
        "paused",
        "completed",
        "cancelled"
      ],
      default: "draft",
      index: true
    },

    sendType: {
      type: String,
      enum: ["now", "schedule"],
      default: "now"
    },

    scheduledAt: {
      type: Date,
      default: null
    },

    timezone: {
      type: String,
      default: "Asia/Kolkata"
    },

    settings: {
      trackOpen: {
        type: Boolean,
        default: true
      },

      trackClick: {
        type: Boolean,
        default: true
      },

      trackBounce: {
        type: Boolean,
        default: true
      },

      trackUnsubscribe: {
        type: Boolean,
        default: true
      }
    },

    stats: {
      total: {
        type: Number,
        default: 0
      },

      pending: {
        type: Number,
        default: 0
      },

      sent: {
        type: Number,
        default: 0
      },

      delivered: {
        type: Number,
        default: 0
      },

      opened: {
        type: Number,
        default: 0
      },

      clicked: {
        type: Number,
        default: 0
      },

      bounced: {
        type: Number,
        default: 0
      },

      failed: {
        type: Number,
        default: 0
      },

      unsubscribed: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

campaignSchema.index({ userId: 1, status: 1 });
campaignSchema.index({ scheduledAt: 1 });

module.exports = mongoose.model("Campaign", campaignSchema);