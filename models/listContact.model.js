const mongoose = require('mongoose');

const listContactSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },

        listId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'List',
            required: true,
            index: true
        },

        contactId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Contact',
            required: true,
            index: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// 🔥 Prevent duplicate contact in same list
listContactSchema.index(
    { listId: 1, contactId: 1 },
    { unique: true }
);

// 🔥 Fast queries
listContactSchema.index({ userId: 1, listId: 1 });
listContactSchema.index({ userId: 1, contactId: 1 });

module.exports = mongoose.model('ListContact', listContactSchema);