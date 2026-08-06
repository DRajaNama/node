const Settings = require("../models/settings.model");

const SettingsService = {

    findByUserId: async (userId) => {
        return await Settings.findOne({
            userId: userId
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

};

module.exports = SettingsService;