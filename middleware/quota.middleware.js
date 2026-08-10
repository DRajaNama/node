const EntitlementService = require('../services/entitlement.services');
const QuotaExceededError = require('../helpers/quotaError');

const handleQuotaError = (res, error) => {
  if (error instanceof QuotaExceededError) {
    return res.status(403).send({
      data: null,
      message: error.message,
      code: error.code,
      details: error.details,
    });
  }
  throw error;
};

const checkQuota = (resourceKey, getQuantity) => async (req, res, next) => {
  try {
    const quantity = typeof getQuantity === 'function' ? await getQuantity(req) : getQuantity || 1;
    await EntitlementService.checkLimit(req.userId, resourceKey, quantity);
    next();
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return handleQuotaError(res, error);
    }
    next(error);
  }
};

const checkFeature = (featureKey) => async (req, res, next) => {
  try {
    await EntitlementService.checkFeature(req.userId, featureKey);
    next();
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return handleQuotaError(res, error);
    }
    next(error);
  }
};

module.exports = { checkQuota, checkFeature, handleQuotaError };
