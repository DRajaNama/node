const crypto = require('crypto');

const ENCRYPTION_VERSION = 'v1';
const DEVELOPMENT_FALLBACK_KEY = 'automation-development-fallback-key-do-not-use-in-production';
let insecureDevelopmentKeyWarningEmitted = false;
const SENSITIVE_CREDENTIAL_KEY_PATTERN = /(authorization|credential|password|passwd|secret|token|apikey|clientsecret|cookie|signature)(header|value)?$/i;
const SENSITIVE_CREDENTIAL_EXACT_KEYS = new Set(['auth', 'key', 'sig']);

class AutomationSecretError extends Error {
  constructor(message, code = 'AUTOMATION_SECRET_ERROR') {
    super(message);
    this.name = 'AutomationSecretError';
    this.code = code;
    this.safeMessage = message;
    this.retryable = false;
  }
}

const decodeConfiguredKey = (configured) => {
  const input = String(configured || '').trim();
  if (/^[a-f0-9]{64}$/i.test(input)) return Buffer.from(input, 'hex');

  try {
    const decoded = Buffer.from(input, 'base64');
    if (decoded.length === 32 && decoded.toString('base64').replace(/=+$/, '') === input.replace(/=+$/, '')) {
      return decoded;
    }
  } catch {
    // Fall through to the passphrase derivation below.
  }

  return crypto.createHash('sha256').update(input, 'utf8').digest();
};

const getEncryptionKey = () => {
  const configured = String(process.env.AUTOMATION_ENCRYPTION_KEY || '').trim();
  if (configured) return decodeConfiguredKey(configured);

  if (process.env.NODE_ENV === 'test') {
    return decodeConfiguredKey(DEVELOPMENT_FALLBACK_KEY);
  }

  const insecureDevelopmentFallbackAllowed =
    process.env.NODE_ENV !== 'production'
    && String(process.env.AUTOMATION_ALLOW_INSECURE_DEV_KEY || '').toLowerCase() === 'true';
  if (insecureDevelopmentFallbackAllowed) {
    if (!insecureDevelopmentKeyWarningEmitted) {
      insecureDevelopmentKeyWarningEmitted = true;
      console.warn(
        'WARNING: automation secrets are using an insecure development encryption key. '
        + 'Set AUTOMATION_ENCRYPTION_KEY before storing production data.'
      );
    }
    return decodeConfiguredKey(DEVELOPMENT_FALLBACK_KEY);
  }

  throw new AutomationSecretError(
    'Automation encryption is not configured. Set AUTOMATION_ENCRYPTION_KEY.',
    'AUTOMATION_ENCRYPTION_KEY_REQUIRED'
  );
};

const encryptSecrets = (value) => {
  if (value == null) return null;
  const serialized = JSON.stringify(value);
  if (serialized === '{}' || serialized === '[]') return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
};

const decryptSecrets = (payload) => {
  if (!payload) return {};
  if (typeof payload !== 'string') {
    throw new AutomationSecretError('Stored automation credentials are invalid.');
  }

  try {
    const [version, ivValue, tagValue, ciphertextValue, extra] = payload.split('.');
    if (version !== ENCRYPTION_VERSION || !ivValue || !tagValue || !ciphertextValue || extra) {
      throw new Error('Invalid encrypted payload');
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      Buffer.from(ivValue, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    const parsed = JSON.parse(plaintext);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error instanceof AutomationSecretError) throw error;
    throw new AutomationSecretError(
      'Stored automation credentials could not be decrypted.',
      'AUTOMATION_SECRET_DECRYPT_FAILED'
    );
  }
};

const isSensitiveCredentialKey = (key) => {
  const normalized = String(key || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return !!normalized && (
    SENSITIVE_CREDENTIAL_KEY_PATTERN.test(normalized)
    || SENSITIVE_CREDENTIAL_EXACT_KEYS.has(normalized)
  );
};

const findSensitiveObjectKey = (value, path = 'body') => {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findSensitiveObjectKey(value[index], `${path}.${index}`);
      if (found) return found;
    }
    return null;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (isSensitiveCredentialKey(key)) return `${path}.${key}`;
    const found = findSensitiveObjectKey(entry, `${path}.${key}`);
    if (found) return found;
  }
  return null;
};

const findSensitiveUrlParameter = (value) => {
  try {
    const url = new URL(value);
    return [...url.searchParams.keys()].find(isSensitiveCredentialKey) || null;
  } catch {
    return null;
  }
};

module.exports = {
  AutomationSecretError,
  encryptSecrets,
  decryptSecrets,
  isSensitiveCredentialKey,
  findSensitiveObjectKey,
  findSensitiveUrlParameter,
};
