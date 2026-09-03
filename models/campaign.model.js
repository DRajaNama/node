const mongoose = require("mongoose");
const { CAMPAIGN_TYPE, CAMPAIGN_STATUS } = require('../constants/campaign.constants');

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

    type: {
      type: String,
      enum: Object.values(CAMPAIGN_TYPE),
      default: CAMPAIGN_TYPE.EMAIL
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

    contentEditor: {
      type: String,
      enum: ["template", "ckeditor"],
      default: "template"
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
      enum: Object.values(CAMPAIGN_STATUS),
      default: function campaignStatusDefault() {
        return this.type === CAMPAIGN_TYPE.AUTOMATION
          ? CAMPAIGN_STATUS.AUTOMATION
          : CAMPAIGN_STATUS.DRAFT;
      },
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

campaignSchema.pre('validate', function enforceCampaignTypeStatus() {
  if (this.type === CAMPAIGN_TYPE.AUTOMATION) {
    this.status = CAMPAIGN_STATUS.AUTOMATION;
  } else if (this.status === CAMPAIGN_STATUS.AUTOMATION) {
    this.status = CAMPAIGN_STATUS.DRAFT;
  }
});

campaignSchema.index({ userId: 1, status: 1 });
campaignSchema.index({ scheduledAt: 1 });

module.exports = mongoose.model("Campaign", campaignSchema);
