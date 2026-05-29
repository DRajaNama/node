const User = require('../models/user.model');
const Message = require('../helpers/constant.message');

const UserService = {
    createUser: async (userData) => {
        try {
            const user = new User(userData);
            await user.save();
            return user;
        } catch (error) {
            throw error;
        }
    },
    findUserByEmail: async (email) => {
        try {
            return await User.findOne({ email });
        } catch (error) {
            throw error;
        }
    },
    findUserById: async (id) => {
        try {
            return await User.findById(id);
        } catch (error) {
            throw error;
        }
    },
    verifyPassword: async (user, password) => {
        try {
            if (!user || typeof user.comparePassword !== 'function') {
                throw new Error(Message.INVALID_USER_OBJECT);
            }
            return await user.comparePassword(password);
        } catch (error) {
            throw error;
        }
    }

};

module.exports = UserService;