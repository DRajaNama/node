const PixabayService = require('../services/pixabay.services');
const { getTemplateImageKeywords } = require('../services/templateImageKeywords.services');
const StockLibraryController = {
  search: async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const perPage = Math.min(40, Math.max(1, parseInt(req.query.perPage, 10) || 20));
      const query = String(req.query.q || '').trim();
      if (!query) return res.status(400).send({ data: null, message: 'A search query is required.' });
      return res.send({ data: await PixabayService.searchImages(query, page, perPage), message: 'Stock images found.' });
    } catch (error) { return res.status(error.status || 503).send({ data: null, message: error.message || 'Stock images are unavailable.' }); }
  },
  recommendations: async (req, res) => {
    try {
      const query = getTemplateImageKeywords(req.body || {});
      return res.send({ data: { ...(await PixabayService.searchImages(query, 1, 20)), query }, message: 'Stock image recommendations found.' });
    } catch (error) { return res.status(error.status || 503).send({ data: null, message: error.message || 'Stock images are unavailable.' }); }
  },
};
module.exports = StockLibraryController;
