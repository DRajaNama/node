const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
    {
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User', 
            required: true,
            index: true
        },

        firstName: { type: String, trim: true },
        lastName: { type: String, trim: true },

        email: { 
            type: String, 
            required: true, 
            lowercase: true,
            trim: true
        },

        mobile: { 
            type: String, 
            trim: true 
        },

        status: { 
            type: String, 
            enum: ['active', 'inactive', 'bounced', 'unsubscribed'],
            default: 'active',
            index: true
        },

        address: { type: String },

        tags: [{ type: String }],

        isUnsubscribed: { 
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

// 🔥 Prevent duplicate contacts per user
contactSchema.index(
    { userId: 1, email: 1 },
    { unique: true }
);

module.exports = mongoose.model('Contact', contactSchema);