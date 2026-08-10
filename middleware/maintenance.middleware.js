const SystemSettings = require('../models/systemSettings.model');
const Message = require('../helpers/constant.message');

const PUBLIC_MAINTENANCE_PATHS = [
  '/public/maintenance-status',
  '/public/site-settings',
  '/public/theme',
];

const maintenanceMiddleware = async (req, res, next) => {
  try {
    const path = req.path || '';
    if (PUBLIC_MAINTENANCE_PATHS.some((p) => path.startsWith(p))) {
      return next();
    }
    const settings = await SystemSettings.findOne({ key: 'global' });
    if (!settings?.security?.maintenanceMode) {
      return next();
    }
    if (
      path.startsWith('/admin') ||
      path === '/login' ||
      path === '/register' ||
      path === '/me'
    ) {
      return next();
    }
    return res.status(503).send({
      data: { maintenanceMode: true },
      message: 'Service is under maintenance',
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = maintenanceMiddleware;
