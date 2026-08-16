const mongoose = require('mongoose');

const WhatsAppSessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true
        },

        status: {
            type: String,
            enum: [
                'disconnected',
                'connecting',
                'qr',
                'authenticated',
                'ready',
                'auth_failure'
            ],
            default: 'disconnected'
        },

        phoneNumber: {
            type: String,
            default: null
        },

        name: {
            type: String,
            default: null
        },

        qrCode: {
            type: String,
            default: null
        },

        lastConnectedAt: {
            type: Date,
            default: null
        },

        lastDisconnectedAt: {
            type: Date,
            default: null
        },

        authFailureReason: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    'WhatsAppSession',
    WhatsAppSessionSchema
);