const Contact = require('../models/contacts.model');
const ListContact = require('../models/listContact.model');
const Message = require('../helpers/constant.message');
const emailQueue = require('../queues/email.queue');
const CampaignService = require('./campaign.services');
const { CAMPAIGN_STATUS, SENDABLE_STATUSES, RECIPIENT_STATUS } = require('../constants/campaign.constants');

const CampaignSendService = {

    startCampaign: async (campaignId, userId) => {
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
                campaignId: campaign._id.toString(),
                recipientId: recipient._id.toString(),
                contactId: recipient.contactId.toString(),
                email: recipient.email,
                firstName: recipient.firstName,
                lastName: recipient.lastName
            }
        }));

        await emailQueue.addBulk(jobs);

        campaign.status = CAMPAIGN_STATUS.SENDING;
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
