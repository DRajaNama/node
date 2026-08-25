const { Worker, UnrecoverableError } = require('bullmq');
const redisConnection = require('../config/redis');
const logger = require('../helpers/logging');
const AutomationEngineService = require('../services/automationEngine.services');
const automationQueue = require('../queues/automation.queue');

const { AUTOMATION_QUEUE_NAME, AUTOMATION_JOB } = automationQueue;

if (process.env.NODE_ENV === 'test') {
  module.exports = null;
} else {
  const automationWorker = new Worker(
    AUTOMATION_QUEUE_NAME,
    async (job) => {
      if (job.name === AUTOMATION_JOB.PROCESS_LEAD) {
        return AutomationEngineService.processLead(job.data, { inline: false });
      }
      if (job.name === AUTOMATION_JOB.EXECUTE_AUTOMATION) {
        try {
          return await AutomationEngineService.executeReservedExecution(job.data.executionId, {
            attempt: job.attemptsMade + 1,
          });
        } catch (error) {
          if (error?.retryable === false) {
            throw new UnrecoverableError(error.safeMessage || 'Automation action cannot be retried.');
          }
          const retryableError = new Error('Automation action failed and will be retried.');
          retryableError.code = 'AUTOMATION_ACTION_RETRY';
          throw retryableError;
        }
      }
      throw new UnrecoverableError('Unknown automation job type.');
    },
    {
      connection: redisConnection,
      concurrency: 10,
    }
  );

  automationWorker.on('completed', (job) => {
    logger.info('Automation job completed', {
      jobId: job.id,
      jobName: job.name,
      executionId: job.data?.executionId,
      leadId: job.data?.leadId,
    });
  });

  automationWorker.on('failed', (job) => {
    logger.error('Automation job failed', {
      jobId: job?.id,
      jobName: job?.name,
      executionId: job?.data?.executionId,
      leadId: job?.data?.leadId,
      code: 'AUTOMATION_JOB_FAILED',
    });
  });

  module.exports = automationWorker;
}
