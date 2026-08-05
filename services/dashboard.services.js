const mongoose = require("mongoose");

const Campaign = require("../models/campaign.model");
const CampaignEvent = require("../models/campaignEvent.model");

const DashboardService = {
    getCalendarEvents: async (userId, startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const calendarEvents = [];
        // Scheduled Campaigns
        const campaigns = await Campaign.find({
            userId,
            scheduledAt: {
                $gte: start,
                $lte: end
            }
        }).lean();

        campaigns.forEach((campaign) => {
            calendarEvents.push({
                id: campaign._id,
                campaignId: campaign._id,
                title: campaign.name,
                type: "scheduled",
                start: campaign.scheduledAt,
                end: campaign.scheduledAt,
                status: campaign.status,
                color:
                    campaign.status === "scheduled"
                        ? "#2563eb"
                        : campaign.status === "completed"
                        ? "#16a34a"
                        : "#f59e0b"
            });
        });

        // Campaign Events
        const events = await CampaignEvent.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: start,
                        $lte: end
                    }
                }
            },
            {
                $lookup: {
                    from: "campaigns",
                    localField: "campaignId",
                    foreignField: "_id",
                    as: "campaign"
                }
            },
            {
                $unwind: "$campaign"
            },
            {
                $match: {
                    "campaign.userId": new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $group: {
                    _id: {
                        campaignId: "$campaignId",
                        event: "$event",
                        day: {
                            $dateToString: {
                                format: "%Y-%m-%d",
                                date: "$createdAt"
                            }
                        }
                    },
                    count: {
                        $sum: 1
                    },
                    campaignName: {
                        $first: "$campaign.name"
                    }
                }
            }
        ]);

        const colors = {
            opened: "#10b981",
            clicked: "#8b5cf6",
            delivered: "#2563eb",
            bounced: "#ef4444",
            complaint: "#dc2626",
            unsubscribed: "#f97316",
            sent: "#0ea5e9"
        };
        events.forEach((item) => {
            calendarEvents.push({
                id: `${item._id.campaignId}-${item._id.event}-${item._id.day}`,
                campaignId: item._id.campaignId,
                title: `${item.campaignName} - ${item.count} ${item._id.event}`,
                type: item._id.event,
                start: item._id.day,
                count: item.count,
                color: colors[item._id.event] || "#6b7280"
            });
        });
        return calendarEvents;
    }
};

module.exports = DashboardService;