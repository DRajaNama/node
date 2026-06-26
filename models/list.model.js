const mongoose = require('mongoose');

const listSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            trim: true,
            default: ''
        },

        type: {
            type: String,
            enum: ['static', 'dynamic'],
            default: 'static'
        },

        // Optional future feature: smart segmentation
        rules: {
            type: Object,
            default: null
        },

        contactCount: {
            type: Number,
            default: 0
        },

        isArchived: {
            type: Boolean,
            default: false,
            index: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// 🔥 Prevent duplicate list names per user
listSchema.index(
    { userId: 1, name: 1 },
    { unique: true }
);

// 🔥 Fast filtering
listSchema.index({ userId: 1, isArchived: 1 });

module.exports = mongoose.model('List', listSchema);