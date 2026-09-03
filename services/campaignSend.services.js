const Contact = require('../models/contacts.model');
const ListContact = require('../models/listContact.model');
const Message = require('../helpers/constant.message');
const emailQueue = require('../queues/email.queue');
const CampaignService = require('./campaign.services');
const { CAMPAIGN_STATUS, SENDABLE_STATUSES, RECIPIENT_STATUS } = require('../constants/campaign.constants');
const SettingsService = require('./setting.services');
const EntitlementService = require('./entitlement.services');
const { ObjectId } = require('mongodb');

const CampaignSendService = {

    enqueueRecipients: async (campaign, recipients, userId, opts = {}) => {
        const jobs = recipients.map((recipient) => ({
            name: 'send-email',
            opts,
            data: {
                userId,
                campaignId: campaign._id.toString(),
                recipientId: recipient._id.toString(),
                contactId: recipient.contactId.toString(),
                email: recipient.email,
                firstName: recipient.firstName,
                lastName: recipient.lastName,
                trackingToken: recipient.trackingToken
            }
        }));

        await emailQueue.addBulk(jobs);
        return jobs.length;
    },

    startCampaign: async (campaignId, userId) => {

        const query = [{
            $match: {
                user: new ObjectId(userId)
            }
        }];
        const smtp = await SettingsService.getUserSMTP(query);
        console.log('smtp',smtp)
        if (!smtp) {
            throw new Error(Message.SMTP_NOT_FOUND);
        }

        const campaign = await CampaignService.findByIdAndUserId(campaignId, userId);

        if (!campaign) {
            throw new Error(Message.DATA_NOT_FOUND);
        }

        if (!SENDABLE_STATUSES.includes(campaign.status)) {
            throw new Error(Message.INVALID_STATUS);
        }

        const listContacts = await ListContact.find({
            userId: userId,
            listId: { $in: campaign.listIds }
        }).select('contactId');

        if (listContacts.length === 0) {
            throw new Error(Message.DATA_NOT_FOUND);
        }

        const contactIdSet = new Set(
            listContacts.map((item) => item.contactId.toString())
        );

        if (campaign.excludedListIds?.length > 0) {
            const excludedContacts = await ListContact.find({
                userId: userId,
                listId: { $in: campaign.excludedListIds }
            }).select('contactId');

            excludedContacts.forEach((item) => {
                contactIdSet.delete(item.contactId.toString());
            });
        }

        const contactIds = [...contactIdSet];

        const contacts = await Contact.find({
            userId: userId,
            _id: { $in: contactIds },
            status: 'active',
            isUnsubscribed: false
        }).select('_id firstName lastName email');

        if (contacts.length === 0) {
            throw new Error(Message.DATA_NOT_FOUND);
        }

        await EntitlementService.checkEmailSendQuota(userId, contacts.length);

        const recipientDocs = contacts.map((contact) => ({
            campaignId: campaign._id,
            userId: userId,
            contactId: contact._id,
            email: contact.email,
            firstName: contact.firstName,
            lastName: contact.lastName,
            status: RECIPIENT_STATUS.PENDING
        }));

        const insertedRecipients = await CampaignService.createRecipients(recipientDocs);

        if (campaign.sendType === "schedule") {
            if (!campaign.scheduledAt) {
                throw new Error(
                    "Schedule time required"
                );
            }
            const delay = new Date(campaign.scheduledAt).getTime() - Date.now();
            if (delay <= 0) {
                throw new Error(
                    "Schedule time must be future"
                );
            }
            campaign.status = CAMPAIGN_STATUS.SCHEDULED;


        } else {
            campaign.status = CAMPAIGN_STATUS.SENDING;
        }
        
        const queueOptions = campaign.sendType === 'schedule'
            ? { delay: new Date(campaign.scheduledAt).getTime() - Date.now() }
            : {};
        await CampaignSendService.enqueueRecipients(campaign, insertedRecipients, userId, queueOptions);

        await EntitlementService.recordEmailSends(userId, insertedRecipients.length);

        // campaign.status = CAMPAIGN_STATUS.SENDING;
        campaign.stats.total = insertedRecipients.length;
        campaign.stats.pending = insertedRecipients.length;
        await campaign.save();

        return campaign;
    },

    retryCampaign: async (campaignId, userId) => {
        const campaign = await CampaignService.findByIdAndUserId(campaignId, userId);
        if (!campaign) throw new Error(Message.DATA_NOT_FOUND);
        if (campaign.status !== CAMPAIGN_STATUS.FAILED) throw new Error(Message.INVALID_STATUS);

        const failedRecipients = await CampaignService.getRecipientsByStatus(
            campaignId,
            RECIPIENT_STATUS.FAILED
        );
        if (failedRecipients.length === 0) throw new Error(Message.DATA_NOT_FOUND);

        await CampaignRecipient.updateMany(
            { _id: { $in: failedRecipients.map((recipient) => recipient._id) } },
            { $set: { status: RECIPIENT_STATUS.PENDING }, $unset: { bounceReason: 1 } }
        );
        await CampaignService.incrementStats(campaignId, {
            'stats.pending': failedRecipients.length,
            'stats.failed': -failedRecipients.length
        });
        campaign.status = CAMPAIGN_STATUS.SENDING;
        await campaign.save();
        await CampaignSendService.enqueueRecipients(campaign, failedRecipients, userId);

        return campaign;
    },

    resendCampaign: async (campaignId, userId) => {
        const campaign = await CampaignService.findByIdAndUserId(campaignId, userId);
        if (!campaign) throw new Error(Message.DATA_NOT_FOUND);
        if (![CAMPAIGN_STATUS.COMPLETED, CAMPAIGN_STATUS.FAILED].includes(campaign.status)) {
            throw new Error(Message.INVALID_STATUS);
        }

        const recipients = await CampaignService.getRecipients(campaignId, 1, 0, false);
        if (recipients.length === 0) throw new Error(Message.DATA_NOT_FOUND);

        await CampaignRecipient.updateMany(
            { campaignId: campaign._id },
            {
                $set: { status: RECIPIENT_STATUS.PENDING },
                $unset: { sentAt: 1, bounceReason: 1, bouncedAt: 1, providerMessageId: 1 }
            }
        );
        campaign.status = CAMPAIGN_STATUS.SENDING;
        campaign.stats.total = recipients.length;
        campaign.stats.pending = recipients.length;
        campaign.stats.sent = 0;
        campaign.stats.delivered = 0;
        campaign.stats.opened = 0;
        campaign.stats.clicked = 0;
        campaign.stats.bounced = 0;
        campaign.stats.failed = 0;
        campaign.stats.unsubscribed = 0;
        await campaign.save();
        await CampaignSendService.enqueueRecipients(campaign, recipients, userId);

        return campaign;
    }
};

module.exports = CampaignSendService;
