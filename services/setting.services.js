const Settings = require("../models/settings.model");

const SettingsService = {

    findByUserId: async (userId) => {
        return await Settings.findOne({
            user: userId
        }).select("+smtp.password");
    },

    createRecord: async (data) => {
        return await Settings.create(data);
    },

    updateRecord: async (id, data) => {
        return await Settings.findByIdAndUpdate(
            id,
            {
                $set: data
            },
            {
                new: true,
                runValidators: true
            }
        );
    },

    deleteRecord: async (id) => {
        return await Settings.findByIdAndDelete(id);
    },

    findByQuery: async (query)=>{
        try {
            return await Settings.aggregate(query);
        } catch (error) {
            throw error;
        }
    },

    getUserSMTP: async (query) => {
        try {
            console.log('query', query);

            const settings = await Settings.aggregate(query);

            if (!settings.length) {
                throw new Error("SMTP settings not found");
            }

            return settings[0].smtp;
        } catch (error) {
            console.log('error on get User SMTP', error);
            throw error;
        }
    }


};

module.exports = SettingsService;