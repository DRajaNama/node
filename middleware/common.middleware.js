const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');

const validatePayload = (req, res, next) => {
    const body = req.body;
    const file = req.file;

    // check everything is empty (body + file)
    const isBodyEmpty = !body || Object.keys(body).length === 0;
    const isFileMissing = !file;

    if (isBodyEmpty && isFileMissing) {
        logger.error(Message.EMPTY_FIELD);
        return res.status(400).json({ error: Message.EMPTY_FIELD }); // {"error":"Field cannot be empty"}
    }

    next();
};

module.exports = {
    validatePayload
};