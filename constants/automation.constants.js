const AUTOMATION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
});

const AUTOMATION_TRIGGER = Object.freeze({
  NEW_LEAD: 'NEW_LEAD',
});

const AUTOMATION_ACTION = Object.freeze({
  SEND_EMAIL_CAMPAIGN: 'SEND_EMAIL_CAMPAIGN',
  SEND_TO_SLACK: 'SEND_TO_SLACK',
  SEND_EMAIL_ALERT: 'SEND_EMAIL_ALERT',
  HUBSPOT_CRM: 'HUBSPOT_CRM',
  ZOHO_CRM: 'ZOHO_CRM',
  SALESFORCE: 'SALESFORCE',
  GOHIGHLEVEL_CRM: 'GOHIGHLEVEL_CRM',
  PIPEDRIVE_CRM: 'PIPEDRIVE_CRM',
  TRIGGER_WEBHOOK: 'TRIGGER_WEBHOOK',
});

const AUTOMATION_EXECUTION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
});

const AUTOMATION_TRIGGER_MODE = Object.freeze({
  FIRST_TIME: 'FIRST_TIME',
  EVERY_TIME: 'EVERY_TIME',
});

const AUTOMATION_CONDITION_TYPE = Object.freeze({
  ALL: 'all',
  RULES: 'rules',
});

const AUTOMATION_CONDITION_LOGIC = Object.freeze({
  AND: 'AND',
  OR: 'OR',
});

const AUTOMATION_CONDITION_OPERATOR = Object.freeze({
  EQUALS: 'EQUALS',
  NOT_EQUALS: 'NOT_EQUALS',
  CONTAINS: 'CONTAINS',
  DOES_NOT_CONTAIN: 'DOES_NOT_CONTAIN',
  STARTS_WITH: 'STARTS_WITH',
  ENDS_WITH: 'ENDS_WITH',
  GREATER_THAN: 'GREATER_THAN',
  LESS_THAN: 'LESS_THAN',
  IS_EMPTY: 'IS_EMPTY',
  IS_NOT_EMPTY: 'IS_NOT_EMPTY',
});

const AUTOMATION_WEBHOOK_METHOD = Object.freeze({
  POST: 'POST',
  GET: 'GET',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
});

const AUTOMATION_CRM_OPERATION = Object.freeze({
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
});

const AUTOMATION_CONDITION_FIELDS = Object.freeze([
  { value: 'firstName', label: 'First Name', type: 'text' },
  { value: 'lastName', label: 'Last Name', type: 'text' },
  { value: 'email', label: 'Email', type: 'text' },
  { value: 'phone', label: 'Phone', type: 'text' },
  { value: 'company', label: 'Company', type: 'text' },
  { value: 'jobTitle', label: 'Job Title', type: 'text' },
  { value: 'country', label: 'Country', type: 'text' },
  { value: 'state', label: 'State', type: 'text' },
  { value: 'city', label: 'City', type: 'text' },
  { value: 'source', label: 'Source', type: 'text' },
  { value: 'leadStatus', label: 'Lead Status', type: 'text' },
  { value: 'leadScore', label: 'Lead Score', type: 'number' },
]);

const AUTOMATION_ACTION_DEFINITIONS = Object.freeze([
  { type: AUTOMATION_ACTION.SEND_EMAIL_CAMPAIGN, label: 'Send Email Campaign', category: 'OUTREACH', available: true },
  { type: AUTOMATION_ACTION.SEND_TO_SLACK, label: 'Send to Slack', category: 'ALERTS', available: false, reason: 'Slack integration is not available in this project.' },
  { type: AUTOMATION_ACTION.SEND_EMAIL_ALERT, label: 'Send Email Alert', category: 'ALERTS', available: true },
  { type: AUTOMATION_ACTION.HUBSPOT_CRM, label: 'HubSpot CRM', category: 'CRM', available: false, reason: 'HubSpot integration is not available in this project.' },
  { type: AUTOMATION_ACTION.ZOHO_CRM, label: 'Zoho CRM', category: 'CRM', available: false, reason: 'Zoho CRM integration is not available in this project.' },
  { type: AUTOMATION_ACTION.SALESFORCE, label: 'Salesforce', category: 'CRM', available: false, reason: 'Salesforce integration is not available in this project.' },
  { type: AUTOMATION_ACTION.GOHIGHLEVEL_CRM, label: 'GoHighLevel', category: 'CRM', available: false, reason: 'GoHighLevel integration is not available in this project.' },
  { type: AUTOMATION_ACTION.PIPEDRIVE_CRM, label: 'Pipedrive', category: 'CRM', available: false, reason: 'Pipedrive integration is not available in this project.' },
  { type: AUTOMATION_ACTION.TRIGGER_WEBHOOK, label: 'Trigger Webhook', category: 'EVENTS', available: true },
]);

module.exports = {
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
};
