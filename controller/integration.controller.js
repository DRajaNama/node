const IntegrationService = require('../services/integration.services');

const handle = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (error) { res.status(400).send({ data: null, message: error.message || 'Integration request failed.' }); }
};

const IntegrationController = {
  providers: handle(async (req, res) => res.send({ data: { providers: IntegrationService.providers, capability: await IntegrationService.capability(req.userId) } })),
  mailchimpAudiences: handle(async (req, res) => res.send({ data: await IntegrationService.listMailchimpAudiences(req.userId) })),
  list: handle(async (req, res) => res.send({ data: await IntegrationService.list(req.userId) })),
  get: handle(async (req, res) => {
    const data = await IntegrationService.get(req.userId, req.params.id);
    if (!data) return res.status(404).send({ data: null, message: 'Integration not found.' });
    res.send({ data });
  }),
  verify: handle(async (req, res) => {
    const data = await IntegrationService.verify(req.body.provider, req.body.config || {});
    res.send({ data, message: 'Connection verified.' });
  }),
  create: handle(async (req, res) => res.status(201).send({ data: await IntegrationService.create(req.userId, req.body.provider, req.body.config || {}), message: 'Integration saved.' })),
  update: handle(async (req, res) => {
    const data = await IntegrationService.update(req.userId, req.params.id, req.body || {});
    if (!data) return res.status(404).send({ data: null, message: 'Integration not found.' });
    res.send({ data, message: 'Integration re-verified and updated.' });
  }),
  status: handle(async (req, res) => {
    const data = await IntegrationService.status(req.userId, req.params.id, req.body.enabled);
    if (!data) return res.status(404).send({ data: null, message: 'Integration not found.' });
    res.send({ data, message: data.enabled ? 'Integration enabled.' : 'Integration disabled.' });
  }),
  remove: handle(async (req, res) => res.send({ data: await IntegrationService.remove(req.userId, req.params.id), message: 'Integration deleted.' })),
};

module.exports = IntegrationController;