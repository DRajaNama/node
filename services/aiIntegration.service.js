const OpenAI = require('openai');
const AIIntegration = require('../models/aiIntegration.model');
const { encryptSecrets, decryptSecrets } = require('../utils/automationSecrets.utils');

const NO_KEY_MESSAGE = 'Please connect your ChatGPT/OpenAI API key before using AI features. Go to Integrations → ChatGPT/OpenAI.';

const safeOpenAIError = (error) => {
  const status = Number(error?.status || error?.statusCode);
  const safeError = new Error(status === 401 || status === 403
    ? 'OpenAI rejected this API key. Check the key and try again.'
    : status === 429
      ? 'OpenAI rate limit reached. Please check your OpenAI usage and try again shortly.'
      : 'Unable to connect to OpenAI right now. Please try again later.');
  // OpenAI credential failures are upstream provider errors, not failures of
  // the user's LeadPro session. Returning 401 would trigger the app logout flow.
  safeError.status = status === 401 || status === 403 ? 422 : status === 429 ? 429 : 503;
  return safeError;
};

const checkKey = async (apiKey) => {
  const key = String(apiKey || '').trim();
  if (!key || key.length > 512 || /\s/.test(key)) throw new Error('Enter a valid OpenAI API key.');
  try {
    const client = new OpenAI({ apiKey: key, timeout: 15000, maxRetries: 0 });
    await client.models.list();
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) throw safeOpenAIError(error);
    if (error?.status === 429) throw safeOpenAIError(error);
    throw safeOpenAIError(error);
  }
};

const AIIntegrationService = {
  NO_KEY_MESSAGE,
  async getStatus(userId) {
    const record = await AIIntegration.findOne({ userId });
    return { connected: !!record, lastVerifiedAt: record?.lastVerifiedAt || null, maskedKey: record ? '••••••••••••••••' : null };
  },
  async verify(apiKey) {
    await checkKey(apiKey);
    return { verified: true };
  },
  async testForUser(userId, apiKey) {
    const suppliedKey = String(apiKey || '').trim();
    const key = suppliedKey || await this.getApiKey(userId);
    await checkKey(key);
    const record = suppliedKey ? await AIIntegration.findOne({ userId }) : await AIIntegration.findOneAndUpdate({ userId }, { $set: { lastVerifiedAt: new Date() } }, { new: true });
    return { verified: true, lastVerifiedAt: record?.lastVerifiedAt || new Date() };
  },
  async save(userId, apiKey) {
    await checkKey(apiKey);
    const encrypted = encryptSecrets({ apiKey: String(apiKey).trim() });
    const record = await AIIntegration.findOneAndUpdate(
      { userId },
      { $set: { apiKeyEncrypted: encrypted, lastVerifiedAt: new Date() } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return { connected: true, lastVerifiedAt: record.lastVerifiedAt, maskedKey: '••••••••••••••••' };
  },
  async disconnect(userId) {
    await AIIntegration.deleteOne({ userId });
    return { connected: false, lastVerifiedAt: null, maskedKey: null };
  },
  async getApiKey(userId) {
    const record = await AIIntegration.findOne({ userId }).select('+apiKeyEncrypted');
    if (!record) throw new Error(NO_KEY_MESSAGE);
    const apiKey = decryptSecrets(record.apiKeyEncrypted)?.apiKey;
    if (!apiKey) throw new Error(NO_KEY_MESSAGE);
    return apiKey;
  },
};

module.exports = AIIntegrationService;
