const crypto = require('crypto');
const automationQueue = require('../queues/automation.queue');

const { AUTOMATION_JOB, DEFAULT_JOB_OPTIONS } = automationQueue;

const asId = (value) => String(value?._id || value || '');

const safeQueueError = (error) => {
  const candidate = typeof error?.code === 'string' ? error.code : '';
  return {
    code: /^[A-Z0-9_-]{1,80}$/.test(candidate) ? candidate : 'AUTOMATION_QUEUE_ERROR',
    message: 'Automation background processing failed.',
  };
};

const shouldRunInline = (options = {}) => {
  if (options.inline !== undefined) return !!options.inline;
  return process.env.NODE_ENV === 'test' && process.env.AUTOMATION_TEST_IN_PROCESS === 'true';
};

const actionDelayMs = (automation) => {
  const delayMinutes = Number(
    automation?.actionConfig?.delayMinutes
    ?? automation?.actionConfig?.delay
    ?? 0
  );
  if (!Number.isFinite(delayMinutes) || delayMinutes <= 0) return 0;
  return Math.min(Math.round(delayMinutes * 60000), 30 * 24 * 60 * 60 * 1000);
};

const dispatchLead = async ({ leadId, userId, dispatchId }, options = {}) => {
  const payload = {
    leadId: asId(leadId),
    userId: asId(userId),
    dispatchId: dispatchId || crypto.randomUUID(),
  };
  if (!payload.leadId || !payload.userId) throw new Error('Lead and user IDs are required');

  if (shouldRunInline(options)) {
    const AutomationEngineService = require('./automationEngine.services');
    return AutomationEngineService.processLead(payload, { inline: true });
  }

  return automationQueue.add(AUTOMATION_JOB.PROCESS_LEAD, payload, {
    ...DEFAULT_JOB_OPTIONS,
    jobId: `process-lead-${payload.dispatchId}`,
  });
};

const dispatchExecution = async ({ executionId }, options = {}) => {
  const payload = { executionId: asId(executionId) };
  if (!payload.executionId) throw new Error('Execution ID is required');
  const delay = Math.max(0, Number(options.delay) || 0);

  if (shouldRunInline(options)) {
    const AutomationEngineService = require('./automationEngine.services');
    return AutomationEngineService.executeReservedExecution(payload.executionId, {
      attempt: Number(options.attempt) || 1,
    });
  }

  return automationQueue.add(AUTOMATION_JOB.EXECUTE_AUTOMATION, payload, {
    ...DEFAULT_JOB_OPTIONS,
    delay,
    jobId: `execute-automation-${payload.executionId}`,
  });
};

module.exports = {
  dispatchLead,
  dispatchExecution,
  actionDelayMs,
  safeQueueError,
};
