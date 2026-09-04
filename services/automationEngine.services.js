const crypto = require('crypto');
const Automation = require('../models/automation.model');
const AutomationExecution = require('../models/automationExecution.model');
const Lead = require('../models/lead.model');
const {
  AUTOMATION_STATUS,
  AUTOMATION_TRIGGER,
  AUTOMATION_ACTION,
  AUTOMATION_EXECUTION_STATUS,
  AUTOMATION_TRIGGER_MODE,
} = require('../constants/automation.constants');
const { evaluateConditions } = require('../utils/automationTemplate.utils');
const {
  executeAction,
  safeErrorSummary,
  sanitizeMetadata,
  AutomationActionError,
} = require('./automationAction.services');
const AutomationDispatchService = require('./automationDispatch.services');
const UserNotificationService = require('./userNotification.services');
const RealtimeService = require('./realtime.services');

class AutomationExecutionError extends Error {
  constructor(summary) {
    super(summary.message || 'Automation execution failed.');
    this.name = 'AutomationExecutionError';
    this.code = summary.code || 'AUTOMATION_EXECUTION_FAILED';
    this.safeMessage = summary.message || 'Automation execution failed.';
    this.responseStatus = summary.responseStatus ?? null;
    this.retryable = summary.retryable !== false;
  }
}

const getTriggerMode = (automation) => {
  if (automation.actionType !== AUTOMATION_ACTION.TRIGGER_WEBHOOK) {
    return AUTOMATION_TRIGGER_MODE.EVERY_TIME;
  }
  return automation.actionConfig?.triggerMode === AUTOMATION_TRIGGER_MODE.FIRST_TIME
    ? AUTOMATION_TRIGGER_MODE.FIRST_TIME
    : AUTOMATION_TRIGGER_MODE.EVERY_TIME;
};

const reserveExecution = async ({ automation, lead, dispatchKey }) => {
  const triggerMode = getTriggerMode(automation);
  const normalizedDispatchKey = String(dispatchKey || crypto.randomUUID());

  const data = {
    userId: automation.userId,
    automationId: automation._id,
    leadId: lead._id,
    actionType: automation.actionType,
    status: AUTOMATION_EXECUTION_STATUS.PENDING,
    triggerMode,
    dedupeKey: triggerMode === AUTOMATION_TRIGGER_MODE.FIRST_TIME
      ? AUTOMATION_TRIGGER_MODE.FIRST_TIME
      : null,
    dispatchKey: normalizedDispatchKey,
    actionConfigSnapshot: JSON.parse(JSON.stringify(automation.actionConfig || {})),
    secretsSnapshot: automation.secrets || null,
    metadata: { dispatchKey: normalizedDispatchKey, attempt: 0 },
  };

  try {
    return { execution: await AutomationExecution.create(data), duplicate: false, sameDispatch: false };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const existingForDispatch = await AutomationExecution.findOne({
      automationId: automation._id,
      leadId: lead._id,
      dispatchKey: normalizedDispatchKey,
    });
    if (existingForDispatch) {
      return { execution: existingForDispatch, duplicate: true, sameDispatch: true };
    }
    if (triggerMode !== AUTOMATION_TRIGGER_MODE.FIRST_TIME) throw error;
    const existing = await AutomationExecution.findOne({
      automationId: automation._id,
      leadId: lead._id,
      dedupeKey: AUTOMATION_TRIGGER_MODE.FIRST_TIME,
    });
    if (existing?.status === AUTOMATION_EXECUTION_STATUS.FAILED && existing?.metadata?.enqueueErrorCode) {
      const recovered = await AutomationExecution.findOneAndUpdate(
        {
          _id: existing._id,
          status: AUTOMATION_EXECUTION_STATUS.FAILED,
          'metadata.enqueueErrorCode': { $exists: true },
        },
        {
          $set: {
            status: AUTOMATION_EXECUTION_STATUS.PENDING,
            dispatchKey: normalizedDispatchKey,
            completedAt: null,
            errorMessage: '',
            responseStatus: null,
            'metadata.dispatchKey': normalizedDispatchKey,
            'metadata.attempt': 0,
          },
          $unset: {
            'metadata.enqueueErrorCode': 1,
            'metadata.errorCode': 1,
          },
        },
        { new: true }
      );
      if (recovered) {
        return { execution: recovered, duplicate: true, sameDispatch: true, recovered: true };
      }
    }
    return {
      execution: existing,
      duplicate: true,
      sameDispatch: existing?.dispatchKey === normalizedDispatchKey
        || existing?.metadata?.dispatchKey === normalizedDispatchKey,
    };
  }
};

const processLead = async ({ leadId, userId, dispatchId }, options = {}) => {
  const lead = await Lead.findOne({ _id: leadId, userId }).lean();
  if (!lead) return { matched: 0, queued: 0, skipped: 0 };

  const automations = await Automation.find({
    userId,
    status: AUTOMATION_STATUS.ACTIVE,
    triggerType: AUTOMATION_TRIGGER.NEW_LEAD,
  }).select('+secrets').lean();
  const matching = automations.filter((automation) => evaluateConditions(automation.conditions, lead));
  const dispatchKey = dispatchId || crypto.randomUUID();
  const result = { matched: matching.length, queued: 0, skipped: 0, executionIds: [] };
  const failures = [];

  for (const automation of matching) {
    let reservedExecution = null;
    try {
      const reservation = await reserveExecution({ automation, lead, dispatchKey });
      reservedExecution = reservation.execution;
      if (!reservation.execution) {
        result.skipped += 1;
        continue;
      }
      if (reservation.duplicate && !reservation.sameDispatch) {
        result.skipped += 1;
        continue;
      }
      if (reservation.execution.status === AUTOMATION_EXECUTION_STATUS.SUCCESS) {
        result.skipped += 1;
        continue;
      }

      await AutomationDispatchService.dispatchExecution(
        { executionId: reservation.execution._id },
        {
          delay: AutomationDispatchService.actionDelayMs(automation),
          inline: options.inline === true,
        }
      );
      result.queued += 1;
      result.executionIds.push(String(reservation.execution._id));
    } catch (error) {
      if (reservedExecution && options.inline !== true) {
        const safeQueueError = AutomationDispatchService.safeQueueError(error);
        const completedAt = new Date();
        await AutomationExecution.updateOne(
          {
            _id: reservedExecution._id,
            status: { $in: [
              AUTOMATION_EXECUTION_STATUS.PENDING,
              AUTOMATION_EXECUTION_STATUS.FAILED,
            ] },
          },
          {
            $set: {
              status: AUTOMATION_EXECUTION_STATUS.FAILED,
              completedAt,
              errorMessage: safeQueueError.message,
              responseStatus: null,
              'metadata.enqueueErrorCode': safeQueueError.code,
            },
          }
        );
        await updateAutomationRun(
          automation._id,
          AUTOMATION_EXECUTION_STATUS.FAILED,
          completedAt
        );
      }
      failures.push(error);
    }
  }

  if (failures.length) {
    const error = new Error('One or more automation jobs could not be dispatched.');
    error.code = 'AUTOMATION_DISPATCH_FAILED';
    error.retryable = true;
    throw error;
  }
  return result;
};

const claimExecution = async (executionId, attempt) => {
  const existing = await AutomationExecution.findById(executionId).lean();
  if (!existing || existing.status === AUTOMATION_EXECUTION_STATUS.SUCCESS) return null;
  const normalizedAttempt = Math.max(1, Number(attempt) || 1);
  return AutomationExecution.findOneAndUpdate(
    {
      _id: executionId,
      status: { $ne: AUTOMATION_EXECUTION_STATUS.SUCCESS },
      $or: [
        { 'metadata.attempt': { $exists: false } },
        { 'metadata.attempt': { $lt: normalizedAttempt } },
      ],
    },
    {
      $set: {
        status: AUTOMATION_EXECUTION_STATUS.RUNNING,
        startedAt: existing.startedAt || new Date(),
        completedAt: null,
        errorMessage: '',
        responseStatus: null,
        'metadata.attempt': normalizedAttempt,
      },
      $unset: {
        'metadata.enqueueErrorCode': 1,
      },
    },
    { new: true }
  ).select('+actionConfigSnapshot +secretsSnapshot');
};

const engineSafeSummary = (error) => {
  if (error instanceof AutomationActionError) return safeErrorSummary(error);
  if (error?.name === 'AutomationSecretError' || String(error?.code || '').startsWith('AUTOMATION_SECRET')) {
    return {
      code: error.code,
      message: error.safeMessage || 'Automation credentials are unavailable.',
      responseStatus: null,
      retryable: false,
      metadata: {},
    };
  }
  if (error instanceof AutomationExecutionError) {
    return {
      code: error.code,
      message: error.safeMessage,
      responseStatus: error.responseStatus,
      retryable: error.retryable,
      metadata: {},
    };
  }
  return safeErrorSummary(error);
};

const updateAutomationRun = async (automationId, status, at) => {
  try {
    return await Automation.updateOne(
      {
        _id: automationId,
        $or: [
          { lastRunAt: null },
          { lastRunAt: { $exists: false } },
          { lastRunAt: { $lte: at } },
        ],
      },
      { $set: { lastRunAt: at, lastExecutionStatus: status } }
    );
  } catch {
    // This is denormalized list metadata. It must never retry a completed action.
    return null;
  }
};

const executeReservedExecution = async (executionId, options = {}) => {
  const attempt = Math.max(1, Number(options.attempt) || 1);
  const execution = await claimExecution(executionId, attempt);
  if (!execution) {
    const current = await AutomationExecution.findById(executionId).lean();
    return { skipped: true, status: current?.status || null };
  }

  let automation;
  let actionCompleted = false;
  try {
    automation = await Automation.findOne({
      _id: execution.automationId,
      userId: execution.userId,
    }).select('+secrets');
    const lead = await Lead.findOne({ _id: execution.leadId, userId: execution.userId }).lean();
    if (!automation) {
      throw new AutomationActionError('The automation no longer exists.', {
        code: 'AUTOMATION_NOT_FOUND',
        retryable: false,
      });
    }
    if (automation.status !== AUTOMATION_STATUS.ACTIVE) {
      throw new AutomationActionError('The automation is paused.', {
        code: 'AUTOMATION_INACTIVE',
        retryable: false,
      });
    }
    if (!lead) {
      throw new AutomationActionError('The lead no longer exists.', {
        code: 'LEAD_NOT_FOUND',
        retryable: false,
      });
    }

    const currentAutomation = automation.toObject();
    const actionAutomation = {
      ...currentAutomation,
      actionType: execution.actionType,
      actionConfig: execution.actionConfigSnapshot ?? currentAutomation.actionConfig ?? {},
      secrets: execution.secretsSnapshot ?? currentAutomation.secrets ?? null,
    };
    const actionResult = await executeAction({ automation: actionAutomation, lead, execution });
    actionCompleted = true;
    const completedAt = new Date();
    const metadata = {
      ...(execution.metadata?.toObject?.() || execution.metadata || {}),
      attempt,
      ...sanitizeMetadata(actionResult?.metadata || {}),
    };
    const resultWrite = await AutomationExecution.updateOne(
      { _id: execution._id, 'metadata.attempt': attempt },
      {
        $set: {
          status: AUTOMATION_EXECUTION_STATUS.SUCCESS,
          completedAt,
          errorMessage: '',
          responseStatus: actionResult?.responseStatus ?? null,
          metadata,
        },
      }
    );
    if (!resultWrite.matchedCount) {
      throw new AutomationExecutionError({
        code: 'EXECUTION_RESULT_PERSIST_FAILED',
        message: 'The action completed but its result could not be recorded.',
        retryable: false,
      });
    }
    await updateAutomationRun(automation._id, AUTOMATION_EXECUTION_STATUS.SUCCESS, completedAt);
    await UserNotificationService.create({
      userId: automation.userId,
      title: 'Automation triggered',
      message: `Automation "${automation.name}" completed successfully for a new lead.`,
      type: 'automation',
      link: `/automations/${automation._id}`,
    }).then((notification) => RealtimeService.emitToUser(automation.userId, 'notification', notification)).catch(() => undefined);
    return { skipped: false, status: AUTOMATION_EXECUTION_STATUS.SUCCESS };
  } catch (error) {
    if (actionCompleted) {
      const committedError = error instanceof AutomationExecutionError
        ? error
        : new AutomationExecutionError({
          code: 'ACTION_COMPLETED_BOOKKEEPING_FAILED',
          message: 'The action completed, but bookkeeping could not be finalized.',
          retryable: false,
        });
      committedError.retryable = false;
      throw committedError;
    }
    const summary = engineSafeSummary(error);
    const completedAt = new Date();
    const metadata = {
      ...(execution.metadata?.toObject?.() || execution.metadata || {}),
      attempt,
      errorCode: summary.code,
      ...sanitizeMetadata(summary.metadata || {}),
    };
    await AutomationExecution.updateOne(
      { _id: execution._id, 'metadata.attempt': attempt },
      {
        $set: {
          status: AUTOMATION_EXECUTION_STATUS.FAILED,
          completedAt,
          errorMessage: summary.message,
          responseStatus: summary.responseStatus,
          metadata,
        },
      }
    );
    if (automation?._id) {
      await updateAutomationRun(automation._id, AUTOMATION_EXECUTION_STATUS.FAILED, completedAt);
      await UserNotificationService.create({
        userId: automation.userId,
        title: 'Automation failed',
        message: summary.code === 'SMTP_NOT_CONFIGURED'
          ? 'Automation email could not run because no active SMTP integration is configured. Connect SMTP in Integrations.'
          : `Automation "${automation.name}" failed while processing a new lead.`,
        type: 'automation',
        link: `/automations/${automation._id}`,
      }).then((notification) => RealtimeService.emitToUser(automation.userId, 'notification', notification)).catch(() => undefined);
    }
    throw new AutomationExecutionError(summary);
  }
};

module.exports = {
  AutomationExecutionError,
  getTriggerMode,
  reserveExecution,
  processLead,
  executeReservedExecution,
  updateAutomationRun,
};
