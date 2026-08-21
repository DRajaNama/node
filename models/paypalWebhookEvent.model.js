const mongoose = require('mongoose');
const schema = new mongoose.Schema({ eventId: { type: String, unique: true, required: true }, eventType: String, receivedAt: { type: Date, default: Date.now } }, { versionKey: false });
module.exports = mongoose.model('PayPalWebhookEvent', schema);
