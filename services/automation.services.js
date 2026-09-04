const mongoose = require('mongoose');
const Automation = require('../models/automation.model');
const AutomationExecution = require('../models/automationExecution.model');
const Campaign = require('../models/campaign.model');
const Settings = require('../models/settings.model');
const IntegrationService = require('./integration.services');
const AutomationConfigService = require('./automationConfig.services');
const { CAMPAIGN_STATUS } = require('../constants/campaign.constants');
const {
  AUTOMATION_STATUS,
  AUTOMATION_TRIGGER,
  AUTOMATION_ACTION,
  AUTOMATION_EXECUTION_STATUS,
  AUTOMATION_TRIGGER_MODE,
  AUTOMATION_CONDITION_TYPE,
  AUTOMATION_CONDITION_LOGIC,
  AUTOMATION_CONDITION_OPERATOR,
  AUTOMATION_WEBHOOK_METHOD,
  AUTOMATION_CRM_OPERATION,
  AUTOMATION_CONDITION_FIELDS,
  AUTOMATION_ACTION_DEFINITIONS,
} = require('../constants/automation.constants');

const SENSITIVE_KEY_PATTERN = /authorization|cookie|password|secret|token|api[-_]?key|client[-_]?secret/i;

class AutomationServiceError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AutomationServiceError';
    this.statusCode = statusCode;
  }
}

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parsePagination = (query = {}, defaults = {}) => ({
  page: parsePositiveInteger(query.page, defaults.page || 1),
  limit: Math.min(parsePositiveInteger(query.limit, defaults.limit || 12), defaults.maxLimit || 100),
});

const sanitizeText = (value) =>
  String(value || '')
    .replace(/\b(Bearer|Basic)\s+[^\s,;]+/gi, '$1 [REDACTED]')
    .replace(/([?&](?:access_?token|token|api_?key|password|secret)=)[^&\s]+/gi, '$1[REDACTED]')
    .slice(0, 2000);

const sanitizeMetadata = (value, key = '') => {
  if (SENSITIVE_KEY_PATTERN.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => sanitizeMetadata(item));
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((result, [childKey, childValue]) => {
      result[childKey] = sanitizeMetadata(childValue, childKey);
      return result;
    }, {});
  }
  if (typeof value === 'string') return sanitizeText(value);
  return value;
};

const toPlainObject = (record) => {
  if (!record) return null;
  if (typeof record.toObject === 'function') return record.toObject();
  return { ...record };
};

const serializeAutomation = async (record) => {
  const result = toPlainObject(record);
  if (!result) return null;
  result.actionConfig = await AutomationConfigService.serializeAutomationConfig(
    result.actionConfig || {},
    result.secrets
  );
  delete result.secrets;
  return result;
};

const serializeExecution = (record) => {
  const result = toPlainObject(record);
  if (!result) return null;
  result.errorMessage = sanitizeText(result.errorMessage);
  result.metadata = sanitizeMetadata(result.metadata || {});
  delete result.actionConfigSnapshot;
  delete result.secretsSnapshot;
  return result;
};

const buildListFilter = (userId, query = {}) => {
  const filter = { userId };
  const search = String(query.search || '').trim().slice(0, 100);
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    const matchingActionTypes = AUTOMATION_ACTION_DEFINITIONS
      .filter((definition) => definition.label.toLowerCase().includes(search.toLowerCase()))
      .map((definition) => definition.type);
    filter.$or = [
      { name: regex },
      { description: regex },
      { actionType: regex },
      { status: regex },
    ];
    if (matchingActionTypes.length) filter.$or.push({ actionType: { $in: matchingActionTypes } });
  }
  if (query.status && String(query.status).toLowerCase() !== 'all') {
    if (!Object.values(AUTOMATION_STATUS).includes(query.status)) {
      throw new AutomationServiceError('Automation status filter is invalid');
    }
    filter.status = query.status;
  }
  const actionFilter = query.actionType || query.action;
  if (actionFilter && String(actionFilter).toLowerCase() !== 'all') {
    if (!Object.values(AUTOMATION_ACTION).includes(actionFilter)) {
      throw new AutomationServiceError('Automation action filter is invalid');
    }
    filter.actionType = actionFilter;
  }
  return filter;
};

const AutomationService = {
  parsePagination,
  buildListFilter,
  serializeAutomation,
  serializeExecution,

  createRecord: async (data) => Automation.create(data),

  findByIdAndUserId: async (id, userId, { includeSecrets = false } = {}) => {
    const query = Automation.findOne({ _id: id, userId });
    if (includeSecrets) query.select('+secrets');
    return query;
  },

  getAllRecord: async (filter, page = 1, limit = 12) =>
    Automation.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

  countRecords: async (filter) => Automation.countDocuments(filter),

  updateRecord: async (id, userId, updateData) =>
    Automation.findOneAndUpdate(
      { _id: id, userId },
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('+secrets'),

  updateStatus: async (id, userId, status) =>
    Automation.findOneAndUpdate(
      { _id: id, userId },
      { $set: { status } },
      { new: true, runValidators: true }
    ).select('+secrets'),

  deleteRecord: async (id, userId) => {
    const deleted = await Automation.findOneAndDelete({ _id: id, userId });
    if (deleted) await AutomationExecution.deleteMany({ automationId: id, userId });
    return deleted;
  },

  duplicateRecord: async (record, userId) => {
    const source = toPlainObject(record);
    return Automation.create({
      userId,
      createdBy: userId,
      name: `${String(source.name).slice(0, 115)} Copy`,
      description: source.description || '',
      status: AUTOMATION_STATUS.PAUSED,
      triggerType: source.triggerType,
      conditions: source.conditions,
      actionType: source.actionType,
      actionConfig: source.actionConfig || {},
      secrets: source.secrets || null,
      lastRunAt: null,
      lastExecutionStatus: null,
    });
  },

  validateActionReferences: async (userId, actionType, actionConfig) => {
    const definition = AUTOMATION_ACTION_DEFINITIONS.find((entry) => entry.type === actionType);
    if (definition?.available === false) {
      throw new AutomationServiceError(
        definition.reason || 'This integration is not available in the current project'
      );
    }
    if (actionType !== AUTOMATION_ACTION.SEND_EMAIL_CAMPAIGN) return;
    if (!mongoose.isValidObjectId(actionConfig?.campaignId)) {
      throw new AutomationServiceError('Email campaign is invalid');
    }
    const exists = await Campaign.exists({
      _id: actionConfig.campaignId,
      userId,
      status: CAMPAIGN_STATUS.AUTOMATION,
    });
    if (!exists) {
      throw new AutomationServiceError('Email campaign is not available for automation');
    }
  },

  getExecutions: async (automationId, userId, page = 1, limit = 10, status = null) => {
    const filter = { automationId, userId };
    if (status && String(status).toLowerCase() !== 'all') {
      if (!Object.values(AUTOMATION_EXECUTION_STATUS).includes(status)) {
        throw new AutomationServiceError('Execution status filter is invalid');
      }
      filter.status = status;
    }
    const [records, total] = await Promise.all([
      AutomationExecution.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('leadId', 'firstName lastName email phone source')
        .populate('automationId', 'name'),
      AutomationExecution.countDocuments(filter),
    ]);
    return { records, total };
  },

  getOptions: async (userId) => {
    const [campaigns, smtpConfigured] = await Promise.all([
      Campaign.find({ userId, status: CAMPAIGN_STATUS.AUTOMATION })
        .select('_id name subject type status fromName fromEmail')
        .sort({ createdAt: -1 })
        .lean(),
      IntegrationService.getActiveEmail(userId),
    ]);

    return {
      statuses: Object.values(AUTOMATION_STATUS),
      triggers: [
        {
          type: AUTOMATION_TRIGGER.NEW_LEAD,
          label: 'A new lead is identified',
          description: 'Runs whenever a new lead is identified.',
        },
      ],
      conditions: {
        types: Object.values(AUTOMATION_CONDITION_TYPE),
        logic: Object.values(AUTOMATION_CONDITION_LOGIC),
        fields: AUTOMATION_CONDITION_FIELDS,
        operators: Object.values(AUTOMATION_CONDITION_OPERATOR),
      },
      actions: AUTOMATION_ACTION_DEFINITIONS.map((definition) => ({ ...definition })),
      campaigns,
      smtpConfigured: smtpConfigured?.provider === 'smtp',
      webhook: {
        methods: Object.values(AUTOMATION_WEBHOOK_METHOD),
        triggerModes: Object.values(AUTOMATION_TRIGGER_MODE),
      },
      crm: { operations: Object.values(AUTOMATION_CRM_OPERATION) },
    };
  },
};

module.exports = AutomationService;
module.exports.AutomationServiceError = AutomationServiceError;
