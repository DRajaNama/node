const Message = require('../helpers/constant.message');
const UserService = require('../services/user.services');

const adminMiddleware = async (req, res, next) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ data: null, message: Message.NO_TOKEN_PROVIDED });
        }
        const user = await UserService.findUserById(req.userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ data: null, message: Message.ADMIN_ONLY });
        }
        next();
    } catch (error) {
        return res.status(500).json({ data: null, message: Message.SERVER_ERROR });
    }
};

module.exports = adminMiddleware;
