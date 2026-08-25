const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

const AUTOMATION_QUEUE_NAME = 'automation-execution';
const AUTOMATION_JOB = Object.freeze({
  PROCESS_LEAD: 'process-lead',
  EXECUTE_AUTOMATION: 'execute-automation',
});

const DEFAULT_JOB_OPTIONS = Object.freeze({
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { age: 86400, count: 10000 },
  removeOnFail: { age: 604800, count: 20000 },
});

if (process.env.NODE_ENV === 'test') {
  module.exports = {
    name: AUTOMATION_QUEUE_NAME,
    add: async (name, data, options = {}) => ({ id: options.jobId || `${name}-test`, name, data, opts: options }),
    close: async () => undefined,
    AUTOMATION_QUEUE_NAME,
    AUTOMATION_JOB,
    DEFAULT_JOB_OPTIONS,
  };
} else {
  const automationQueue = new Queue(AUTOMATION_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
  automationQueue.AUTOMATION_QUEUE_NAME = AUTOMATION_QUEUE_NAME;
  automationQueue.AUTOMATION_JOB = AUTOMATION_JOB;
  automationQueue.DEFAULT_JOB_OPTIONS = DEFAULT_JOB_OPTIONS;
  module.exports = automationQueue;
}
