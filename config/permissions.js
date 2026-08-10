const PERMISSIONS = {
  USERS_VIEW: 'Users.View',
  USERS_CREATE: 'Users.Create',
  USERS_EDIT: 'Users.Edit',
  USERS_DELETE: 'Users.Delete',
  ROLES_VIEW: 'Roles.View',
  ROLES_MANAGE: 'Roles.Manage',
  PLANS_VIEW: 'Plans.View',
  PLANS_MANAGE: 'Plans.Manage',
  SUBSCRIPTIONS_VIEW: 'Subscriptions.View',
  SUBSCRIPTIONS_MANAGE: 'Subscriptions.Manage',
  PAYMENTS_VIEW: 'Payments.View',
  PAYMENTS_MANAGE: 'Payments.Manage',
  MARKETING_VIEW: 'Marketing.View',
  MARKETING_MANAGE: 'Marketing.Manage',
  BLOGS_VIEW: 'Blogs.View',
  BLOGS_MANAGE: 'Blogs.Manage',
  BLOGS_PUBLISH: 'Blogs.Publish',
  SETTINGS_VIEW: 'Settings.View',
  SETTINGS_MANAGE: 'Settings.Manage',
  ANALYTICS_VIEW: 'Analytics.View',
  LOGS_VIEW: 'Logs.View',
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

const ROLE_PERMISSIONS = {
  user: [],
  admin: [
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_EDIT,
    PERMISSIONS.PLANS_VIEW,
    PERMISSIONS.SUBSCRIPTIONS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.MARKETING_VIEW,
    PERMISSIONS.MARKETING_MANAGE,
    PERMISSIONS.BLOGS_VIEW,
    PERMISSIONS.BLOGS_MANAGE,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.LOGS_VIEW,
  ],
  super_admin: ALL_PERMISSIONS,
};

const getEffectivePermissions = (role, customPermissions = []) => {
  const base = ROLE_PERMISSIONS[role] || [];
  const merged = new Set([...base, ...(customPermissions || [])]);
  if (role === 'super_admin') {
    ALL_PERMISSIONS.forEach((p) => merged.add(p));
  }
  return Array.from(merged);
};

const hasPermission = (role, customPermissions, required) => {
  if (role === 'super_admin') return true;
  const effective = getEffectivePermissions(role, customPermissions);
  return effective.includes(required);
};

module.exports = {
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  getEffectivePermissions,
  hasPermission,
};
