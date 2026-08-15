const Campaign = require('../models/campaign.model');
const Template = require('../models/template.model');
const sendEmail = require('../helpers/email.provider');
const { replaceTemplateVariables, cleanEmailHtml } = require('../helpers/template.helper');
const CampaignService = require('./campaign.services');
const { CAMPAIGN_STATUS, RECIPIENT_STATUS } = require('../constants/campaign.constants');
const SettingsService = require('./setting.services');
const { ObjectId } = require('mongodb');

const SKIPPABLE_CAMPAIGN_STATUSES = [
    CAMPAIGN_STATUS.PAUSED,
    CAMPAIGN_STATUS.CANCELLED
];

const processEmailJob = async (data) => {
     const query = [{
        $match: {
            user: new ObjectId(data.userId)
        }
    }];
    const smtp = await SettingsService.getUserSMTP(query);
    if (!smtp) {
        throw new Error(Message.SMTP_NOT_FOUND);
    }
    
    const campaign = await Campaign.findById(data.campaignId);

    if (!campaign) {
        throw new Error('Campaign not found');
    }

    if (SKIPPABLE_CAMPAIGN_STATUSES.includes(campaign.status)) {
        await CampaignService.updateRecipientStatus(data.recipientId, {
            status: RECIPIENT_STATUS.PENDING
        });
        return { skipped: true };
    }

    const template = await Template.findById(campaign.templateId);

    if (!template) {
        throw new Error('Template not found');
    }

    let html = replaceTemplateVariables(template.html, {
        NAME: data.firstName + data.lastName || '',
        TRACKTOKEN : data.trackingToken
    });
    html = cleanEmailHtml(html);

    await CampaignService.updateRecipientStatus(data.recipientId, {
        status: RECIPIENT_STATUS.SENDING
    });

    await sendEmail({
        email: data.email,
        subject: campaign.subject,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        html: html
    },smtp);

    await CampaignService.updateRecipientStatus(data.recipientId, {
        status: RECIPIENT_STATUS.SENT,
        sentAt: new Date()
    });

    const updatedCampaign = await CampaignService.incrementStats(data.campaignId, {
        'stats.sent': 1,
        'stats.pending': -1
    });

    if (updatedCampaign?.stats?.pending <= 0 && [ CAMPAIGN_STATUS.SENDING, CAMPAIGN_STATUS.SCHEDULED].includes(updatedCampaign.status)){
        await CampaignService.updateRecord(data.campaignId, {
            status: CAMPAIGN_STATUS.COMPLETED
        });
    }

    return { skipped: false };
};

const handleEmailJobFailure = async (recipientId, campaignId) => {
    await CampaignService.updateRecipientStatus(recipientId, {
        status: RECIPIENT_STATUS.FAILED
    });

    await CampaignService.incrementStats(campaignId, {
        'stats.failed': 1,
        'stats.pending': -1
    });
};

module.exports = {
    processEmailJob,
    handleEmailJobFailure
};
