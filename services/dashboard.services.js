const mongoose = require('mongoose');

const AutomationExecution = require('../models/automationExecution.model');
const Campaign = require('../models/campaign.model');
const CampaignEvent = require('../models/campaignEvent.model');
const CampaignRecipient = require('../models/campaignRecipient.model');
const Contact = require('../models/contacts.model');
const FormPopup = require('../models/formPopup.model');
const Integration = require('../models/integration.model');
const LandingPage = require('../models/landingPage.model');
const Lead = require('../models/lead.model');

const VALID_RANGES = new Set(['today', '7d', '30d', 'month', 'year']);

const startOfUtcDay = (value) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const getRange = (requestedRange = '30d') => {
  const key = VALID_RANGES.has(requestedRange) ? requestedRange : '30d';
  const now = new Date();
  let start;
  let interval = 'day';

  if (key === 'today') {
    start = startOfUtcDay(now);
    interval = 'hour';
  } else if (key === '7d') {
    start = startOfUtcDay(now);
    start.setUTCDate(start.getUTCDate() - 6);
  } else if (key === 'month') {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  } else if (key === 'year') {
    start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    interval = 'month';
  } else {
    start = startOfUtcDay(now);
    start.setUTCDate(start.getUTCDate() - 29);
  }

  const end = new Date(now.getTime() + 1);
  const duration = end.getTime() - start.getTime();
  return {
    key,
    start,
    end,
    previousStart: new Date(start.getTime() - duration),
    previousEnd: start,
    interval,
  };
};

const percent = (part, total) => (total > 0 ? Math.round((part / total) * 10000) / 100 : 0);

const trend = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

const sumResourceStats = async (Model, userId) => {
  const [result] = await Model.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        views: { $sum: { $ifNull: ['$stats.views', 0] } },
        uniqueViews: { $sum: { $ifNull: ['$stats.uniqueViews', 0] } },
        leads: { $sum: { $ifNull: ['$stats.leads', 0] } },
      },
    },
  ]);
  return result || { views: 0, uniqueViews: 0, leads: 0 };
};

const getWebTotals = async (userId) => {
  const [landingPages, popups] = await Promise.all([
    sumResourceStats(LandingPage, userId),
    sumResourceStats(FormPopup, userId),
  ]);
  const views = landingPages.views + popups.views;
  const uniqueViews = landingPages.uniqueViews + popups.uniqueViews;
  const leads = landingPages.leads + popups.leads;
  return { views, uniqueViews, leads, conversionRate: percent(leads, views), landingPages, popups };
};

const dateGroupFormat = (interval) => {
  if (interval === 'hour') return '%Y-%m-%dT%H:00';
  if (interval === 'month') return '%Y-%m';
  return '%Y-%m-%d';
};

const buildBuckets = ({ start, end, interval }) => {
  const buckets = [];
  const cursor = new Date(start);
  while (cursor < end) {
    let key;
    let label;
    if (interval === 'hour') {
      key = `${cursor.toISOString().slice(0, 13)}:00`;
      label = `${String(cursor.getUTCHours()).padStart(2, '0')}:00`;
      cursor.setUTCHours(cursor.getUTCHours() + 1);
    } else if (interval === 'month') {
      key = cursor.toISOString().slice(0, 7);
      label = cursor.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    } else {
      key = cursor.toISOString().slice(0, 10);
      label = cursor.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    buckets.push({ key, label });
  }
  return buckets;
};

const aggregateTimestamp = (userId, field, range) => CampaignRecipient.aggregate([
  { $match: { userId, [field]: { $gte: range.start, $lt: range.end } } },
  {
    $group: {
      _id: { $dateToString: { format: dateGroupFormat(range.interval), date: `$${field}`, timezone: 'UTC' } },
      count: { $sum: 1 },
    },
  },
]);

const aggregateDeliveredTimestamp = (userId, range) => CampaignRecipient.aggregate([
  { $match: { userId } },
  { $project: { effectiveAt: { $ifNull: ['$deliveredAt', '$sentAt'] } } },
  { $match: { effectiveAt: { $gte: range.start, $lt: range.end } } },
  {
    $group: {
      _id: { $dateToString: { format: dateGroupFormat(range.interval), date: '$effectiveAt', timezone: 'UTC' } },
      count: { $sum: 1 },
    },
  },
]);

const getPerformanceTimeline = async (userId, range) => {
  const [sentRows, deliveredRows, openedRows, clickedRows] = await Promise.all([
    aggregateTimestamp(userId, 'sentAt', range),
    aggregateDeliveredTimestamp(userId, range),
    aggregateTimestamp(userId, 'openedAt', range),
    aggregateTimestamp(userId, 'clickedAt', range),
  ]);
  const toMap = (rows) => new Map(rows.map((row) => [row._id, row.count]));
  const sent = toMap(sentRows);
  const delivered = toMap(deliveredRows);
  const opened = toMap(openedRows);
  const clicked = toMap(clickedRows);

  return buildBuckets(range).map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    sent: sent.get(bucket.key) || 0,
    delivered: delivered.get(bucket.key) || 0,
    opened: opened.get(bucket.key) || 0,
    clicked: clicked.get(bucket.key) || 0,
  }));
};

const countRecipients = (userId, field, range) => CampaignRecipient.countDocuments({
  userId,
  [field]: { $gte: range.start, $lt: range.end },
});

const getEmailTotals = async (userId, range) => {
  const [sent, delivered, opened, clicked, bounced, failed, pending] = await Promise.all([
    countRecipients(userId, 'sentAt', range),
    CampaignRecipient.countDocuments({
      userId,
      $or: [
        { deliveredAt: { $gte: range.start, $lt: range.end } },
        { deliveredAt: null, sentAt: { $gte: range.start, $lt: range.end } },
      ],
    }),
    countRecipients(userId, 'openedAt', range),
    countRecipients(userId, 'clickedAt', range),
    countRecipients(userId, 'bouncedAt', range),
    CampaignRecipient.countDocuments({ userId, status: 'failed', updatedAt: { $gte: range.start, $lt: range.end } }),
    CampaignRecipient.countDocuments({
      userId,
      status: { $in: ['pending', 'queued', 'sending'] },
      createdAt: { $gte: range.start, $lt: range.end },
    }),
  ]);
  return {
    sent, delivered, opened, clicked, bounced, failed, pending,
    deliveryRate: percent(delivered, sent),
    openRate: percent(opened, sent),
    clickRate: percent(clicked, sent),
  };
};

const getLeadSources = async (userId, range) => {
  const rows = await Lead.aggregate([
    { $match: { userId, createdAt: { $gte: range.start, $lt: range.end } } },
    { $group: { _id: '$source', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const metadata = {
    'landing-page': { label: 'Landing Pages', icon: 'web', className: 'landing' },
    'form-popup': { label: 'Form Popups', icon: 'open_in_new', className: 'popup' },
  };
  return rows.map((row) => ({
    source: row._id,
    count: row.count,
    share: percent(row.count, total),
    ...(metadata[row._id] || { label: row._id || 'Unknown', icon: 'language', className: 'website' }),
  }));
};

const getAutomationSummary = async (userId, range) => {
  const rows = await AutomationExecution.aggregate([
    { $match: { userId, createdAt: { $gte: range.start, $lt: range.end } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(rows.map((row) => [row._id, row.count]));
  return {
    triggered: rows.reduce((sum, row) => sum + row.count, 0),
    successful: counts.SUCCESS || 0,
    failed: counts.FAILED || 0,
    running: (counts.RUNNING || 0) + (counts.PENDING || 0),
  };
};

const getRecentActivity = async (userId) => {
  const [leads, campaigns, executions] = await Promise.all([
    Lead.find({ userId }).sort({ createdAt: -1 }).limit(5).select('email firstName lastName source createdAt').lean(),
    Campaign.find({ userId }).sort({ updatedAt: -1 }).limit(5).select('name status updatedAt').lean(),
    AutomationExecution.find({ userId }).sort({ createdAt: -1 }).limit(5)
      .select('automationId status createdAt').populate('automationId', 'name').lean(),
  ]);
  return [
    ...leads.map((lead) => ({
      type: 'lead', icon: 'person_add', title: 'New lead captured',
      detail: lead.email || [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.source,
      at: lead.createdAt,
    })),
    ...campaigns.map((campaign) => ({
      type: 'campaign', icon: 'campaign', title: `Campaign ${campaign.status}`,
      detail: campaign.name, at: campaign.updatedAt,
    })),
    ...executions.map((execution) => ({
      type: 'automation', icon: 'sync', title: `Automation ${String(execution.status).toLowerCase()}`,
      detail: execution.automationId?.name || 'Automation workflow', at: execution.createdAt,
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6);
};

const getTopCampaigns = async (userId, range) => {
  const campaigns = await Campaign.find({
    userId,
    'stats.sent': { $gt: 0 },
    updatedAt: { $gte: range.start, $lt: range.end },
  })
    .sort({ updatedAt: -1 }).limit(100).select('name status stats updatedAt').lean();
  return campaigns.map((campaign) => ({
    id: campaign._id,
    name: campaign.name,
    status: campaign.status,
    sent: campaign.stats?.sent || 0,
    delivered: (campaign.stats?.delivered || 0) > 0
      ? campaign.stats.delivered
      : campaign.stats?.sent || 0,
    opened: campaign.stats?.opened || 0,
    clicked: campaign.stats?.clicked || 0,
    openRate: percent(campaign.stats?.opened || 0, campaign.stats?.sent || 0),
    clickRate: percent(campaign.stats?.clicked || 0, campaign.stats?.sent || 0),
    updatedAt: campaign.updatedAt,
  })).sort((a, b) => b.clickRate - a.clickRate || b.sent - a.sent).slice(0, 5);
};

const getDeviceStats = async (userId, range) => {
  const campaignIds = await Campaign.distinct('_id', { userId });
  if (campaignIds.length === 0) return { mobile: 0, desktop: 0, tablet: 0 };
  const events = await CampaignEvent.find({
    campaignId: { $in: campaignIds }, event: 'opened',
    createdAt: { $gte: range.start, $lt: range.end },
  }).sort({ createdAt: 1 }).select('recipientId userAgent').lean();
  const seenRecipients = new Set();
  return events.reduce((totals, event) => {
    const recipientKey = String(event.recipientId);
    if (seenRecipients.has(recipientKey)) return totals;
    seenRecipients.add(recipientKey);
    const agent = String(event.userAgent || '').toLowerCase();
    if (/ipad|tablet|kindle|silk/.test(agent)) totals.tablet += 1;
    else if (/mobile|iphone|ipod|android/.test(agent)) totals.mobile += 1;
    else totals.desktop += 1;
    return totals;
  }, { mobile: 0, desktop: 0, tablet: 0 });
};

const DashboardService = {
  getSummary: async (rawUserId, requestedRange) => {
    const userId = new mongoose.Types.ObjectId(rawUserId);
    const range = getRange(requestedRange);
    const previousRange = { start: range.previousStart, end: range.previousEnd };
    const [
      leads, previousLeads, totalContacts, newContacts, previousContacts,
      campaignIds, previousCampaignIds, web, leadSources, automation,
      integrations, recentActivity, performance,
    ] = await Promise.all([
      Lead.countDocuments({ userId, createdAt: { $gte: range.start, $lt: range.end } }),
      Lead.countDocuments({ userId, createdAt: { $gte: previousRange.start, $lt: previousRange.end } }),
      Contact.countDocuments({ userId }),
      Contact.countDocuments({ userId, createdAt: { $gte: range.start, $lt: range.end } }),
      Contact.countDocuments({ userId, createdAt: { $gte: previousRange.start, $lt: previousRange.end } }),
      CampaignRecipient.distinct('campaignId', { userId, sentAt: { $gte: range.start, $lt: range.end } }),
      CampaignRecipient.distinct('campaignId', { userId, sentAt: { $gte: previousRange.start, $lt: previousRange.end } }),
      getWebTotals(userId), getLeadSources(userId, range), getAutomationSummary(userId, range),
      Integration.find({ userId, enabled: true }).sort({ name: 1 }).select('name provider type enabled').lean(),
      getRecentActivity(userId), getPerformanceTimeline(userId, range),
    ]);
    return {
      range: range.key,
      period: { start: range.start, end: range.end },
      kpis: {
        newLeads: { value: leads, previous: previousLeads, trend: trend(leads, previousLeads) },
        contacts: { value: totalContacts, added: newContacts, trend: trend(newContacts, previousContacts) },
        campaignsSent: { value: campaignIds.length, previous: previousCampaignIds.length, trend: trend(campaignIds.length, previousCampaignIds.length) },
        conversionRate: { value: web.conversionRate, leads: web.leads, visits: web.views },
      },
      performance, leadSources, automation, integrations, recentActivity, web,
    };
  },

  getStatistics: async (rawUserId, requestedRange) => {
    const userId = new mongoose.Types.ObjectId(rawUserId);
    const range = getRange(requestedRange);
    const [totals, performance, topCampaigns, deviceStats] = await Promise.all([
      getEmailTotals(userId, range), getPerformanceTimeline(userId, range),
      getTopCampaigns(userId, range), getDeviceStats(userId, range),
    ]);
    return {
      range: range.key,
      period: { start: range.start, end: range.end },
      totals, performance,
      delivery: { delivered: totals.delivered, bounced: totals.bounced, failed: totals.failed, pending: totals.pending },
      devices: deviceStats,
      topCampaigns,
      recentCampaigns: [...topCampaigns].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5),
    };
  },

  getCalendarEvents: async (rawUserId, startDate, endDate) => {
    const userId = new mongoose.Types.ObjectId(rawUserId);
    const start = new Date(startDate);
    const end = new Date(endDate);
    const calendarEvents = [];
    const campaigns = await Campaign.find({ userId, scheduledAt: { $gte: start, $lte: end } }).lean();
    campaigns.forEach((campaign) => calendarEvents.push({
      id: campaign._id, campaignId: campaign._id, title: campaign.name, type: 'scheduled',
      start: campaign.scheduledAt, end: campaign.scheduledAt, status: campaign.status,
      color: campaign.status === 'scheduled' ? '#2563eb' : campaign.status === 'completed' ? '#16a34a' : '#f59e0b',
    }));
    const events = await CampaignEvent.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $lookup: { from: 'campaigns', localField: 'campaignId', foreignField: '_id', as: 'campaign' } },
      { $unwind: '$campaign' },
      { $match: { 'campaign.userId': userId } },
      {
        $group: {
          _id: { campaignId: '$campaignId', event: '$event', day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
          count: { $sum: 1 }, campaignName: { $first: '$campaign.name' },
        },
      },
    ]);
    const colors = { opened: '#10b981', clicked: '#8b5cf6', delivered: '#2563eb', bounced: '#ef4444', complaint: '#dc2626', unsubscribed: '#f97316', sent: '#0ea5e9' };
    events.forEach((item) => calendarEvents.push({
      id: `${item._id.campaignId}-${item._id.event}-${item._id.day}`, campaignId: item._id.campaignId,
      title: `${item.campaignName} - ${item.count} ${item._id.event}`, type: item._id.event,
      start: item._id.day, count: item.count, color: colors[item._id.event] || '#6b7280',
    }));
    return calendarEvents;
  },
};

module.exports = DashboardService;
