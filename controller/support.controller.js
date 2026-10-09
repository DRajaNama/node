const mongoose = require('mongoose');
const SupportTicket = require('../models/supportTicket.model');
const SupportCategory = require('../models/supportCategory.model');
const SupportArticle = require('../models/supportArticle.model');
const SupportSettings = require('../models/supportSettings.model');
const SupportArticleFeedback = require('../models/supportArticleFeedback.model');
const User = require('../models/user.model');
const { storagePath: attachmentPath } = require('../middleware/supportAttachment.upload.middleware');
const path = require('path');
const UserNotificationService = require('../services/userNotification.services');
const AuditLogService = require('../services/auditLog.services');
const { ensureSupportDefaults } = require('../services/supportDefaults.services');

const STATUSES = ['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const ISSUE_TYPES = ['question', 'technical', 'billing', 'feedback', 'other'];
const safeText = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const settings = async () => {
  let value = await SupportSettings.findOne({ key: 'global' }).lean();
  if (!value) value = (await SupportSettings.create({ key: 'global' })).toObject();
  return value;
};
const ticketCode = () => `SUP-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const audit = (req, action, ticket) => AuditLogService.create({
  userId: req.userId, action, resource: 'SupportTicket', resourceId: ticket?._id,
  metadata: { ticketNumber: ticket?.ticketNumber }, ip: req.ip,
}).catch(() => {});
const notifyLive = (userId, title, message, link) => UserNotificationService.createAndEmit({
  userId, title, message, type: 'support', link,
}).catch(() => {});
const notifyAdmins = async (title, message, link, exceptUserId) => {
  try {
    const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, isActive: true }).select('_id').lean();
    await Promise.all(admins.filter((admin) => String(admin._id) !== String(exceptUserId || '')).map((admin) => notifyLive(admin._id, title, message, link)));
  } catch { /* Support actions should still succeed if notifications are temporarily unavailable. */ }
};
const userSafeTicket = (ticket) => {
  const item = ticket.toObject ? ticket.toObject() : ticket;
  if ((!item.messages || item.messages.length === 0) && item.message) {
    item.messages = [{ body: item.message, authorRole: 'user', isInternal: false, createdAt: item.createdAt }];
  }
  item.messages = (item.messages || []).filter((message) => !message.isInternal);
  return item;
};
const attachmentsFrom = (req) => (req.files || []).map((file) => ({
  storedName: file.filename,
  originalName: safeText(path.basename(file.originalname || 'attachment'), 180),
  mimeType: file.mimetype,
  size: file.size,
}));
const populateTicket = (query) => query.populate('userId', 'name email').populate('assignedTo', 'name email').populate('categoryId', 'name');

const SupportController = {
  overview: async (req, res) => {
    try {
      const config = await settings();
      await ensureSupportDefaults();
      const filter = { status: 'published' };
      if (req.query.kind && ['article', 'faq'].includes(req.query.kind)) filter.kind = req.query.kind;
      const search = safeText(req.query.search, 100);
      if (search) filter.$or = [
        { title: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { body: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      ];
      if (!config.showKnowledgeBase) filter._id = { $exists: false };
      const [categories, articles] = await Promise.all([
        SupportCategory.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
        SupportArticle.find(filter).populate('categoryId', 'name').sort({ sortOrder: 1, updatedAt: -1 }).limit(100).lean(),
      ]);
      res.send({ data: { categories, articles, settings: {
        enabled: config.enabled, allowTicketCreation: config.allowTicketCreation,
        showKnowledgeBase: config.showKnowledgeBase, supportEmail: config.supportEmail,
        responseSlaHours: config.responseSlaHours,
      } } });
    } catch (error) { res.status(500).send({ data: null, message: 'Unable to load help center.' }); }
  },

  listTickets: async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filter = { userId: req.userId };
    if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
    const [data, total] = await Promise.all([
      SupportTicket.find(filter).populate('categoryId', 'name').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      SupportTicket.countDocuments(filter),
    ]);
    res.send({ data: data.map(userSafeTicket), meta: { page, limit, total } });
  },

  createTicket: async (req, res) => {
    try {
      const config = await settings();
      if (!config.enabled || !config.allowTicketCreation) return res.status(403).send({ message: 'Support ticket creation is currently unavailable.' });
      const subject = safeText(req.body.subject, 180);
      const body = safeText(req.body.message, 10000);
      const issueType = ISSUE_TYPES.includes(req.body.issueType) ? req.body.issueType : 'other';
      if (subject.length < 4 || body.length < 10) return res.status(400).send({ message: 'Enter a subject (at least 4 characters) and a message (at least 10 characters).' });
      let categoryId = null;
      if (req.body.categoryId) {
        if (!isId(req.body.categoryId)) return res.status(400).send({ message: 'Choose a valid category.' });
        const category = await SupportCategory.findOne({ _id: req.body.categoryId, isActive: true });
        if (!category) return res.status(400).send({ message: 'Choose an available category.' });
        categoryId = category._id;
      }
      const user = await User.findById(req.userId).select('role');
      const ticket = await SupportTicket.create({
        ticketNumber: ticketCode(), userId: req.userId, subject, message: body,
        categoryId, issueType, priority: 'medium', status: 'open',
        messages: [{ authorId: req.userId, authorRole: user?.role || 'user', body, attachments: attachmentsFrom(req) }],
      });
      await Promise.all([
        notifyLive(req.userId, 'Support request received', `We received ${ticket.ticketNumber}. You can follow replies in My Requests.`, '/support'),
        notifyAdmins('New support request', `${ticket.ticketNumber} · ${ticket.subject}`, '/admin/support'),
      ]);
      await audit(req, 'Support Ticket Created', ticket);
      res.status(201).send({ data: userSafeTicket(ticket), message: 'Your support request has been created.' });
    } catch (error) { res.status(500).send({ data: null, message: 'Unable to create support ticket.' }); }
  },

  getTicket: async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).send({ message: 'Invalid ticket.' });
    const ticket = await SupportTicket.findOne({ _id: req.params.id, userId: req.userId }).populate('categoryId', 'name');
    if (!ticket) return res.status(404).send({ message: 'Ticket not found.' });
    res.send({ data: userSafeTicket(ticket) });
  },

  articleFeedback: async (req, res) => {
    if (!isId(req.params.id) || typeof req.body.helpful !== 'boolean') return res.status(400).send({ message: 'Choose whether this article was helpful.' });
    const article = await SupportArticle.findOne({ _id: req.params.id, status: 'published' });
    if (!article) return res.status(404).send({ message: 'Help content not found.' });
    await SupportArticleFeedback.findOneAndUpdate(
      { articleId: article._id, userId: req.userId },
      { $set: { helpful: req.body.helpful } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const [helpfulYes, helpfulNo] = await Promise.all([
      SupportArticleFeedback.countDocuments({ articleId: article._id, helpful: true }),
      SupportArticleFeedback.countDocuments({ articleId: article._id, helpful: false }),
    ]);
    await SupportArticle.updateOne({ _id: article._id }, { $set: { helpfulYes, helpfulNo } });
    res.send({ data: { helpfulYes, helpfulNo }, message: 'Thanks for your feedback.' });
  },

  reply: async (req, res) => {
    const body = safeText(req.body.message, 10000);
    if (body.length < 2) return res.status(400).send({ message: 'Write a reply before sending.' });
    const ticket = await SupportTicket.findOne({ _id: req.params.id, userId: req.userId });
    if (!ticket) return res.status(404).send({ message: 'Ticket not found.' });
    if (ticket.status === 'closed') return res.status(409).send({ message: 'This ticket is closed. Create a new request if you still need help.' });
    const user = await User.findById(req.userId).select('role');
    ticket.messages.push({ authorId: req.userId, authorRole: user?.role || 'user', body, attachments: attachmentsFrom(req) });
    ticket.message = body;
    if (['resolved', 'waiting_for_user'].includes(ticket.status)) ticket.status = 'open';
    await ticket.save();
    await Promise.all([
      notifyLive(req.userId, 'Support reply sent', `Your reply was added to ${ticket.ticketNumber || 'your support request'}.`, '/support'),
      notifyAdmins('Customer replied to a ticket', `${ticket.ticketNumber || 'A support ticket'} received a new reply.`, '/admin/support'),
    ]);
    await audit(req, 'Support Ticket Replied', ticket);
    res.send({ data: userSafeTicket(ticket), message: 'Reply sent.' });
  },

  adminListTickets: async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const filter = {};
    if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
    if (PRIORITIES.includes(req.query.priority)) filter.priority = req.query.priority;
    const search = safeText(req.query.search, 100);
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { ticketNumber: { $regex: escaped, $options: 'i' } },
        { subject: { $regex: escaped, $options: 'i' } },
      ];
    }
    const [data, total] = await Promise.all([
      populateTicket(SupportTicket.find(filter)).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
      SupportTicket.countDocuments(filter),
    ]);
    res.send({ data, meta: { page, limit, total } });
  },

  adminStats: async (_req, res) => {
    const [total, open, inProgress, waiting, resolved, closed, urgent] = await Promise.all([
      SupportTicket.countDocuments(), SupportTicket.countDocuments({ status: 'open' }),
      SupportTicket.countDocuments({ status: 'in_progress' }), SupportTicket.countDocuments({ status: 'waiting_for_user' }),
      SupportTicket.countDocuments({ status: 'resolved' }), SupportTicket.countDocuments({ status: 'closed' }),
      SupportTicket.countDocuments({ priority: 'urgent', status: { $nin: ['resolved', 'closed'] } }),
    ]);
    res.send({ data: { total, open, inProgress, waiting, resolved, closed, urgent } });
  },

  adminAgents: async (_req, res) => {
    const agents = await User.find({ role: { $in: ['admin', 'super_admin'] }, isActive: true }).select('name email role').sort({ name: 1 }).lean();
    res.send({ data: agents });
  },

  adminGetTicket: async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).send({ message: 'Invalid ticket.' });
    const ticket = await populateTicket(SupportTicket.findById(req.params.id));
    if (!ticket) return res.status(404).send({ message: 'Ticket not found.' });
    res.send({ data: ticket });
  },

  adminReply: async (req, res) => {
    const body = safeText(req.body.message, 10000);
    if (body.length < 2) return res.status(400).send({ message: 'Write a reply before sending.' });
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).send({ message: 'Ticket not found.' });
    const user = await User.findById(req.userId).select('role');
    const isInternal = req.body.isInternal === true || req.body.isInternal === 'true';
    ticket.messages.push({ authorId: req.userId, authorRole: user?.role || 'admin', body, isInternal, attachments: attachmentsFrom(req) });
    if (!isInternal) {
      ticket.message = body;
      if (ticket.status !== 'closed') ticket.status = 'waiting_for_user';
    }
    await ticket.save();
    if (!isInternal) {
      await notifyLive(ticket.userId, 'Support replied to your ticket', `There is a new reply for ${ticket.ticketNumber || ticket.subject}.`, '/support');
    } else {
      await notifyAdmins('Internal support note added', `An internal note was added to ${ticket.ticketNumber || ticket.subject}.`, '/admin/support', req.userId);
    }
    await audit(req, isInternal ? 'Support Internal Note Added' : 'Support Ticket Replied', ticket);
    res.send({ data: await populateTicket(SupportTicket.findById(ticket._id)), message: 'Reply sent.' });
  },

  adminUpdateTicket: async (req, res) => {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).send({ message: 'Ticket not found.' });
    const previousStatus = ticket.status;
    const previousPriority = ticket.priority;
    const previousAssignee = String(ticket.assignedTo || '');
    const allowed = {};
    if (req.body.status !== undefined) {
      if (!STATUSES.includes(req.body.status)) return res.status(400).send({ message: 'Choose a valid status.' });
      allowed.status = req.body.status;
      ticket.resolvedAt = req.body.status === 'resolved' ? new Date() : null;
      ticket.closedAt = req.body.status === 'closed' ? new Date() : null;
    }
    if (req.body.priority !== undefined) {
      if (!PRIORITIES.includes(req.body.priority)) return res.status(400).send({ message: 'Choose a valid priority.' });
      allowed.priority = req.body.priority;
    }
    if (req.body.assignedTo !== undefined) {
      if (req.body.assignedTo && !isId(req.body.assignedTo)) return res.status(400).send({ message: 'Choose a valid assignee.' });
      if (req.body.assignedTo) {
        const assignee = await User.findOne({ _id: req.body.assignedTo, role: { $in: ['admin', 'super_admin'] }, isActive: true });
        if (!assignee) return res.status(400).send({ message: 'Choose an active support administrator.' });
        allowed.assignedTo = assignee._id;
      } else allowed.assignedTo = null;
    }
    Object.assign(ticket, allowed);
    await ticket.save();
    await audit(req, 'Support Ticket Updated', ticket);
    if (allowed.status && previousStatus !== allowed.status) await notifyLive(ticket.userId, 'Support ticket updated', `Your ticket ${ticket.ticketNumber || ticket.subject} is now ${allowed.status.replace(/_/g, ' ')}.`, '/support');
    if (allowed.assignedTo && previousAssignee !== String(allowed.assignedTo) && String(allowed.assignedTo) !== String(req.userId)) {
      await notifyLive(allowed.assignedTo, 'Support ticket assigned to you', `${ticket.ticketNumber || ticket.subject} is assigned to you.`, '/admin/support');
    }
    if (allowed.priority && previousPriority !== allowed.priority && ticket.assignedTo && String(ticket.assignedTo) !== String(req.userId)) {
      await notifyLive(ticket.assignedTo, 'Support ticket priority updated', `${ticket.ticketNumber || ticket.subject} is now ${allowed.priority} priority.`, '/admin/support');
    }
    res.send({ data: await populateTicket(SupportTicket.findById(ticket._id)), message: 'Ticket updated.' });
  },

  adminCategories: async (_req, res) => {
    await ensureSupportDefaults();
    res.send({ data: await SupportCategory.find().sort({ sortOrder: 1, name: 1 }).lean() });
  },
  saveCategory: async (req, res) => {
    const name = safeText(req.body.name, 80);
    if (name.length < 2) return res.status(400).send({ message: 'Category name is required.' });
    try {
      const values = { name, description: safeText(req.body.description, 300), sortOrder: Number(req.body.sortOrder) || 0, isActive: req.body.isActive !== false };
      const category = req.params.id
        ? await SupportCategory.findByIdAndUpdate(req.params.id, { $set: values }, { new: true, runValidators: true })
        : await SupportCategory.create(values);
      if (!category) return res.status(404).send({ message: 'Category not found.' });
      res.send({ data: category, message: 'Category saved.' });
    } catch (error) { res.status(error.code === 11000 ? 409 : 400).send({ message: error.code === 11000 ? 'A category with that name already exists.' : 'Unable to save category.' }); }
  },
  deleteCategory: async (req, res) => {
    const used = await SupportArticle.exists({ categoryId: req.params.id });
    const tickets = await SupportTicket.exists({ categoryId: req.params.id });
    if (used || tickets) return res.status(409).send({ message: 'This category is in use. Deactivate it instead.' });
    const deleted = await SupportCategory.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).send({ message: 'Category not found.' });
    res.send({ data: null, message: 'Category deleted.' });
  },

  adminArticles: async (_req, res) => {
    await ensureSupportDefaults();
    res.send({ data: await SupportArticle.find().populate('categoryId', 'name').sort({ kind: 1, sortOrder: 1, updatedAt: -1 }).lean() });
  },
  saveArticle: async (req, res) => {
    const title = safeText(req.body.title, 180);
    const body = safeText(req.body.body, 30000);
    const kind = ['article', 'faq'].includes(req.body.kind) ? req.body.kind : 'article';
    const status = ['draft', 'published'].includes(req.body.status) ? req.body.status : 'draft';
    if (title.length < 3 || body.length < (kind === 'faq' ? 3 : 10)) return res.status(400).send({ message: 'Enter a title and helpful content.' });
    const slug = safeText(req.body.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), 200).toLowerCase();
    const values = { title, body, kind, status, slug, sortOrder: Number(req.body.sortOrder) || 0, categoryId: isId(req.body.categoryId) ? req.body.categoryId : null };
    try {
      const article = req.params.id
        ? await SupportArticle.findByIdAndUpdate(req.params.id, { $set: values }, { new: true, runValidators: true })
        : await SupportArticle.create(values);
      if (!article) return res.status(404).send({ message: 'Help content not found.' });
      res.send({ data: article, message: 'Help content saved.' });
    } catch (error) { res.status(error.code === 11000 ? 409 : 400).send({ message: error.code === 11000 ? 'That URL slug is already in use.' : 'Unable to save help content.' }); }
  },
  deleteArticle: async (req, res) => {
    const deleted = await SupportArticle.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).send({ message: 'Help content not found.' });
    res.send({ data: null, message: 'Help content deleted.' });
  },
  adminSettings: async (_req, res) => {
    const config = await settings();
    res.send({ data: config });
  },
  updateSettings: async (req, res) => {
    const values = {
      enabled: req.body.enabled !== false,
      supportEmail: safeText(req.body.supportEmail, 254).toLowerCase(),
      responseSlaHours: Math.min(720, Math.max(1, Number(req.body.responseSlaHours) || 24)),
      allowTicketCreation: req.body.allowTicketCreation !== false,
      showKnowledgeBase: req.body.showKnowledgeBase !== false,
    };
    const config = await SupportSettings.findOneAndUpdate({ key: 'global' }, { $set: values }, { upsert: true, new: true, runValidators: true });
    res.send({ data: config, message: 'Support settings saved.' });
  },

  downloadAttachment: async (req, res) => {
    if (!isId(req.params.id) || !/^[a-f0-9-]{36}$/i.test(req.params.storedName)) return res.status(404).send({ message: 'Attachment not found.' });
    const [ticket, user] = await Promise.all([
      SupportTicket.findById(req.params.id).select('userId messages').lean(),
      User.findById(req.userId).select('role').lean(),
    ]);
    if (!ticket || !user) return res.status(404).send({ message: 'Attachment not found.' });
    const isAdmin = ['admin', 'super_admin'].includes(user.role);
    if (!isAdmin && String(ticket.userId) !== String(req.userId)) return res.status(404).send({ message: 'Attachment not found.' });
    let found = null;
    for (const message of ticket.messages || []) {
      if (!isAdmin && message.isInternal) continue;
      found = (message.attachments || []).find((attachment) => attachment.storedName === req.params.storedName);
      if (found) break;
    }
    if (!found) return res.status(404).send({ message: 'Attachment not found.' });
    const target = path.resolve(attachmentPath, found.storedName);
    if (!target.startsWith(`${path.resolve(attachmentPath)}${path.sep}`)) return res.status(404).send({ message: 'Attachment not found.' });
    res.type(found.mimeType).download(target, found.originalName, (error) => {
      if (error && !res.headersSent) res.status(error.statusCode === 404 ? 404 : 500).send({ message: 'Attachment could not be downloaded.' });
    });
  },
};

module.exports = SupportController;
