const SystemSettings = require('../models/systemSettings.model');
const {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  PERMISSIONS,
} = require('./permissions');

let runtimeRolePermissions = {
  user: [...(ROLE_PERMISSIONS.user || [])],
  admin: [...(ROLE_PERMISSIONS.admin || [])],
};

const refreshRolePermissionsFromDb = async () => {
  const settings = await SystemSettings.findOne({ key: 'global' });
  const stored = settings?.rolePermissions || {};
  runtimeRolePermissions = {
    user: stored.user?.length ? [...stored.user] : [...(ROLE_PERMISSIONS.user || [])],
    admin: stored.admin?.length ? [...stored.admin] : [...(ROLE_PERMISSIONS.admin || [])],
  };
};

const getRuntimeRolePermissions = () => ({ ...runtimeRolePermissions });

const getEffectivePermissions = (role, customPermissions = []) => {
  const base =
    role === 'super_admin'
      ? ALL_PERMISSIONS
      : runtimeRolePermissions[role] || ROLE_PERMISSIONS[role] || [];
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

const updateRolePermissions = async (role, permissions) => {
  if (!ROLE_PERMISSIONS[role] || role === 'super_admin') {
    throw new Error('Cannot modify this role');
  }
  const valid = (permissions || []).filter((p) => ALL_PERMISSIONS.includes(p));
  const settings = await SystemSettings.findOne({ key: 'global' });
  const stored = settings?.rolePermissions || {};
  const updated = {
    user: stored.user || [],
    admin: stored.admin || [],
    [role]: valid,
  };
  await SystemSettings.findOneAndUpdate(
    { key: 'global' },
    { $set: { rolePermissions: updated } },
    { upsert: true }
  );
  await refreshRolePermissionsFromDb();
  return { role, permissions: runtimeRolePermissions[role] };
};

const getStoredRolePermissions = async () => {
  const settings = await SystemSettings.findOne({ key: 'global' });
  return settings?.rolePermissions || {};
};

module.exports = {
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  getEffectivePermissions,
  hasPermission,
  refreshRolePermissionsFromDb,
  getRuntimeRolePermissions,
  updateRolePermissions,
};
