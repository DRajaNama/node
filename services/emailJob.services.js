const Campaign = require('../models/campaign.model');
const Template = require('../models/template.model');
const sendEmail = require('../helpers/email.provider');
const { replaceTemplateVariables, cleanEmailHtml } = require('../helpers/template.helper');
const CampaignService = require('./campaign.services');
const { CAMPAIGN_STATUS, RECIPIENT_STATUS } = require('../constants/campaign.constants');
const Message = require('../helpers/constant.message');
const SettingsService = require('./setting.services');
const { ObjectId } = require('mongodb');
const UserNotificationService = require('./userNotification.services');
const IntegrationService = require('./integration.services');
const RealtimeService = require('./realtime.services');
const { isRecipientAccepted } = require('../helpers/emailDelivery.helper');

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
    const emailIntegration = await IntegrationService.getActiveEmail(data.userId);
    const smtp = emailIntegration?.provider === 'smtp' ? emailIntegration.config : null;
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
        EMAIL:data.email,
        TRACKTOKEN: data.trackingToken,
        TRACK_OPEN: campaign.settings?.trackOpen !== false,
        TRACK_CLICK: campaign.settings?.trackClick !== false
    });
    html = html; //cleanEmailHtml(html);

    await CampaignService.updateRecipientStatus(data.recipientId, {
        status: RECIPIENT_STATUS.SENDING
    });

    const sendResult = await sendEmail({
        email: data.email,
        subject: campaign.subject,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        html: html
    },smtp);

    if (!isRecipientAccepted(sendResult, data.email)) {
        const rejection = new Error('The SMTP provider rejected the recipient.');
        rejection.code = 'RECIPIENT_REJECTED';
        throw rejection;
    }

    const acceptedAt = new Date();

    await CampaignService.updateRecipientStatus(data.recipientId, {
        status: RECIPIENT_STATUS.DELIVERED,
        sentAt: acceptedAt,
        deliveredAt: acceptedAt,
        providerMessageId: String(sendResult?.messageId || '')
    });

    await CampaignService.createEvent({
        campaignId: data.campaignId,
        recipientId: data.recipientId,
        event: 'sent',
        metadata: { providerMessageId: String(sendResult?.messageId || '') }
    }).catch(() => undefined);

    await CampaignService.createEvent({
        campaignId: data.campaignId,
        recipientId: data.recipientId,
        event: 'delivered',
        metadata: {
            providerMessageId: String(sendResult?.messageId || ''),
            source: 'smtp-accepted'
        }
    }).catch(() => undefined);

    const updatedCampaign = await CampaignService.incrementStats(data.campaignId, {
        'stats.sent': 1,
        'stats.delivered': 1,
        'stats.pending': -1
    });

    if (updatedCampaign?.stats?.pending <= 0 && [ CAMPAIGN_STATUS.SENDING, CAMPAIGN_STATUS.SCHEDULED].includes(updatedCampaign.status)){
        await CampaignService.updateRecord(data.campaignId, {
            status: CAMPAIGN_STATUS.COMPLETED
        });
        RealtimeService.emitToUser(data.userId, 'campaign:updated', {
            campaignId: String(campaign._id),
            status: CAMPAIGN_STATUS.COMPLETED,
        });
        await UserNotificationService.create({
            userId: data.userId,
            title: 'Campaign completed',
            message: `Your campaign "${campaign.name}" has finished sending.`,
            type: 'campaign',
            link: `/campaign/${campaign._id}`,
        }).then((notification) => RealtimeService.emitToUser(data.userId, 'notification', notification)).catch(() => undefined);
    }

    return { skipped: false };
};

const handleEmailJobFailure = async (recipientId, campaignId) => {
    await CampaignService.updateRecipientStatus(recipientId, {
        status: RECIPIENT_STATUS.FAILED
    });

    const updatedCampaign = await CampaignService.incrementStats(campaignId, {
        'stats.failed': 1,
        'stats.pending': -1
    });

    if (updatedCampaign?.status !== CAMPAIGN_STATUS.FAILED) {
        await CampaignService.updateRecord(campaignId, { status: CAMPAIGN_STATUS.FAILED });
        const campaign = await Campaign.findById(campaignId).select('name userId');
        if (campaign) {
            RealtimeService.emitToUser(campaign.userId, 'campaign:updated', {
                campaignId: String(campaign._id),
                status: CAMPAIGN_STATUS.FAILED,
            });
            await UserNotificationService.create({
                userId: campaign.userId,
                title: 'Campaign failed',
                message: `Your campaign "${campaign.name}" could not complete.`,
                type: 'campaign',
                link: `/campaign/${campaign._id}`,
            }).then((notification) => RealtimeService.emitToUser(campaign.userId, 'notification', notification)).catch(() => undefined);
        }
    }
};

module.exports = {
    processEmailJob,
    handleEmailJobFailure
};
