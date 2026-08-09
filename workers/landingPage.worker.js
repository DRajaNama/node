const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const logger = require('../helpers/logging');
const LandingPagePublishService = require('../services/landingPagePublish.services');
const { LANDING_PAGE_QUEUE_NAME } = require('../constants/landingPage.constants');

const landingPageWorker = new Worker(
  LANDING_PAGE_QUEUE_NAME,
  async (job) => {
    const { landingPageId, userId } = job.data;
    return await LandingPagePublishService.executeScheduledPublish(landingPageId, userId);
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

landingPageWorker.on('completed', (job) => {
  logger.info('Landing page publish job completed', {
    jobId: job.id,
    landingPageId: job.data.landingPageId,
  });
});

landingPageWorker.on('failed', (job, error) => {
  logger.error('Landing page publish job failed', {
    jobId: job?.id,
    landingPageId: job?.data?.landingPageId,
    error: error.message,
  });
});

module.exports = landingPageWorker;
