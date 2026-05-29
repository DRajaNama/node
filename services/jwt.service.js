const JWT = require('jsonwebtoken');

const JWTService = {
    sign: (payload) => {
        return JWT.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    },
    verify: (token) => {
        return JWT.verify(token, process.env.JWT_SECRET);
    }   
}

module.exports = JWTService;