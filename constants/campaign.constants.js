const CAMPAIGN_TYPE = Object.freeze({
    EMAIL: 'email',
    AUTOMATION: 'automation'
});

const CAMPAIGN_STATUS = Object.freeze({
    DRAFT: 'draft',
    AUTOMATION: 'automation',
    SCHEDULED: 'scheduled',
    PROCESSING: 'processing',
    SENDING: 'sending',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
});

const SENDABLE_STATUSES = [
    CAMPAIGN_STATUS.DRAFT,
    CAMPAIGN_STATUS.SCHEDULED
];

const RECIPIENT_STATUS = {
    PENDING: 'pending',
    QUEUED: 'queued',
    SENDING: 'sending',
    SENT: 'sent',
    DELIVERED: 'delivered',
    OPENED: 'opened',
    CLICKED: 'clicked',
    BOUNCED: 'bounced',
    FAILED: 'failed',
    UNSUBSCRIBED: 'unsubscribed'
};

const EMAIL_QUEUE_NAME = 'email-send';

module.exports = {
    CAMPAIGN_TYPE,
    CAMPAIGN_STATUS,
    SENDABLE_STATUSES,
    RECIPIENT_STATUS,
    EMAIL_QUEUE_NAME
};
