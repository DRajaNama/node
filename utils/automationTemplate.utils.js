const LEAD_VARIABLE_PATTERN = /\{\{\s*lead\.([a-zA-Z0-9_.-]+)\s*\}\}/g;
const EXACT_LEAD_VARIABLE_PATTERN = /^\{\{\s*lead\.([a-zA-Z0-9_.-]+)\s*\}\}$/;
const DANGEROUS_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

const STANDARD_LEAD_FIELDS = Object.freeze([
  'id',
  'firstName',
  'lastName',
  'email',
  'phone',
  'company',
  'jobTitle',
  'country',
  'state',
  'city',
  'source',
  'leadStatus',
  'leadScore',
]);

const toPlainLead = (lead) => {
  if (!lead) return {};
  if (typeof lead.toObject === 'function') return lead.toObject({ getters: false, virtuals: false });
  return lead;
};

const readPath = (value, path) => {
  if (value == null) return undefined;
  const segments = String(path || '').split('.').filter(Boolean);
  if (segments.some((segment) => DANGEROUS_PATH_SEGMENTS.has(segment.toLowerCase()))) return undefined;
  return segments.reduce((current, key) => (
    current == null || !Object.prototype.hasOwnProperty.call(Object(current), key)
      ? undefined
      : current[key]
  ), value);
};

const getLeadValue = (lead, field) => {
  const source = toPlainLead(lead);
  const normalizedField = String(field || '').replace(/^lead\./i, '');
  if (!normalizedField) return undefined;
  const segments = normalizedField.split('.').filter(Boolean);
  if (segments.some((segment) => DANGEROUS_PATH_SEGMENTS.has(segment.toLowerCase()))) return undefined;
  if (normalizedField === 'id') return source.id ?? source._id;

  if (segments[0] === 'fields' || segments[0] === 'customFields') {
    const customContainer = source[segments[0]] || (segments[0] === 'customFields' ? source.fields : source.customFields) || {};
    return readPath(customContainer, segments.slice(1).join('.'));
  }

  if (!STANDARD_LEAD_FIELDS.includes(normalizedField)) return undefined;
  const direct = Object.prototype.hasOwnProperty.call(source, normalizedField)
    ? source[normalizedField]
    : undefined;
  if (direct !== undefined && direct !== null) return direct;

  const custom = readPath(source.fields || source.customFields || {}, normalizedField);
  if (custom !== undefined && custom !== null) return custom;

  return undefined;
};

const stringifyTemplateValue = (value) => {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toHexString === 'function') return value.toHexString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const renderTemplate = (template, lead) => {
  if (typeof template !== 'string') return template;
  return template.replace(LEAD_VARIABLE_PATTERN, (_match, field) => (
    stringifyTemplateValue(getLeadValue(lead, field))
  ));
};

const renderJson = (value, lead) => {
  if (typeof value === 'string') {
    const exact = value.match(EXACT_LEAD_VARIABLE_PATTERN);
    if (exact) {
      const resolved = getLeadValue(lead, exact[1]);
      if (resolved == null) return '';
      if (['string', 'number', 'boolean'].includes(typeof resolved)) return resolved;
      return stringifyTemplateValue(resolved);
    }
    return renderTemplate(value, lead);
  }
  if (Array.isArray(value)) return value.map((entry) => renderJson(entry, lead));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, renderJson(entry, lead)])
    );
  }
  return value;
};

const isEmpty = (value) => {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

const normalizeOperator = (operator) => String(operator || '')
  .trim()
  .toUpperCase()
  .replace(/[\s-]+/g, '_');

const comparableString = (value) => stringifyTemplateValue(value).trim().toLocaleLowerCase();

const compareOrdered = (actual, expected, direction) => {
  const actualNumber = Number(actual);
  const expectedNumber = Number(expected);
  if (Number.isFinite(actualNumber) && Number.isFinite(expectedNumber)) {
    return direction === 'greater' ? actualNumber > expectedNumber : actualNumber < expectedNumber;
  }

  const actualDate = Date.parse(actual);
  const expectedDate = Date.parse(expected);
  if (!Number.isNaN(actualDate) && !Number.isNaN(expectedDate)) {
    return direction === 'greater' ? actualDate > expectedDate : actualDate < expectedDate;
  }

  const comparison = comparableString(actual).localeCompare(comparableString(expected));
  return direction === 'greater' ? comparison > 0 : comparison < 0;
};

const evaluateRule = (rule, lead) => {
  if (!rule || !rule.field || !rule.operator) return false;
  const actual = getLeadValue(lead, rule.field);
  const expected = rule.value;
  const actualString = comparableString(actual);
  const expectedString = comparableString(expected);

  switch (normalizeOperator(rule.operator)) {
    case 'EQUALS':
      return actualString === expectedString;
    case 'NOT_EQUALS':
      return actualString !== expectedString;
    case 'CONTAINS':
      return actualString.includes(expectedString);
    case 'DOES_NOT_CONTAIN':
      return !actualString.includes(expectedString);
    case 'STARTS_WITH':
      return actualString.startsWith(expectedString);
    case 'ENDS_WITH':
      return actualString.endsWith(expectedString);
    case 'GREATER_THAN':
      return compareOrdered(actual, expected, 'greater');
    case 'LESS_THAN':
      return compareOrdered(actual, expected, 'less');
    case 'IS_EMPTY':
      return isEmpty(actual);
    case 'IS_NOT_EMPTY':
      return !isEmpty(actual);
    default:
      return false;
  }
};

const evaluateConditions = (conditions, lead) => {
  if (!conditions || String(conditions.type || 'all').toLowerCase() === 'all') return true;
  const rules = Array.isArray(conditions.rules) ? conditions.rules : [];
  if (!rules.length) return false;
  const evaluations = rules.map((rule) => evaluateRule(rule, lead));
  return String(conditions.logic || 'AND').toUpperCase() === 'OR'
    ? evaluations.some(Boolean)
    : evaluations.every(Boolean);
};

module.exports = {
  STANDARD_LEAD_FIELDS,
  getLeadValue,
  renderTemplate,
  renderJson,
  renderRecursive: renderJson,
  evaluateRule,
  evaluateConditions,
};
