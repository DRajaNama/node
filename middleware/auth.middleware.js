
const Message = require('../helpers/constant.message');
const JWTService = require('../services/jwt.service');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ message: Message.NO_TOKEN_PROVIDED });
    }
    try {
        // Extract token from "Bearer <token>" format
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        const decoded = JWTService.verify(token);
        req.userId = decoded.id;
        next();
    } catch (error) {
        console.log('Token verification error:', error);
        return res.status(401).json({ data:null, message: Message.FAILED_TO_AUTHENTICATE });
    }
};

module.exports = authMiddleware;