const mongoose = require("mongoose");

const campaignEventSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true
    },

    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CampaignRecipient",
      required: true,
      index:true
    },

    event: {
      type: String,
      enum: [
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "complaint",
        "unsubscribed"
      ],
      required: true,
      index: true
    },

    ip: String,
    country: String,
    city: String,
    userAgent: String,
    url: String,
    metadata:{
      type:Object,
      default:{}
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

campaignEventSchema.index({
  campaignId: 1,
  event: 1
});

module.exports = mongoose.model(
  "CampaignEvent",
  campaignEventSchema
);