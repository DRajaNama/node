const IntegrationSettingsService = require('./integrationSettings.services');

const unavailable = (message) => Object.assign(new Error(message), { status: 503 });
const normalise = (hit) => ({ id: hit.id, previewUrl: hit.webformatURL || hit.previewURL, imageUrl: hit.largeImageURL || hit.webformatURL, width: hit.imageWidth, height: hit.imageHeight, tags: String(hit.tags || '').split(',').map((v) => v.trim()).filter(Boolean), source: 'pixabay' });

const PixabayService = {
  async config() {
    const integration = await IntegrationSettingsService.getIntegration('pixabay');
    if (integration && integration.enabled === false) throw unavailable('Pixabay Stock Library is currently unavailable.');
    const apiKey = integration?.config?.apiKey || process.env.PIXABAY_API_KEY || process.env.PIXABAY_API;
    if (!apiKey) throw unavailable('Pixabay Stock Library is currently unavailable.');
    return apiKey;
  },
  async searchImages(query, page = 1, perPage = 20) {
    const apiKey = await this.config();
    const params = new URLSearchParams({ key: apiKey, q: String(query || '').trim(), page: String(page), per_page: String(perPage), image_type: 'photo', safesearch: 'true' });
    let response;
    try { response = await fetch(`https://pixabay.com/api/?${params}`, { signal: AbortSignal.timeout(10000) }); } catch { throw unavailable('Stock images are temporarily unavailable. Please try again later.'); }
    if (!response.ok) throw unavailable('Stock images are temporarily unavailable. Please try again later.');
    const body = await response.json();
    return { items: (body.hits || []).map(normalise), total: body.totalHits || 0, page, perPage };
  },
  async testConnection() { await this.searchImages('nature', 1, 3); return { connected: true }; },
};
module.exports = PixabayService;
