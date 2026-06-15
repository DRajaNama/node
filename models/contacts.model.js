const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String,},
    email:{ type: String, required: true  },
    mobile:{ type:String },
    address:{type:String}
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('Contact', contactSchema);