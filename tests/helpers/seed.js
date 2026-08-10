const User = require('../../models/user.model');
const Plan = require('../../models/plan.model');
const SubscriptionService = require('../../services/subscription.services');
const JWTService = require('../../services/jwt.service');
const { PERMISSIONS } = require('../../config/permissions');

async function createUser({ name, email, mobile, role, permissions = [] }) {
  return User.create({
    name,
    email,
    mobile,
    password: 'password123',
    role,
    permissions,
  });
}

async function seedUsers() {
  const superAdmin = await createUser({
    name: 'Super Admin',
    email: 'super@test.com',
    mobile: '9000000001',
    role: 'super_admin',
  });
  const admin = await createUser({
    name: 'Admin User',
    email: 'admin@test.com',
    mobile: '9000000002',
    role: 'admin',
    permissions: [PERMISSIONS.PLANS_MANAGE, PERMISSIONS.SETTINGS_MANAGE],
  });
  const customer = await createUser({
    name: 'Customer',
    email: 'customer@test.com',
    mobile: '9000000003',
    role: 'user',
  });
  return { superAdmin, admin, customer };
}

async function seedLimitedContactPlan(limit = 2) {
  const entitlements = [
    { key: 'contacts', type: 'limit', enabled: true, limit, isUnlimited: false },
    { key: 'lists', type: 'limit', enabled: true, limit: 10, isUnlimited: false },
  ];

  const plan = await Plan.create({
    name: 'Test Limited',
    slug: `test-limited-${Date.now()}`,
    description: 'Test plan',
    monthlyPrice: 0,
    yearlyPrice: 0,
    status: 'active',
    isPublic: true,
    displayOrder: 99,
    entitlements,
    version: 1,
  });

  return plan;
}

async function assignPlan(userId, planId) {
  return SubscriptionService.assignPlanToUser(userId, planId, 'active');
}

function signToken(user) {
  return JWTService.sign({ id: user._id });
}

module.exports = {
  createUser,
  seedUsers,
  seedLimitedContactPlan,
  assignPlan,
  signToken,
};
