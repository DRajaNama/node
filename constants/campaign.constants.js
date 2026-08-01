const CAMPAIGN_STATUS = {
    DRAFT: 'draft',
    SCHEDULED: 'scheduled',
    PROCESSING: 'processing',
    SENDING: 'sending',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

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
    CAMPAIGN_STATUS,
    SENDABLE_STATUSES,
    RECIPIENT_STATUS,
    EMAIL_QUEUE_NAME
};
