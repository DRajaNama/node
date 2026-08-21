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
    const config = { ...current.config };
    // Blank secret fields mean "keep the existing value". This avoids exposing
    // credentials while still allowing an administrator to update other settings.
    ['apiKey', 'clientId', 'clientSecret'].forEach((key) => {
      if (typeof input[key] === 'string' && input[key].trim()) config[key] = input[key].trim();
    });
    if (provider === 'paypal' && ['sandbox', 'live'].includes(input.environment)) config.environment = input.environment;
    integrations[provider] = {
      key: keyFor(provider), type: 'integration', provider,
      enabled: input.enabled !== undefined ? !!input.enabled : current.enabled !== false,
      config,
      metadata: provider === 'paypal'
        ? { name: 'PayPal', description: 'Subscription billing provider', category: 'payments' }
        : { name: 'Pixabay', description: 'Stock image provider', category: 'stock-images' },
      updatedBy,
    };
    settings.integrations = integrations;
    await settings.save();
    return integrations[provider];
  },
  async publicIntegration(provider) {
    const integration = await this.getIntegration(provider);
    if (provider === 'paypal') {
      const config = integration?.config || {};
      const clientId = config.clientId || process.env.PAYPAL_CLIENT_ID || '';
      const clientSecret = config.clientSecret || process.env.PAYPAL_CLIENT_SECRET || '';
      return { provider, enabled: integration ? integration.enabled !== false : true, environment: config.environment || process.env.PAYPAL_ENV || 'sandbox', hasClientId: !!clientId, hasClientSecret: !!clientSecret, maskedClientId: maskKey(clientId) };
    }
    const key = integration?.config?.apiKey || '';
    return { provider, enabled: integration ? integration.enabled !== false : true, hasApiKey: !!(key || process.env.PIXABAY_API_KEY || process.env.PIXABAY_API), maskedApiKey: maskKey(key) };
  },
};
module.exports = IntegrationSettingsService;
