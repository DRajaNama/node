const Contact = require('../models/contacts.model');
const ListContact = require('../models/listContact.model');
const CampaignRecipient = require('../models/campaignRecipient.model');
const Message = require('../helpers/constant.message');
const emailQueue = require('../queues/email.queue');
const CampaignService = require('./campaign.services');
const { CAMPAIGN_STATUS, SENDABLE_STATUSES, RECIPIENT_STATUS } = require('../constants/campaign.constants');
const IntegrationService = require('./integration.services');
const UserNotificationService = require('./userNotification.services');
const RealtimeService = require('./realtime.services');
const EntitlementService = require('./entitlement.services');
const { ObjectId } = require('mongodb');

const RESEND_AFTER_MS = 2 * 60 * 60 * 1000;
const RESENDABLE_RECIPIENT_STATUSES = [
    RECIPIENT_STATUS.PENDING,
    RECIPIENT_STATUS.QUEUED,
    RECIPIENT_STATUS.SENDING,
    RECIPIENT_STATUS.FAILED
];

const isStaleSendingCampaign = (campaign) => {
    if (campaign.status !== CAMPAIGN_STATUS.SENDING) return false;
    const sendingStartedAt = campaign.sendingStartedAt || campaign.updatedAt;
    const startedAt = new Date(sendingStartedAt || 0).getTime();
    return Number.isFinite(startedAt) && Date.now() - startedAt >= RESEND_AFTER_MS;
};

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

        const emailIntegration = await IntegrationService.getActiveEmail(userId);
        const smtp = emailIntegration?.provider === 'smtp' ? emailIntegration.config : null;
        if (!smtp) {
            const error = new Error(Message.SMTP_NOT_CONFIGURED);
            error.code = 'SMTP_NOT_CONFIGURED';
            await UserNotificationService.create({
                userId,
                title: 'Email sending needs SMTP',
                message: Message.SMTP_NOT_CONFIGURED,
                type: 'system',
                link: '/integrations/create',
            }).then((notification) => RealtimeService.emitToUser(userId, 'notification', notification)).catch(() => undefined);
            throw error;
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
            campaign.sendingStartedAt = new Date();
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
        campaign.sendingStartedAt = new Date();
        await campaign.save();
        await CampaignSendService.enqueueRecipients(campaign, failedRecipients, userId);

        return campaign;
    },

    resendCampaign: async (campaignId, userId) => {
        const campaign = await CampaignService.findByIdAndUserId(campaignId, userId);
        if (!campaign) throw new Error(Message.DATA_NOT_FOUND);

        if (campaign.status === CAMPAIGN_STATUS.FAILED) {
            return CampaignSendService.retryCampaign(campaignId, userId);
        }

        if (!isStaleSendingCampaign(campaign)) {
            throw new Error(Message.INVALID_STATUS);
        }

        const recipients = await CampaignRecipient.find({
            campaignId: campaign._id,
            status: { $in: RESENDABLE_RECIPIENT_STATUSES }
        });
        if (recipients.length === 0) throw new Error(Message.DATA_NOT_FOUND);

        await CampaignRecipient.updateMany(
            { _id: { $in: recipients.map((recipient) => recipient._id) } },
            {
                $set: { status: RECIPIENT_STATUS.PENDING },
                $unset: { sentAt: 1, bounceReason: 1, bouncedAt: 1, providerMessageId: 1 }
            }
        );
        campaign.status = CAMPAIGN_STATUS.SENDING;
        campaign.sendingStartedAt = new Date();
        campaign.stats.pending = recipients.length;
        campaign.stats.failed = 0;
        await campaign.save();
        await CampaignSendService.enqueueRecipients(campaign, recipients, userId);

        return campaign;
    }
};

module.exports = CampaignSendService;
