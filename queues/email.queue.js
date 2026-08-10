const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');
const { EMAIL_QUEUE_NAME } = require('../constants/campaign.constants');

if (process.env.NODE_ENV === 'test') {
  module.exports = {
    add: async () => null,
    addBulk: async () => [],
  };
} else {
  const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
    connection: redisConnection,
  });
  module.exports = emailQueue;
}
