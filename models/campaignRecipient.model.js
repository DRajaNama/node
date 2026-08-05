const mongoose = require("mongoose");

const campaignRecipientSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true
    },

    email: {
      type: String,
      required: true
    },

    firstName:String,
    lastName:String,

    trackingToken:{
        type:String,
        unique:true,
        index:true
    },

    status: {
      type: String,
      enum: [
        "pending",
        "queued",
        "sending",
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "failed",
        "unsubscribed"
      ],
      default: "pending",
      index: true
    },

    provider: {
      type: String,
      default: ""
    },

    providerMessageId: {
      type: String,
      default: ""
    },

    sentAt: Date,
    deliveredAt: Date,
    openedAt: Date,
    clickedAt: Date,
    bouncedAt: Date,

    bounceReason: String
  },
  {
    timestamps: true,
    versionKey: false
  }
);

campaignRecipientSchema.index({
  campaignId: 1,
  status: 1
});

campaignRecipientSchema.index({
  campaignId: 1,
  contactId: 1
}, {
  unique: true
});

module.exports = mongoose.model(
  "CampaignRecipient",
  campaignRecipientSchema
);