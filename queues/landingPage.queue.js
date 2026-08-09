const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');
const { LANDING_PAGE_QUEUE_NAME } = require('../constants/landingPage.constants');

const landingPageQueue = new Queue(LANDING_PAGE_QUEUE_NAME, {
  connection: redisConnection,
});

module.exports = landingPageQueue;
