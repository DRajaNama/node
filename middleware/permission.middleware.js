const UserService = require('../services/user.services');
const { hasPermission } = require('../config/permissionsRuntime');

const permissionMiddleware = (requiredPermission) => async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ data: null, message: 'No token provided' });
    }
    const user = await UserService.findUserById(req.userId);
    if (!user || user.isActive === false) {
      return res.status(403).json({ data: null, message: 'Access denied' });
    }
    if (!hasPermission(user.role, user.permissions, requiredPermission)) {
      return res.status(403).json({ data: null, message: 'Permission denied' });
    }
    req.permissionUser = user;
    // Kept for existing admin handlers that may rely on this middleware context.
    if (['admin', 'super_admin'].includes(user.role)) req.adminUser = user;
    next();
  } catch (error) {
    return res.status(500).json({ data: null, message: 'Server error' });
  }
};

module.exports = permissionMiddleware;
