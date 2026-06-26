const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
        name: { type: String, required: true, trim: true },
        mobile: { 
            type: String, 
            required: true, 
            trim: true,
            index: true
        },
        email: { 
            type: String, 
            required: true, 
            unique: true, 
            lowercase: true,
            trim: true,
            index: true
        },
        password: { 
            type: String, 
            required: true, 
            minlength: 6,
            select: false
        },
        role: { 
            type: String, 
            enum: ['user', 'admin'], 
            default: 'user'
        },
        isVerified: { 
            type: Boolean, 
            default: false 
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }   
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }   
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};


module.exports = mongoose.model('User', userSchema);