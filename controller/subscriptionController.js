const SubscriptionService = require('../services/subscription.services');
const PlanService = require('../services/plan.services');
const Message = require('../helpers/constant.message');
const Plan = require('../models/plan.model');
const Subscription = require('../models/subscription.model');
const Payment = require('../models/payment.model');
const PayPal = require('../services/paypal.services');
const PayPalEvent = require('../models/paypalWebhookEvent.model');

const SubscriptionController = {
  getMySubscription: async (req, res) => {
    try {
      const data = await SubscriptionService.getUserSubscription(req.userId);
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getMyPayments: async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const data = await SubscriptionService.getUserPayments(req.userId, page, limit);
      const total = await Payment.countDocuments({ userId: req.userId });
      res.send({ data, message: Message.SUCCESS, meta: { page, limit, total } });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  listPlans: async (req, res) => {
    try {
      const data = await SubscriptionService.listActivePlans();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getUsageSummary: async (req, res) => {
    try {
      const data = await SubscriptionService.getUsageSummary(req.userId);
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  getEntitlementRegistry: async (req, res) => {
    try {
      const data = SubscriptionService.getEntitlementRegistry();
      res.send({ data, message: Message.SUCCESS });
    } catch (error) {
      res.status(500).send({ data: null, message: Message.SERVER_ERROR });
    }
  },

  paypalConfig: async (_req, res) => {
    try { const config = await PayPal.config(); res.send({ data: { clientId: config.clientId, environment: config.env }, message: Message.SUCCESS }); }
    catch (error) { res.status(error.status || 503).send({ data: null, message: error.message }); }
  },

  preparePayPal: async (req, res) => {
    try {
      const plan = await Plan.findOne({ _id: req.body.planId, status: 'active', isPublic: true });
      const chargeAmount = plan?.billingInterval === 'yearly' ? plan.yearlyPrice : plan?.monthlyPrice;
      if (!plan || chargeAmount <= 0 || !plan.paypalPlanId) return res.status(400).send({ data: null, message: 'This plan is not available for PayPal subscription.' });
      const duplicate = await Subscription.findOne({ userId: req.userId, planId: plan._id, status: { $in: ['pending', 'active', 'trial', 'past_due', 'paused'] }, paymentProvider: 'paypal' });
      if (duplicate) return res.status(409).send({ data: null, message: 'You already have a subscription in progress for this plan.' });
      const pending = await SubscriptionService.createSubscriptionWithSnapshot({ userId: req.userId, planId: plan._id, status: 'pending', paymentProvider: 'paypal' });
      const config = await PayPal.config();
      res.send({ data: { localSubscriptionId: pending._id, paypalPlanId: plan.paypalPlanId, clientId: config.clientId, environment: config.env }, message: Message.SUCCESS });
    } catch (error) { res.status(error.status || 500).send({ data: null, message: error.message || 'Unable to prepare PayPal checkout.' }); }
  },

  verifyPayPal: async (req, res) => {
    try {
      const local = await Subscription.findOne({ _id: req.body.localSubscriptionId, userId: req.userId, status: 'pending', paymentProvider: 'paypal' });
      if (!local) return res.status(404).send({ data: null, message: 'Pending subscription not found.' });
      const remote = await PayPal.getSubscription(req.body.subscriptionId);
      const plan = await Plan.findById(local.planId);
      if (remote.status !== 'ACTIVE' || remote.plan_id !== plan.paypalPlanId) return res.status(400).send({ data: null, message: 'PayPal subscription could not be verified.' });
      await Subscription.updateMany({ userId: req.userId, status: { $in: ['active', 'trial', 'past_due', 'paused'] } }, { $set: { status: 'cancelled', cancelledAt: new Date() } });
      local.status = 'active'; local.externalSubscriptionId = remote.id; local.startDate = new Date(remote.start_time || Date.now()); local.renewalDate = remote.billing_info?.next_billing_time || null; await local.save();
      await PlanService.updateSubscriberCounts();
      res.send({ data: await local.populate('planId'), message: 'Subscription activated.' });
    } catch (error) { res.status(error.status || 500).send({ data: null, message: 'Unable to verify PayPal subscription.' }); }
  },

  cancelPayPal: async (req, res) => {
    try { const sub = await Subscription.findOne({ userId: req.userId, paymentProvider: 'paypal', status: { $in: ['active', 'past_due', 'paused'] } }).sort({ createdAt: -1 }); if (!sub) return res.status(404).send({ data: null, message: 'Active PayPal subscription not found.' }); await PayPal.cancelSubscription(sub.externalSubscriptionId); sub.status = 'cancelled'; sub.cancelledAt = new Date(); await sub.save(); await PlanService.updateSubscriberCounts(); res.send({ data: sub, message: 'Subscription cancelled.' }); } catch { res.status(400).send({ data: null, message: 'Unable to cancel PayPal subscription.' }); }
  },

  paypalWebhook: async (req, res) => {
    try {
      const event = req.body;
      if (!(await PayPal.verifyWebhook(req.headers, event))) return res.status(400).send('Invalid webhook');
      if (await PayPalEvent.exists({ eventId: event.id })) return res.sendStatus(200);
      try { await PayPalEvent.create({ eventId: event.id, eventType: event.event_type }); }
      catch (error) { if (error?.code === 11000) return res.sendStatus(200); throw error; }
      const id = event.resource?.id;
      const sub = await Subscription.findOne({ externalSubscriptionId: id, paymentProvider: 'paypal' });
      if (sub) {
        const status = { 'BILLING.SUBSCRIPTION.ACTIVATED': 'active', 'BILLING.SUBSCRIPTION.SUSPENDED': 'paused', 'BILLING.SUBSCRIPTION.CANCELLED': 'cancelled', 'BILLING.SUBSCRIPTION.EXPIRED': 'expired', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': 'past_due' }[event.event_type];
        if (status) { sub.status = status; if (status === 'cancelled') sub.cancelledAt = new Date(); await sub.save(); await PlanService.updateSubscriberCounts(); }
      }
      if (event.event_type === 'PAYMENT.SALE.COMPLETED') {
        const subscriptionId = event.resource?.billing_agreement_id || event.resource?.subscription_id;
        const paidSubscription = await Subscription.findOne({ externalSubscriptionId: subscriptionId, paymentProvider: 'paypal' });
        if (paidSubscription && event.resource?.id) {
          const amount = Number(event.resource?.amount?.total);
          await Payment.findOneAndUpdate(
            { provider: 'paypal', transactionId: event.resource.id },
            { $setOnInsert: { userId: paidSubscription.userId, subscriptionId: paidSubscription._id, planId: paidSubscription.planId, amount: Number.isFinite(amount) ? amount : 0, currency: event.resource?.amount?.currency || 'USD', provider: 'paypal', transactionId: event.resource.id, status: 'paid', paidAt: new Date(event.create_time || Date.now()), metadata: { paypalEventId: event.id } } },
            { upsert: true, new: true }
          );
        }
      }
      res.sendStatus(200);
    } catch { res.status(400).send('Webhook processing failed'); }
  },
};

module.exports = SubscriptionController;
