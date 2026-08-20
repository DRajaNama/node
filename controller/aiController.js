const AIService = require('../services/ai.service');
const logger = require('../helpers/logging');

const AiController = {
  generateTemplate: async (req, res) => {
    try {
      const { websiteUrl, assetType } = req.body || {};
      if (!websiteUrl || !assetType) return res.status(400).send({ data: null, message: 'Website URL and asset type are required.' });
      return res.send({ data: await AIService.generateTemplate(req.body), message: 'AI template generated successfully.' });
    } catch (error) {
      const status = /required|must use|not allowed|did not|HTTP \d{3}/i.test(error.message) ? 400 : 503;
      logger.error('AI template generation failed', error);
      return res.status(status).send({ data: null, message: error.message || 'Unable to generate the template.' });
    }
  },
};

module.exports = AiController;
