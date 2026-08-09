const LandingPage = require('../models/landingPage.model');
const landingPageQueue = require('../queues/landingPage.queue');
const {
  LANDING_PAGE_STATUS,
  PUBLISH_TYPE,
  LANDING_PAGE_JOB_NAME,
} = require('../constants/landingPage.constants');
const Message = require('../helpers/constant.message');
const { hasPublishableContent } = require('../validations/landingPage.validations');

const LandingPagePublishService = {
  findGlobalSlugConflict: async (slug, excludeId = null) => {
    const filter = {
      slug: slug.toLowerCase().trim(),
      status: { $in: [LANDING_PAGE_STATUS.PUBLISHED, LANDING_PAGE_STATUS.SCHEDULED] },
    };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    return LandingPage.findOne(filter);
  },

  validateForPublish: async (record) => {
    if (!record.slug || !hasPublishableContent(record.html)) {
      throw new Error('Landing page must have a valid slug and content before publishing');
    }
    const conflict = await LandingPagePublishService.findGlobalSlugConflict(record.slug, record._id);
    if (conflict) {
      throw new Error(Message.DUPLICATE_RECORD);
    }
  },

  removeScheduledJob: async (record) => {
    if (!record.scheduleJobId) return;
    try {
      const job = await landingPageQueue.getJob(record.scheduleJobId);
      if (job) await job.remove();
    } catch (err) {
      console.error('Failed to remove scheduled landing page job:', err.message);
    }
    record.scheduleJobId = null;
  },

  publishNow: async (record, userId) => {
    await LandingPagePublishService.validateForPublish(record);
    await LandingPagePublishService.removeScheduledJob(record);

    record.status = LANDING_PAGE_STATUS.PUBLISHED;
    record.publishType = PUBLISH_TYPE.NOW;
    record.publishedAt = new Date();
    record.publishedBy = userId;
    record.scheduledPublishAt = null;
    await record.save();
    return record;
  },

  schedulePublish: async (record, userId, scheduledPublishAt, timezone) => {
    await LandingPagePublishService.validateForPublish(record);

    const scheduled = new Date(scheduledPublishAt);
    const delay = scheduled.getTime() - Date.now();
    if (delay <= 0) {
      throw new Error('Scheduled time must be in the future');
    }

    await LandingPagePublishService.removeScheduledJob(record);

    const job = await landingPageQueue.add(
      LANDING_PAGE_JOB_NAME,
      {
        landingPageId: record._id.toString(),
        userId: userId.toString(),
      },
      { delay }
    );

    record.status = LANDING_PAGE_STATUS.SCHEDULED;
    record.publishType = PUBLISH_TYPE.SCHEDULE;
    record.scheduledPublishAt = scheduled;
    record.timezone = timezone || record.timezone || 'Asia/Kolkata';
    record.scheduleJobId = job.id;
    record.publishedAt = null;
    await record.save();
    return record;
  },

  cancelSchedule: async (record) => {
    await LandingPagePublishService.removeScheduledJob(record);
    record.status = LANDING_PAGE_STATUS.DRAFT;
    record.publishType = PUBLISH_TYPE.NOW;
    record.scheduledPublishAt = null;
    await record.save();
    return record;
  },

  reschedule: async (record, userId, scheduledPublishAt, timezone) => {
    return LandingPagePublishService.schedulePublish(record, userId, scheduledPublishAt, timezone);
  },

  executeScheduledPublish: async (landingPageId, userId) => {
    const record = await LandingPage.findById(landingPageId);
    if (!record) {
      throw new Error(Message.DATA_NOT_FOUND);
    }
    if (record.status !== LANDING_PAGE_STATUS.SCHEDULED) {
      return record;
    }
    if (String(record.userId) !== String(userId)) {
      throw new Error(Message.DATA_NOT_FOUND);
    }

    await LandingPagePublishService.validateForPublish(record);

    record.status = LANDING_PAGE_STATUS.PUBLISHED;
    record.publishType = PUBLISH_TYPE.NOW;
    record.publishedAt = new Date();
    record.publishedBy = userId;
    record.scheduledPublishAt = null;
    record.scheduleJobId = null;
    await record.save();
    return record;
  },
};

module.exports = LandingPagePublishService;
