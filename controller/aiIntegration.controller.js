const AIIntegrationService = require('../services/aiIntegration.service');

const handle = (fn) => async (req, res) => {
  try {
    const data = await fn(req);
    return res.send({ data, message: 'OpenAI integration updated.' });
  } catch (error) {
    const validationError = /valid OpenAI API key/i.test(error.message || '');
    const encryptionError = error.code === 'AUTOMATION_ENCRYPTION_KEY_REQUIRED';
    const status = validationError ? 400 : encryptionError ? 503 : error.status || 422;
    const message = encryptionError ? 'Secure credential storage is unavailable. Please contact support.' : error.message || 'OpenAI integration request failed.';
    return res.status(status).send({ data: null, message });
  }
};

module.exports = {
  status: handle((req) => AIIntegrationService.getStatus(req.userId)),
  test: handle((req) => AIIntegrationService.testForUser(req.userId, req.body?.apiKey || '')),
  save: handle((req) => AIIntegrationService.save(req.userId, req.body?.apiKey || '')),
  disconnect: handle((req) => AIIntegrationService.disconnect(req.userId)),
};
