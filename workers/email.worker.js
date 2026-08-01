const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const logger = require('../helpers/logging');
const { processEmailJob, handleEmailJobFailure } = require('../services/emailJob.services');
const { EMAIL_QUEUE_NAME } = require('../constants/campaign.constants');

const emailWorker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job) => {
        return await processEmailJob(job.data);
    },
    {
        connection: redisConnection,
        concurrency: 10
    }
);

emailWorker.on('completed', (job) => {
    logger.info('Email job completed', { jobId: job.id, recipientId: job.data.recipientId });
});

emailWorker.on('failed', async (job, error) => {
    logger.error('Email job failed', { jobId: job?.id, error: error.message });

    if (job?.data?.recipientId && job?.data?.campaignId) {
        await handleEmailJobFailure(job.data.recipientId, job.data.campaignId);
    }
});

module.exports = emailWorker;
