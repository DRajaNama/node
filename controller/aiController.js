const AIService = require('../services/ai.service');

const AiController = {
  generateTemplate: async (req, res) => {
    try {
      const { websiteUrl, assetType } = req.body || {};
      if (!websiteUrl || !assetType) return res.status(400).send({ data: null, message: 'Website URL and asset type are required.' });
      return res.send({ data: await AIService.generateTemplate({ ...req.body, userId: req.userId }), message: 'AI template generated successfully.' });
    } catch (error) {
      const validationError = /required|must use|not allowed|did not|HTTP \d{3}/i.test(error.message || '');
      const status = validationError ? 400 : error.status || (/Please connect/i.test(error.message || '') ? 400 : 503);
      const message = error.code === 'AUTOMATION_ENCRYPTION_KEY_REQUIRED'
        ? 'Secure credential storage is unavailable. Please contact support.'
        : error.message || 'Unable to generate the template.';
      return res.status(status).send({ data: null, message });
    }
  },
};

module.exports = AiController;
