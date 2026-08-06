const Contact = require('../models/contacts.model');
const ListContact = require('../models/listContact.model');
const Message = require('../helpers/constant.message');
const emailQueue = require('../queues/email.queue');
const CampaignService = require('./campaign.services');
const { CAMPAIGN_STATUS, SENDABLE_STATUSES, RECIPIENT_STATUS } = require('../constants/campaign.constants');
const SettingsService = require('./setting.services');
const { ObjectId } = require('mongodb');

const CampaignSendService = {

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

        const jobs = insertedRecipients.map((recipient) => ({
            name: 'send-email',
            data: {
                userId:userId,
                campaignId: campaign._id.toString(),
                recipientId: recipient._id.toString(),
                contactId: recipient.contactId.toString(),
                email: recipient.email,
                firstName: recipient.firstName,
                lastName: recipient.lastName,
                trackingToken: recipient.trackingToken
            }
        }));

        let queueJobs = jobs;
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
            queueJobs = jobs.map(job => ({
                    ...job,
                    opts: {
                        delay: delay
                    }
                }));

            campaign.status = CAMPAIGN_STATUS.SCHEDULED;


        } else {
            campaign.status = CAMPAIGN_STATUS.SENDING;
        }
        
        await emailQueue.addBulk(queueJobs);

        // campaign.status = CAMPAIGN_STATUS.SENDING;
        campaign.stats.total = insertedRecipients.length;
        campaign.stats.pending = insertedRecipients.length;
        await campaign.save();

        return {
            campaignId: campaign._id,
            totalRecipients: insertedRecipients.length
        };
    }
};

module.exports = CampaignSendService;
