const Campaign = require('../models/campaign.model');
const CampaignRecipient = require('../models/campaignRecipient.model');
const CampaignEvent = require('../models/campaignEvent.model');
const Message = require('../helpers/constant.message');
const { ObjectId } = require('mongodb');

const CampaignService = {

    createRecord: async (userData) => {
        const record = new Campaign(userData);
        await record.save();
        return record;
    },

    findRecordById: async (id) => {
        return await Campaign.findById(id);
    },

    findByIdAndUserId: async (campaignId, userId) => {
        return await Campaign.findOne({
            _id: campaignId,
            userId: userId
        });
    },

    findByIdAndUserIdPopulate: async (campaignId, userId) => {

        const campaign = await Campaign.findOne({
            _id: campaignId,
            userId
        })
        .populate({
            path: 'templateId',
            select: '_id title'
        })
        .populate({
            path: 'listIds',
            select: '_id name'
        });

        if (!campaign) {
            return null;
        }

        return {
            ...campaign.toObject(),
            template: campaign.templateId,
            lists: campaign.listIds
        };
    },

    findByNameAndUserId: async (name, userId) => {
        return await Campaign.findOne({
            name: name,
            userId: userId
        });
    },

    getAllRecord: async (filter, page = 1, limit = 10) => {
        const countOnly = filter.countOnly;
        delete filter.countOnly;

        if (countOnly) {
            return await Campaign.countDocuments(filter);
        }

        return await Campaign.find(filter)
            // .populate({
            //     path: "templateId",
            //     select: "name subject thumbnail"
            // })
            // .populate({
            //     path: "listIds",
            //     select: "name"
            // })
            // .populate({
            //     path: "excludedListIds",
            //     select: "name"
            // })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
    },

    updateRecord: async (id, updateData) => {
        const record = await Campaign.findById(id);

        if (!record) {
            throw new Error(Message.DATA_NOT_FOUND);
        }

        Object.assign(record, updateData);
        await record.save();
        return record;
    },

    updateStatus: async (campaignId, userId, status) => {
        const record = await Campaign.findOneAndUpdate(
            { _id: campaignId, userId: userId },
            { status },
            { new: true }
        );

        if (!record) {
            throw new Error(Message.DATA_NOT_FOUND);
        }

        return record;
    },

    deleteRecord: async (id) => {
        const record = await Campaign.findById(id);

        if (!record) {
            throw new Error(Message.DATA_NOT_FOUND);
        }

        await Campaign.deleteOne({ _id: id });
    },

    findByQuery: async (query) => {
        return await Campaign.aggregate(query);
    },

    incrementStats: async (campaignId, increments) => {
        return await Campaign.findByIdAndUpdate(
            campaignId,
            { $inc: increments },
            { new: true }
        );
    },

    getAnalytics: async (campaignId) => {
        const analytics = await CampaignRecipient.aggregate([
            {
                $match: {
                    campaignId: new ObjectId(campaignId)
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    sent: {
                        $sum: {
                            $cond: [
                                { $in: ['$status', ['sent', 'delivered', 'opened', 'clicked']] },
                                1,
                                0
                            ]
                        }
                    },
                    delivered: {
                        $sum: {
                            $cond: [
                                { $in: ['$status', ['delivered', 'opened', 'clicked']] },
                                1,
                                0
                            ]
                        }
                    },
                    opened: {
                        $sum: {
                            $cond: [
                                { $in: ['$status', ['opened', 'clicked']] },
                                1,
                                0
                            ]
                        }
                    },
                    clicked: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'clicked'] }, 1, 0]
                        }
                    },
                    bounced: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'bounced'] }, 1, 0]
                        }
                    },
                    failed: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        return analytics.length > 0 ? analytics[0] : {};
    },

    getRecipients: async (campaignId, page = 1, limit = 10, countOnly = false) => {
        const filter = { campaignId: campaignId };

        if (countOnly) {
            return await CampaignRecipient.countDocuments(filter);
        }

        return await CampaignRecipient.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
    },

    createRecipients: async (data) => {
        return await CampaignRecipient.insertMany(data);
    },

    updateRecipientStatus: async (id, statusData) => {
        return await CampaignRecipient.findByIdAndUpdate(id, statusData, { new: true });
    },

    createEvent: async (data) => {
        const record = new CampaignEvent(data);
        await record.save();
        return record;
    }
};

module.exports = CampaignService;
