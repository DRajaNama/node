const mongoose = require('mongoose');
require('dotenv').config();
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        logger.info(Message.MONGODB_CONNECTED);
    } catch (err) {
        logger.error(Message.MONGODB_CONNECTION_ERROR, err);
        process.exit(1);
    }   
};

module.exports = connectDB;