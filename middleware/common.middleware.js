const Message = require("../helpers/constant.message");
const logger = require("../helpers/logging");

const validatePayload = (req, res, next) => {
    console.log('req',req)
    const body = req.body || {};
    const file = req.file;
    const files = req.files;

    const hasBody =
        Object.keys(body).length > 0;

    const hasSingleFile =
        !!file;

    const hasMultipleFiles =
        Array.isArray(files) &&
        files.length > 0;

    const hasFields =
        hasBody ||
        hasSingleFile ||
        hasMultipleFiles;

    if (!hasFields) {
        logger.error(Message.EMPTY_FIELD);

        return res.status(400).json({
            error: Message.EMPTY_FIELD
        });
    }

    next();
};

module.exports = {
    validatePayload
};