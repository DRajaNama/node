const mongoose = require('mongoose');
const AutomationService = require('../services/automation.services');
const { AutomationServiceError } = require('../services/automation.services');
const AutomationConfigService = require('../services/automationConfig.services');
const {
  automationCreateValidation,
  automationStatusValidation,
} = require('../validations/automation.validations');
const {
  AUTOMATION_STATUS,
  AUTOMATION_TRIGGER,
  AUTOMATION_ACTION,
  AUTOMATION_CONDITION_TYPE,
  AUTOMATION_CONDITION_LOGIC,
} = require('../constants/automation.constants');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');

const WRITABLE_FIELDS = [
  'name',
  'description',
  'status',
  'triggerType',
  'conditions',
  'actionType',
  'actionConfig',
];

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

const defaultConditions = () => ({
  type: AUTOMATION_CONDITION_TYPE.ALL,
  logic: AUTOMATION_CONDITION_LOGIC.AND,
  rules: [],
});

const normalizeConditions = (conditions) => {
  if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) return conditions;
  return {
    ...conditions,
    logic: conditions.logic || AUTOMATION_CONDITION_LOGIC.AND,
    rules: Array.isArray(conditions.rules) ? conditions.rules : conditions.rules,
  };
};

const normalizeActionConfig = (actionType, config) => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return config;
  const normalized = { ...config };
  if (
    actionType === AUTOMATION_ACTION.SEND_EMAIL_CAMPAIGN &&
    normalized.delayMinutes === undefined &&
    normalized.delay !== undefined
  ) {
    normalized.delayMinutes = normalized.delay;
    delete normalized.delay;
  }
  return normalized;
};

const buildCandidate = (body, existing = null) => {
  const source = existing?.toObject ? existing.toObject() : existing || {};
  const candidate = existing
    ? WRITABLE_FIELDS.reduce((result, field) => {
        result[field] = source[field];
        return result;
      }, {})
    : {
        description: '',
        status: AUTOMATION_STATUS.ACTIVE,
        triggerType: AUTOMATION_TRIGGER.NEW_LEAD,
        conditions: defaultConditions(),
      };

  WRITABLE_FIELDS.forEach((field) => {
    if (hasOwn(body, field)) candidate[field] = body[field];
  });

  if (typeof candidate.name === 'string') candidate.name = candidate.name.trim();
  if (typeof candidate.description === 'string') candidate.description = candidate.description.trim();
  candidate.conditions = normalizeConditions(candidate.conditions);
  candidate.actionConfig = normalizeActionConfig(candidate.actionType, candidate.actionConfig);
  return candidate;
};

const ensureValidId = (id, res) => {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).send({ data: null, message: 'Automation ID is invalid' });
    return false;
  }
  return true;
};

const sendValidationErrors = (res, errors) => res.status(400).send({ errors });

const handleError = (res, action, error) => {
  logger.error(`AutomationController ${action} error`, {
    error: error?.message || 'Unknown error',
    name: error?.name,
  });
  if (error instanceof AutomationServiceError) {
    return res.status(error.statusCode || 400).send({ data: null, message: error.message });
  }
  if (error?.name === 'AutomationSecretError') {
    const status = error.code === 'AUTOMATION_ENCRYPTION_KEY_REQUIRED' ? 500 : 400;
    return res.status(status).send({
      data: null,
      message: error.safeMessage || 'Automation credentials are invalid',
    });
  }
  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return res.status(400).send({ data: null, message: 'Automation data is invalid' });
  }
  return res.status(500).send({ data: null, message: Message.SERVER_ERROR });
};

const getOwnedAutomation = async (req, res, { includeSecrets = false } = {}) => {
  if (!ensureValidId(req.params.id, res)) return null;
  const record = await AutomationService.findByIdAndUserId(
    req.params.id,
    req.userId,
    { includeSecrets }
  );
  if (!record) {
    res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
    return null;
  }
  return record;
};

const prepareCreateData = async (body, userId) => {
  const candidate = buildCandidate(body);
  const { errors, isValid } = automationCreateValidation(candidate);
  if (!isValid) return { errors };

  await AutomationService.validateActionReferences(userId, candidate.actionType, candidate.actionConfig);
  const prepared = await AutomationConfigService.prepareAutomationWrite({
    actionType: candidate.actionType,
    actionConfig: candidate.actionConfig,
  });

  return {
    data: {
      ...candidate,
      userId,
      createdBy: userId,
      actionConfig: prepared.actionConfig,
      secrets: prepared.secrets ?? null,
    },
  };
};

const prepareUpdateData = async (body, record, userId) => {
  const source = record.toObject();
  const actionChanged = hasOwn(body, 'actionType') && body.actionType !== source.actionType;
  if (actionChanged && !hasOwn(body, 'actionConfig')) {
    return { errors: { actionConfig: 'Action configuration is required when changing the action' } };
  }

  const candidate = buildCandidate(body, record);
  const { errors, isValid } = automationCreateValidation(candidate);
  if (!isValid) return { errors };

  await AutomationService.validateActionReferences(userId, candidate.actionType, candidate.actionConfig);

  const data = {
    name: candidate.name,
    description: candidate.description,
    status: candidate.status,
    triggerType: candidate.triggerType,
    conditions: candidate.conditions,
    actionType: candidate.actionType,
  };

  if (hasOwn(body, 'actionConfig') || actionChanged) {
    const prepared = await AutomationConfigService.prepareAutomationWrite(
      { actionType: candidate.actionType, actionConfig: candidate.actionConfig },
      { existingSecrets: source.secrets }
    );
    data.actionConfig = prepared.actionConfig;
    if (prepared.secrets !== undefined) data.secrets = prepared.secrets;
  }

  return { data };
};

const AutomationController = {
  list: async (req, res) => {
    try {
      const { page, limit } = AutomationService.parsePagination(req.query, {
        page: 1,
        limit: 12,
        maxLimit: 100,
      });
      const filter = AutomationService.buildListFilter(req.userId, req.query);
      const [records, total] = await Promise.all([
        AutomationService.getAllRecord(filter, page, limit),
        AutomationService.countRecords(filter),
      ]);
      const data = await Promise.all(records.map(AutomationService.serializeAutomation));
      res.send({
        data,
        message: Message.DATA_FOUND,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      handleError(res, 'List', error);
    }
  },

  options: async (req, res) => {
    try {
      const data = await AutomationService.getOptions(req.userId);
      res.send({ data, message: Message.DATA_FOUND });
    } catch (error) {
      handleError(res, 'Options', error);
    }
  },

  get: async (req, res) => {
    try {
      const record = await getOwnedAutomation(req, res);
      if (!record) return;
      const data = await AutomationService.serializeAutomation(record);
      res.send({ data, message: Message.DATA_FOUND });
    } catch (error) {
      handleError(res, 'Get', error);
    }
  },

  create: async (req, res) => {
    try {
      const prepared = await prepareCreateData(req.body, req.userId);
      if (prepared.errors) return sendValidationErrors(res, prepared.errors);
      const record = await AutomationService.createRecord(prepared.data);
      const data = await AutomationService.serializeAutomation(record);
      res.send({ data, message: Message.RECORD_CREATED });
    } catch (error) {
      handleError(res, 'Create', error);
    }
  },

  update: async (req, res) => {
    try {
      const existing = await getOwnedAutomation(req, res, { includeSecrets: true });
      if (!existing) return;
      const prepared = await prepareUpdateData(req.body, existing, req.userId);
      if (prepared.errors) return sendValidationErrors(res, prepared.errors);
      const record = await AutomationService.updateRecord(
        existing._id,
        req.userId,
        prepared.data
      );
      const data = await AutomationService.serializeAutomation(record);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      handleError(res, 'Update', error);
    }
  },

  delete: async (req, res) => {
    try {
      const existing = await getOwnedAutomation(req, res);
      if (!existing) return;
      await AutomationService.deleteRecord(existing._id, req.userId);
      res.send({ data: null, message: Message.RECORD_DELETED });
    } catch (error) {
      handleError(res, 'Delete', error);
    }
  },

  updateStatus: async (req, res) => {
    try {
      const existing = await getOwnedAutomation(req, res);
      if (!existing) return;
      const { errors, isValid } = automationStatusValidation(req.body);
      if (!isValid) return sendValidationErrors(res, errors);
      const record = await AutomationService.updateStatus(existing._id, req.userId, req.body.status);
      const data = await AutomationService.serializeAutomation(record);
      res.send({ data, message: Message.RECORD_UPDATED });
    } catch (error) {
      handleError(res, 'UpdateStatus', error);
    }
  },

  duplicate: async (req, res) => {
    try {
      const existing = await getOwnedAutomation(req, res, { includeSecrets: true });
      if (!existing) return;
      const record = await AutomationService.duplicateRecord(existing, req.userId);
      const data = await AutomationService.serializeAutomation(record);
      res.send({ data, message: Message.RECORD_CREATED });
    } catch (error) {
      handleError(res, 'Duplicate', error);
    }
  },

  executions: async (req, res) => {
    try {
      const existing = await getOwnedAutomation(req, res);
      if (!existing) return;
      const { page, limit } = AutomationService.parsePagination(req.query, {
        page: 1,
        limit: 10,
        maxLimit: 100,
      });
      const { records, total } = await AutomationService.getExecutions(
        existing._id,
        req.userId,
        page,
        limit,
        req.query.status
      );
      const data = records.map(AutomationService.serializeExecution);
      res.send({
        data,
        message: Message.DATA_FOUND,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      handleError(res, 'Executions', error);
    }
  },
};

module.exports = AutomationController;
