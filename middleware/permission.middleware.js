const UserService = require('../services/user.services');
const { hasPermission } = require('../config/permissions');

const permissionMiddleware = (requiredPermission) => async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ data: null, message: 'No token provided' });
    }
    const user = await UserService.findUserById(req.userId);
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ data: null, message: 'Admin access required' });
    }
    if (!hasPermission(user.role, user.permissions, requiredPermission)) {
      return res.status(403).json({ data: null, message: 'Permission denied' });
    }
    req.adminUser = user;
    next();
  } catch (error) {
    return res.status(500).json({ data: null, message: 'Server error' });
  }
};

module.exports = permissionMiddleware;
