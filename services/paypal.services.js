const IntegrationSettings = require('./integrationSettings.services');
const baseUrl = (env) => env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const safeError = () => Object.assign(new Error('Unable to connect to PayPal. Please check your configuration.'), { status: 503 });
const PayPalService = {
  async config() {
    const stored = await IntegrationSettings.getIntegration('paypal');
    if (stored?.enabled === false) throw safeError();
    const config = stored?.config || {};
    const clientId = config.clientId || process.env.PAYPAL_CLIENT_ID;
    const clientSecret = config.clientSecret || process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw safeError();
    return { env: config.environment || process.env.PAYPAL_ENV || 'sandbox', clientId, clientSecret };
  },
  async getAccessToken() {
    const config = await this.config();
    const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const response = await fetch(`${baseUrl(config.env)}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
    if (!response.ok) throw safeError();
    return { token: (await response.json()).access_token, config };
  },
  async getSubscription(id) { const { token, config } = await this.getAccessToken(); const r = await fetch(`${baseUrl(config.env)}/v1/billing/subscriptions/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } }); if (!r.ok) throw safeError(); return r.json(); },
  async cancelSubscription(id) { const { token, config } = await this.getAccessToken(); const r = await fetch(`${baseUrl(config.env)}/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Cancelled by customer' }) }); if (!r.ok && r.status !== 204) throw safeError(); },
  async verifyWebhook(headers, event) { const { token, config } = await this.getAccessToken(); const webhookId = process.env.PAYPAL_WEBHOOK_ID; if (!webhookId) return false; const r = await fetch(`${baseUrl(config.env)}/v1/notifications/verify-webhook-signature`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_algo: headers['paypal-auth-algo'], cert_url: headers['paypal-cert-url'], transmission_id: headers['paypal-transmission-id'], transmission_sig: headers['paypal-transmission-sig'], transmission_time: headers['paypal-transmission-time'], webhook_id: webhookId, webhook_event: event }) }); return r.ok && (await r.json()).verification_status === 'SUCCESS'; },
};
module.exports = PayPalService;
