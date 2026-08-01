const Campaign = require('../models/campaign.model');
const Template = require('../models/template.model');
const sendEmail = require('../helpers/email.provider');
const { replaceTemplateVariables } = require('../helpers/template.helper');
const CampaignService = require('./campaign.services');
const { CAMPAIGN_STATUS, RECIPIENT_STATUS } = require('../constants/campaign.constants');

const SKIPPABLE_CAMPAIGN_STATUSES = [
    CAMPAIGN_STATUS.PAUSED,
    CAMPAIGN_STATUS.CANCELLED
];

const processEmailJob = async (data) => {
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

    const html = replaceTemplateVariables(template.html, {
        firstName: data.firstName,
        lastName: data.lastName
    });

    await CampaignService.updateRecipientStatus(data.recipientId, {
        status: RECIPIENT_STATUS.SENDING
    });

    await sendEmail({
        email: data.email,
        subject: campaign.subject,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        html: html
    });

    await CampaignService.updateRecipientStatus(data.recipientId, {
        status: RECIPIENT_STATUS.SENT,
        sentAt: new Date()
    });

    const updatedCampaign = await CampaignService.incrementStats(data.campaignId, {
        'stats.sent': 1,
        'stats.pending': -1
    });

    if (updatedCampaign?.stats?.pending <= 0 && updatedCampaign.status === CAMPAIGN_STATUS.SENDING) {
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
