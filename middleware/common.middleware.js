const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');

const validatePayload = (req, res, next) => {
    const data = req.body;
    // check data is empty or not
    if (!data || Object.keys(data).length === 0) {
        logger.error(Message.EMPTY_FIELD);
        return res.status(400).json({ error: Message.EMPTY_FIELD });
    }
    next();
};

module.exports = {
    validatePayload
};