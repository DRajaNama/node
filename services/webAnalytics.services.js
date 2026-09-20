const crypto = require('crypto');
const AnalyticsVisit = require('../models/analyticsVisit.model');
const LandingPage = require('../models/landingPage.model');
const FormPopup = require('../models/formPopup.model');

const RESOURCE_MODELS = {
  'landing-page': LandingPage,
  'form-popup': FormPopup,
};

const buildVisitorKey = ({ visitorId, ip, userAgent }) => {
  const suppliedId = String(visitorId || '').trim().slice(0, 128);
  const fallbackId = `${String(ip || '')}|${String(userAgent || '').slice(0, 512)}`;
  return crypto
    .createHash('sha256')
    .update(suppliedId || fallbackId)
    .digest('hex');
};

const recordVisit = async ({ resourceType, resourceId, visitorId, ip, userAgent }) => {
  const ResourceModel = RESOURCE_MODELS[resourceType];
  if (!ResourceModel) throw new Error('Unsupported analytics resource');

  const visitorKey = buildVisitorKey({ visitorId, ip, userAgent });
  const now = new Date();
  let isUnique = false;

  try {
    const result = await AnalyticsVisit.updateOne(
      { resourceType, resourceId, visitorKey },
      {
        $set: { lastVisitedAt: now },
        $setOnInsert: { firstVisitedAt: now },
        $inc: { visitCount: 1 },
      },
      { upsert: true }
    );
    isUnique = result.upsertedCount === 1;
  } catch (error) {
    if (error?.code !== 11000) throw error;
    await AnalyticsVisit.updateOne(
      { resourceType, resourceId, visitorKey },
      { $set: { lastVisitedAt: now }, $inc: { visitCount: 1 } }
    );
  }

  const increments = { 'stats.views': 1 };
  if (isUnique) increments['stats.uniqueViews'] = 1;
  return ResourceModel.findByIdAndUpdate(resourceId, { $inc: increments }, { new: true });
};

const recordPopupClose = (resourceId) => FormPopup.findByIdAndUpdate(
  resourceId,
  { $inc: { 'stats.closes': 1 } },
  { new: true }
);

module.exports = {
  recordVisit,
  recordPopupClose,
};
