const SystemSettings = require('../models/systemSettings.model');

const keyFor = (provider) => `integration.${provider}`;
const maskKey = (key) => key ? `${'*'.repeat(Math.max(0, key.length - 4))}${key.slice(-4)}` : '';

const IntegrationSettingsService = {
  async getIntegration(provider) {
    const settings = await SystemSettings.findOne({ key: 'global' }).select('+integrations');
    return settings?.integrations?.[provider] || null;
  },
  async saveIntegration(provider, input, updatedBy) {
    const settings = await SystemSettings.findOneAndUpdate({ key: 'global' }, { $setOnInsert: { key: 'global' } }, { upsert: true, new: true });
    const integrations = settings.integrations || {};
    const current = integrations[provider] || {};
    const apiKey = input.apiKey || current.config?.apiKey || '';
    integrations[provider] = {
      key: keyFor(provider), type: 'integration', provider,
      enabled: input.enabled !== undefined ? !!input.enabled : current.enabled !== false,
      config: { ...current.config, ...(apiKey ? { apiKey } : {}) },
      metadata: { name: provider === 'pixabay' ? 'Pixabay' : provider, description: 'Stock image provider', category: 'stock-images' },
      updatedBy,
    };
    settings.integrations = integrations;
    await settings.save();
    return integrations[provider];
  },
  async publicIntegration(provider) {
    const integration = await this.getIntegration(provider);
    const key = integration?.config?.apiKey || '';
    return { provider, enabled: integration ? integration.enabled !== false : true, hasApiKey: !!(key || process.env.PIXABAY_API_KEY || process.env.PIXABAY_API), maskedApiKey: maskKey(key) };
  },
};
module.exports = IntegrationSettingsService;
