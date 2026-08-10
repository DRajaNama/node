const EntitlementService = require('../services/entitlement.services');
const QuotaExceededError = require('../helpers/quotaError');
const PredefinedTemplate = require('../models/predefinedTemplate.model');
const { PREDEFINED_TEMPLATE_TYPES } = require('../constants/predefinedTemplate.constants');

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
    if (quantity <= 0) return next();
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

const PREDEFINED_USE_QUOTA_KEYS = {
  [PREDEFINED_TEMPLATE_TYPES.EMAIL]: 'custom_email_templates',
  [PREDEFINED_TEMPLATE_TYPES.LANDING_PAGE]: 'custom_landing_pages',
  [PREDEFINED_TEMPLATE_TYPES.POPUP]: 'lead_capture_forms',
};

const checkPredefinedUseQuota = async (req, res, next) => {
  try {
    const predefined = await PredefinedTemplate.findById(req.params.id);
    if (!predefined) return next();
    const resourceKey = PREDEFINED_USE_QUOTA_KEYS[predefined.type];
    if (resourceKey) {
      await EntitlementService.checkLimit(req.userId, resourceKey, 1);
    }
    next();
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return handleQuotaError(res, error);
    }
    next(error);
  }
};

module.exports = { checkQuota, checkFeature, checkPredefinedUseQuota, handleQuotaError };
