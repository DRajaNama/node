
const Message = require('../helpers/constant.message');
const JWTService = require('../services/jwt.service');

const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ message: Message.NO_TOKEN_PROVIDED });
    }
    try {
        const decoded = JWTService.verify(token);
        req.userId = decoded.id;
        next();
    } catch (error) {
        console.log('Token verification error:', error);
        return res.status(401).json({ data:null, message: Message.FAILED_TO_AUTHENTICATE_TOKEN });
    }
};

module.exports = authMiddleware;