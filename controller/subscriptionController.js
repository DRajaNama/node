const SubscriptionService = require('../services/subscription.services');
const PlanService = require('../services/plan.services');
const Message = require('../helpers/constant.message');

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
};

const Payment = require('../models/payment.model');
module.exports = SubscriptionController;
