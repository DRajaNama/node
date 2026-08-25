const {
  AutomationSecretError,
  encryptSecrets,
  decryptSecrets,
  isSensitiveCredentialKey,
  findSensitiveObjectKey,
  findSensitiveUrlParameter,
} = require('../utils/automationSecrets.utils');

const WEBHOOK_ACTION = 'TRIGGER_WEBHOOK';
const MASKED_SECRET = '********';
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const FORBIDDEN_WEBHOOK_HEADER_NAMES = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  '__proto__',
  'prototype',
  'constructor',
]);
const SENSITIVE_HEADER_PATTERN = /(authorization|cookie|credential|api[-_]?key|token|secret|signature|password)/i;
const SENSITIVE_PROPERTY_PATTERN = /(password|secret|accessToken|refreshToken|apiKey|authorization)/i;

const clone = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
};

const normalizeHeaders = (headers) => {
  if (!headers) return [];
  if (Array.isArray(headers)) return headers;
  if (typeof headers === 'object') {
    return Object.entries(headers).map(([key, value]) => ({ key, value }));
  }
  throw new AutomationSecretError('Webhook headers must be a list.', 'INVALID_WEBHOOK_HEADERS');
};

const validateHeader = (key, value) => {
  if (key.length > 256 || !HEADER_NAME_PATTERN.test(key)) {
    throw new AutomationSecretError('A webhook header name is invalid.', 'INVALID_WEBHOOK_HEADER');
  }
  if (FORBIDDEN_WEBHOOK_HEADER_NAMES.has(key.toLowerCase())) {
    throw new AutomationSecretError('This webhook header is not allowed.', 'FORBIDDEN_WEBHOOK_HEADER');
  }
  if (/[\r\n]/.test(String(value ?? ''))) {
    throw new AutomationSecretError('A webhook header value is invalid.', 'INVALID_WEBHOOK_HEADER');
  }
  if (Buffer.byteLength(String(value ?? ''), 'utf8') > 8192) {
    throw new AutomationSecretError('A webhook header value is too large.', 'INVALID_WEBHOOK_HEADER');
  }
};

const headerIsSensitive = (entry, key) => (
  entry?.sensitive === true
  || entry?.isSecret === true
  || entry?.secret === true
  || SENSITIVE_HEADER_PATTERN.test(key)
  || isSensitiveCredentialKey(key)
);

const assertSecureWebhookConfig = (config = {}) => {
  const queryParameter = findSensitiveUrlParameter(config.url);
  if (queryParameter) {
    throw new AutomationSecretError(
      'Webhook credentials must use sensitive headers, not URL query parameters.',
      'WEBHOOK_SECRET_IN_URL'
    );
  }
  const bodyPath = findSensitiveObjectKey(config.body);
  if (bodyPath) {
    throw new AutomationSecretError(
      'Webhook credentials must use sensitive headers, not JSON body fields.',
      'WEBHOOK_SECRET_IN_BODY'
    );
  }
  const seenHeaders = new Set();
  for (const rawEntry of normalizeHeaders(config.headers)) {
    const key = String(rawEntry?.key ?? rawEntry?.name ?? '').trim();
    if (!key) continue;
    const normalizedKey = key.toLowerCase();
    if (seenHeaders.has(normalizedKey)) {
      throw new AutomationSecretError('Webhook header names must be unique.', 'DUPLICATE_WEBHOOK_HEADER');
    }
    seenHeaders.add(normalizedKey);
    validateHeader(key, rawEntry?.value);
  }
};

const publicHeader = (key, value, sensitive, hasValue = undefined) => {
  if (sensitive) {
    return {
      key,
      value: MASKED_SECRET,
      sensitive: true,
      hasValue: hasValue !== undefined ? !!hasValue : !!value,
    };
  }
  return { key, value: String(value ?? ''), sensitive: false };
};

const sanitizeUnknownConfig = (value, key = '') => {
  if (Array.isArray(value)) return value.map((entry) => sanitizeUnknownConfig(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      SENSITIVE_PROPERTY_PATTERN.test(entryKey)
        ? MASKED_SECRET
        : sanitizeUnknownConfig(entryValue, entryKey),
    ]));
  }
  return SENSITIVE_PROPERTY_PATTERN.test(key) && value ? MASKED_SECRET : value;
};

const prepareWebhookConfig = (inputConfig, existingCiphertext) => {
  assertSecureWebhookConfig(inputConfig);
  const actionConfig = clone(inputConfig) || {};
  const existing = decryptSecrets(existingCiphertext);
  const existingHeaders = existing.webhookHeaders || {};
  const nextHeaders = Object.create(null);
  const publicHeaders = [];

  for (const rawEntry of normalizeHeaders(actionConfig.headers)) {
    const key = String(rawEntry?.key ?? rawEntry?.name ?? '').trim();
    if (!key) continue;
    const normalizedKey = key.toLowerCase();
    const value = rawEntry?.value == null ? '' : String(rawEntry.value);
    const sensitive = headerIsSensitive(rawEntry, key);
    validateHeader(key, value);

    if (!sensitive) {
      publicHeaders.push(publicHeader(key, value, false));
      continue;
    }

    const preserve = (value === '' || value === MASKED_SECRET) && rawEntry?.hasValue !== false;
    const existingValue = existingHeaders[normalizedKey];
    if (preserve && existingValue?.value) {
      nextHeaders[normalizedKey] = { key, value: existingValue.value };
      publicHeaders.push(publicHeader(key, '', true, true));
      continue;
    }

    if (value && value !== MASKED_SECRET) {
      nextHeaders[normalizedKey] = { key, value };
      publicHeaders.push(publicHeader(key, '', true, true));
      continue;
    }

    publicHeaders.push(publicHeader(key, '', true, false));
  }

  actionConfig.headers = publicHeaders;
  const secrets = Object.keys(nextHeaders).length ? { webhookHeaders: nextHeaders } : {};
  return { actionConfig, secrets: encryptSecrets(secrets) };
};

const prepareAutomationWrite = (
  { actionType, actionConfig } = {},
  { existingSecrets, existingAutomation } = {}
) => {
  const previousCiphertext = existingSecrets ?? existingAutomation?.secrets ?? null;

  if (actionConfig === undefined) {
    return {
      actionConfig: undefined,
      secrets: actionType && actionType !== WEBHOOK_ACTION && previousCiphertext ? null : undefined,
    };
  }

  if (actionType !== WEBHOOK_ACTION) {
    return { actionConfig: sanitizeUnknownConfig(clone(actionConfig) || {}), secrets: null };
  }

  return prepareWebhookConfig(actionConfig, previousCiphertext);
};

const serializeAutomationConfig = (actionConfig) => {
  const config = clone(actionConfig) || {};
  if (typeof config.url === 'string') {
    try {
      const url = new URL(config.url);
      for (const key of [...url.searchParams.keys()]) {
        if (isSensitiveCredentialKey(key)) url.searchParams.set(key, MASKED_SECRET);
      }
      config.url = url.toString();
    } catch {
      // Validation owns malformed URLs; serialization still redacts other fields.
    }
  }
  if (Array.isArray(config.headers)) {
    config.headers = config.headers.map((entry) => {
      const key = String(entry?.key ?? entry?.name ?? '').trim();
      const sensitive = headerIsSensitive(entry, key);
      return publicHeader(key, sensitive ? '' : entry?.value, sensitive, sensitive ? entry?.hasValue !== false : undefined);
    }).filter((entry) => entry.key);
  }
  return sanitizeUnknownConfig(config);
};

const decryptAutomationSecrets = (automationOrCiphertext) => {
  const ciphertext = typeof automationOrCiphertext === 'string'
    ? automationOrCiphertext
    : automationOrCiphertext?.secrets;
  return decryptSecrets(ciphertext);
};

const resolveWebhookHeaders = (actionConfig, automationOrCiphertext) => {
  const secrets = decryptAutomationSecrets(automationOrCiphertext);
  const secretHeaders = secrets.webhookHeaders || {};
  const resolved = Object.create(null);

  for (const entry of normalizeHeaders(actionConfig?.headers)) {
    const key = String(entry?.key ?? entry?.name ?? '').trim();
    if (!key) continue;
    const normalizedKey = key.toLowerCase();
    const sensitive = headerIsSensitive(entry, key);
    if (sensitive) {
      const secretEntry = secretHeaders[normalizedKey];
      if (secretEntry?.value) resolved[key] = secretEntry.value;
    } else if (entry?.value != null && entry.value !== '') {
      resolved[key] = String(entry.value);
    }
  }

  return Object.fromEntries(Object.entries(resolved));
};

const prepareActionConfig = (actionType, inputConfig, existingAutomation) => (
  prepareAutomationWrite(
    { actionType, actionConfig: inputConfig },
    { existingSecrets: existingAutomation?.secrets, existingAutomation }
  )
);

const publicActionConfig = (automation) => serializeAutomationConfig(automation?.actionConfig || automation);

module.exports = {
  MASKED_SECRET,
  prepareAutomationWrite,
  prepareActionConfig,
  serializeAutomationConfig,
  publicActionConfig,
  decryptAutomationSecrets,
  resolveWebhookHeaders,
  assertSecureWebhookConfig,
  FORBIDDEN_WEBHOOK_HEADER_NAMES,
};
