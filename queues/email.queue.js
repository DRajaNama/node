const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');
const { EMAIL_QUEUE_NAME } = require('../constants/campaign.constants');

const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
    connection: redisConnection
});

module.exports = emailQueue;
