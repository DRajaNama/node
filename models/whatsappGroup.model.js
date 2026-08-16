const mongoose = require('mongoose');

const WhatsAppGroupSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },

        groupId: {
            type: String,
            required: true
        },

        name: {
            type: String,
            required: true
        },

        description: {
            type: String,
            default: null
        },

        memberCount: {
            type: Number,
            default: 0
        },

        isGroup: {
            type: Boolean,
            default: true
        },

        lastSyncedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

WhatsAppGroupSchema.index(
    {
        userId: 1,
        groupId: 1
    },
    {
        unique: true
    }
);

module.exports = mongoose.model(
    'WhatsAppGroup',
    WhatsAppGroupSchema
);