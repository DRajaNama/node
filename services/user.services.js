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
    },
    getAllUsers: async (filter,page = 1, limit = 10) => {
        try {
            const countOnly = filter.countOnly;
            delete filter.countOnly;
            if (countOnly) {
                return await User.countDocuments(filter);
            }
            return await User.find(filter).skip((page - 1) * limit).limit(limit);
        } catch (error) {
            throw error;
        }
    },
    updateUser: async (id, updateData) => {
        try {
            const user = await User.findById(id);
            if (!user) {
                throw new Error(Message.USER_NOT_FOUND);
            }
            Object.assign(user, updateData);
            await user.save();
            return user;
        } catch (error) {
            throw error;
        }
    },
    deleteUser: async (id) => {
        try {
            const user = await User.findById(id);
            if (!user) {
                throw new Error(Message.USER_NOT_FOUND);
            }
            await User.deleteOne({ _id: id });
            return;
        } catch (error) {
            throw error;
        }
    },

};

module.exports = UserService;