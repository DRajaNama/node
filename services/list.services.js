const List = require('../models/list.model');
const Message = require('../helpers/constant.message');
const fs = require("fs");
const csv = require("csv-parser");

const ListService = {
    createRecord: async (userData) => {
        try {
            const record = new List(userData);
            await record.save();
            return record;
        } catch (error) {
            throw error;
        }
    },
    findRecordById: async (id) => {
        try {
            return await List.findById(id);
        } catch (error) {
            throw error;
        }
    },
    getAllRecord: async (filter,page = 1, limit = 10) => {
        try {
            const countOnly = filter.countOnly;
            delete filter.countOnly;
            if (countOnly) {
                return await List.countDocuments(filter);
            }
            return await List.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
        } catch (error) {
            throw error;
        }
    },
    updateRecord: async (id, updateData) => {
        try {
            const record = await List.findById(id);
            if (!record) {
                throw new Error(Message.USER_NOT_FOUND);
            }
            Object.assign(record, updateData);
            await record.save();
            return record;
        } catch (error) {
            throw error;
        }
    },
    deleteRecord: async (id) => {
        try {
            const record = await List.findById(id);
            if (!record) {
                throw new Error(Message.DATA_NOT_FOUND);
            }
            await List.deleteOne({ _id: id });
            return;
        } catch (error) {
            throw error;
        }
    },
    findByQuery: async (query)=>{
        try {
            return await List.aggregate(query);
        } catch (error) {
            throw error;
        }
    },
    parseCSV: (filePath) => {
        return new Promise((resolve, reject) => {
            const contacts = [];
            fs.createReadStream(filePath)
                .pipe(csv())
                .on("data", (row) => {
                    contacts.push(row);
                })
                .on("end", () => {
                    fs.unlinkSync(filePath); // Delete uploaded file
                    resolve(contacts);
                })
                .on("error", (error) => {
                    reject(error);
                });
        });
    },
    importContacts: async (contacts, userId) => {
        try {
            // Get emails from CSV
            const emails = contacts.map(List => List.email);
            // Find existing contacts for this user
            const existingContacts = await List.find({
                userId: userId,
                email: { $in: emails }
            }).select("email");

            const existingEmails = new Set(
                existingContacts.map(List => List.email)
            );

            // Filter out duplicates
            const newContacts = contacts.filter(List => !existingEmails.has(List.email)).map(List => ({
                ...List,
                userId: userId
            }));
            if (newContacts.length === 0) {
                return [];
            }
            return await List.insertMany(newContacts);
        } catch (error) {
            throw error;
        }
    },
};

module.exports = ListService;