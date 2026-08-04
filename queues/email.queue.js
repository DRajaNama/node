const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');
const { EMAIL_QUEUE_NAME } = require('../constants/campaign.constants');

// uncomment when you need to check redis is ready or not
// const IORedis = require("ioredis");
// const redis = new IORedis(redisConnection);
// redis.on("connect", () => console.log("Redis connected"));
// redis.on("ready", () => console.log("Redis ready"));
// redis.on("error", (err) => console.error("Redis error:", err));

const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
    connection: redisConnection
});

module.exports = emailQueue;
