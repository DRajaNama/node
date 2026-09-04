const mongoose = require('mongoose');
const {
  findSensitiveObjectKey,
  findSensitiveUrlParameter,
} = require('../utils/automationSecrets.utils');
const { FORBIDDEN_WEBHOOK_HEADER_NAMES } = require('../services/automationConfig.services');
const {
  AUTOMATION_STATUS,
  AUTOMATION_TRIGGER,
  AUTOMATION_ACTION,
  AUTOMATION_TRIGGER_MODE,
  AUTOMATION_CONDITION_TYPE,
  AUTOMATION_CONDITION_LOGIC,
  AUTOMATION_CONDITION_OPERATOR,
  AUTOMATION_WEBHOOK_METHOD,
  AUTOMATION_CRM_OPERATION,
  AUTOMATION_CONDITION_FIELDS,
} = require('../constants/automation.constants');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const EMPTY_VALUE_OPERATORS = new Set([
  AUTOMATION_CONDITION_OPERATOR.IS_EMPTY,
  AUTOMATION_CONDITION_OPERATOR.IS_NOT_EMPTY,
]);
const CRM_ACTIONS = new Set([
  AUTOMATION_ACTION.HUBSPOT_CRM,
  AUTOMATION_ACTION.ZOHO_CRM,
  AUTOMATION_ACTION.SALESFORCE,
  AUTOMATION_ACTION.GOHIGHLEVEL_CRM,
  AUTOMATION_ACTION.PIPEDRIVE_CRM,
]);
const KNOWN_CONDITION_FIELDS = new Set(AUTOMATION_CONDITION_FIELDS.map((field) => field.value));

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isMissing = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const isValidConditionField = (field) => {
  if (typeof field !== 'string' || !field.trim()) return false;
  if (KNOWN_CONDITION_FIELDS.has(field)) return true;
  return /^(fields|customFields)\.[a-zA-Z0-9_-]+$/.test(field);
};

const validateConditions = (conditions, errors, required) => {
  if (conditions === undefined && !required) return;
  if (!isPlainObject(conditions)) {
    errors.conditions = 'Conditions must be an object';
    return;
  }

  if (!Object.values(AUTOMATION_CONDITION_TYPE).includes(conditions.type)) {
    errors['conditions.type'] = 'Condition type must be all or rules';
  }
  if (!Object.values(AUTOMATION_CONDITION_LOGIC).includes(conditions.logic || AUTOMATION_CONDITION_LOGIC.AND)) {
    errors['conditions.logic'] = 'Condition logic must be AND or OR';
  }
  if (!Array.isArray(conditions.rules)) {
    errors['conditions.rules'] = 'Condition rules must be an array';
    return;
  }
  if (conditions.type === AUTOMATION_CONDITION_TYPE.ALL && conditions.rules.length > 0) {
    errors['conditions.rules'] = 'All Leads conditions cannot contain rules';
  }
  if (conditions.type === AUTOMATION_CONDITION_TYPE.RULES && conditions.rules.length === 0) {
    errors['conditions.rules'] = 'At least one condition rule is required';
  }

  conditions.rules.forEach((rule, index) => {
    if (!isPlainObject(rule)) {
      errors[`conditions.rules.${index}`] = 'Condition rule must be an object';
      return;
    }
    if (!isValidConditionField(rule.field)) {
      errors[`conditions.rules.${index}.field`] = 'Condition field is invalid';
    }
    if (!Object.values(AUTOMATION_CONDITION_OPERATOR).includes(rule.operator)) {
      errors[`conditions.rules.${index}.operator`] = 'Condition operator is invalid';
    } else if (!EMPTY_VALUE_OPERATORS.has(rule.operator) && isMissing(rule.value)) {
      errors[`conditions.rules.${index}.value`] = 'Condition value is required';
    }
  });
};

const validateEmailCampaign = (config, errors) => {
  if (isMissing(config.campaignId)) {
    errors['actionConfig.campaignId'] = 'Email campaign is required';
  } else if (!mongoose.isValidObjectId(config.campaignId)) {
    errors['actionConfig.campaignId'] = 'Email campaign is invalid';
  }
  if (
    config.delayMinutes !== undefined &&
    (!Number.isFinite(Number(config.delayMinutes)) ||
      Number(config.delayMinutes) < 0 ||
      Number(config.delayMinutes) > 43200)
  ) {
    errors['actionConfig.delayMinutes'] = 'Delay must be between 0 and 43200 minutes';
  }
};

const validateSlack = (config, errors) => {
  if (isMissing(config.integrationId)) errors['actionConfig.integrationId'] = 'Slack integration is required';
  if (isMissing(config.channel)) errors['actionConfig.channel'] = 'Slack channel is required';
  if (isMissing(config.message)) errors['actionConfig.message'] = 'Slack message is required';
};

const validateEmailAlert = (config, errors) => {
  if (!Array.isArray(config.recipients) || config.recipients.length === 0) {
    errors['actionConfig.recipients'] = 'At least one recipient email is required';
  } else {
    const invalid = config.recipients.some(
      (email) => typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())
    );
    if (invalid) errors['actionConfig.recipients'] = 'Every recipient email must be valid';
  }
  if (
    !isMissing(config.fromEmail)
    && (typeof config.fromEmail !== 'string' || !EMAIL_PATTERN.test(config.fromEmail.trim()))
  ) {
    errors['actionConfig.fromEmail'] = 'From email must be valid';
  }
  if (isMissing(config.subject)) errors['actionConfig.subject'] = 'Email subject is required';
  if (isMissing(config.message)) errors['actionConfig.message'] = 'Email message is required';
};

const validateMailchimp = (config, errors) => {
  if (isMissing(config.audienceId) || !/^[a-f0-9]{8,64}$/i.test(String(config.audienceId))) {
    errors['actionConfig.audienceId'] = 'A valid Mailchimp audience is required';
  }
  if (config.statusIfNew !== undefined && !['subscribed', 'pending'].includes(config.statusIfNew)) {
    errors['actionConfig.statusIfNew'] = 'Mailchimp subscription status is invalid';
  }
};

const validateCrm = (config, errors) => {
  if (isMissing(config.integrationId)) errors['actionConfig.integrationId'] = 'CRM integration is required';
  if (!Object.values(AUTOMATION_CRM_OPERATION).includes(config.operation)) {
    errors['actionConfig.operation'] = 'CRM operation must be CREATE or UPDATE';
  }
  if (!isPlainObject(config.fieldMapping) || Object.keys(config.fieldMapping).length === 0) {
    errors['actionConfig.fieldMapping'] = 'CRM field mapping is required';
  } else {
    const invalidMapping = Object.entries(config.fieldMapping).some(
      ([source, destination]) => isMissing(source) || isMissing(destination) || typeof destination !== 'string'
    );
    if (invalidMapping) errors['actionConfig.fieldMapping'] = 'CRM field mappings must use non-empty field names';
  }
};

const validateWebhookUrl = (value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
};

const validateWebhook = (config, errors) => {
  if (isMissing(config.url) || !validateWebhookUrl(config.url)) {
    errors['actionConfig.url'] = 'A valid HTTP or HTTPS webhook URL is required';
  } else if (findSensitiveUrlParameter(config.url)) {
    errors['actionConfig.url'] = 'Webhook credentials must use sensitive headers, not URL query parameters';
  }
  if (!Object.values(AUTOMATION_WEBHOOK_METHOD).includes(config.method)) {
    errors['actionConfig.method'] = 'Webhook method is invalid';
  }
  if (!Object.values(AUTOMATION_TRIGGER_MODE).includes(config.triggerMode)) {
    errors['actionConfig.triggerMode'] = 'Webhook trigger mode is invalid';
  }
  if (!Array.isArray(config.headers)) {
    errors['actionConfig.headers'] = 'Webhook headers must be an array';
  } else {
    const seen = new Set();
    config.headers.forEach((header, index) => {
      if (!isPlainObject(header) || isMissing(header.key)) {
        errors[`actionConfig.headers.${index}.key`] = 'Header name is required';
        return;
      }
      const normalizedKey = header.key.trim().toLowerCase();
      if (header.key.trim().length > 256 || !HEADER_NAME_PATTERN.test(header.key.trim())) {
        errors[`actionConfig.headers.${index}.key`] = 'Header name is invalid';
      } else if (FORBIDDEN_WEBHOOK_HEADER_NAMES.has(normalizedKey)) {
        errors[`actionConfig.headers.${index}.key`] = 'This webhook header is not allowed';
      }
      if (seen.has(normalizedKey)) {
        errors[`actionConfig.headers.${index}.key`] = 'Header names must be unique';
      }
      seen.add(normalizedKey);
      if (typeof header.value !== 'string') {
        errors[`actionConfig.headers.${index}.value`] = 'Header value must be a string';
      } else if (/\r|\n/.test(header.value)) {
        errors[`actionConfig.headers.${index}.value`] = 'Header value is invalid';
      } else if (Buffer.byteLength(header.value, 'utf8') > 8192) {
        errors[`actionConfig.headers.${index}.value`] = 'Header value is too large';
      }
    });
  }
  if (!isPlainObject(config.body)) {
    errors['actionConfig.body'] = 'Webhook request body must be a JSON object';
  } else if (findSensitiveObjectKey(config.body)) {
    errors['actionConfig.body'] = 'Webhook credentials must use sensitive headers, not JSON body fields';
  }
};

const validateActionConfig = (actionType, config, errors, required) => {
  if (config === undefined && !required) return;
  if (!isPlainObject(config)) {
    errors.actionConfig = 'Action configuration must be an object';
    return;
  }
  if (actionType === AUTOMATION_ACTION.SEND_EMAIL_CAMPAIGN) validateEmailCampaign(config, errors);
  if (actionType === AUTOMATION_ACTION.SEND_TO_SLACK) validateSlack(config, errors);
  if (actionType === AUTOMATION_ACTION.SEND_EMAIL_ALERT) validateEmailAlert(config, errors);
  if (actionType === AUTOMATION_ACTION.MAILCHIMP_ADD_LEAD) validateMailchimp(config, errors);
  if (CRM_ACTIONS.has(actionType)) validateCrm(config, errors);
  if (actionType === AUTOMATION_ACTION.TRIGGER_WEBHOOK) validateWebhook(config, errors);
};

const validateAutomation = (data, { partial = false } = {}) => {
  const errors = {};

  if (!partial || data.name !== undefined) {
    if (isMissing(data.name)) errors.name = 'Automation name is required';
    else if (typeof data.name !== 'string') errors.name = 'Automation name must be text';
    else if (data.name.trim().length > 120) errors.name = 'Automation name cannot exceed 120 characters';
  }
  if (data.description !== undefined && typeof data.description !== 'string') {
    errors.description = 'Description must be text';
  } else if (typeof data.description === 'string' && data.description.length > 1000) {
    errors.description = 'Description cannot exceed 1000 characters';
  }
  if ((!partial || data.status !== undefined) && !Object.values(AUTOMATION_STATUS).includes(data.status)) {
    errors.status = 'Automation status must be ACTIVE or PAUSED';
  }
  if ((!partial || data.triggerType !== undefined) && !Object.values(AUTOMATION_TRIGGER).includes(data.triggerType)) {
    errors.triggerType = 'Automation trigger is invalid';
  }
  if ((!partial || data.actionType !== undefined) && !Object.values(AUTOMATION_ACTION).includes(data.actionType)) {
    errors.actionType = 'Automation action is invalid';
  }

  validateConditions(data.conditions, errors, !partial);
  validateActionConfig(data.actionType, data.actionConfig, errors, !partial);

  return { errors, isValid: Object.keys(errors).length === 0 };
};

const automationCreateValidation = (data) => validateAutomation(data);
const automationUpdateValidation = (data) => validateAutomation(data, { partial: true });

const automationStatusValidation = (data) => {
  const errors = {};
  if (!data || !Object.values(AUTOMATION_STATUS).includes(data.status)) {
    errors.status = 'Automation status must be ACTIVE or PAUSED';
  }
  return { errors, isValid: Object.keys(errors).length === 0 };
};

module.exports = {
  automationCreateValidation,
  automationUpdateValidation,
  automationStatusValidation,
  validateAutomation,
  validateActionConfig,
};
