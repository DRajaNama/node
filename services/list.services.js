const List = require('../models/list.model');
const ListContact = require('../models/listContact.model');
const Contact = require('../models/contacts.model');
const Message = require('../helpers/constant.message');
const fs = require("fs");
const csv = require("csv-parser");
const { ObjectId } = require('mongodb');

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
    addContacts: async (userId, listId, contacts,prevCount=0) => {
        try {

            const contactIds = contacts.map(c => c.contactId);

            const existingContacts = await ListContact.find({
                userId,
                listId,
                contactId: { $in: contactIds }
            }).select("contactId");

            const existingContactIds = new Set(
                existingContacts.map(c => c.contactId.toString())
            );

            const newContacts = contacts
                .filter(c => !existingContactIds.has(c))
                .map(c => ({
                    userId,
                    listId,
                    contactId: c
                }));

            if (newContacts.length === 0) {
                return [];
            }
            
            return Promise.all([await ListContact.insertMany(newContacts),await ListService.updateContactCount(listId,newContacts.length,prevCount)]);

        } catch (error) {
            throw error;
        }
    },
    removeContacts: async (userId, listId, contacts,prevCount=0) => {
        try {
            let filter = {
                userId: new ObjectId(userId),
                listId: new ObjectId(listId),
                _id: {
                    $in: contacts.map(c => new ObjectId(c))
                }
            }
            let result = Promise.all([await ListContact.deleteMany(filter),await ListService.updateContactCount(listId,0,prevCount-contacts.length)]);
            return result;
        } catch (error) {
            throw error;
        }
    },
    updateContactCount: async (listId, contactCount,prevCount=0) => {
        try {
            const record = await List.findById(listId);
            if (!record) {
                throw new Error(Message.DATA_NOT_FOUND);
            }
            const updatedRecord = await List.findByIdAndUpdate(
                listId,
                { contactCount: prevCount+contactCount },
                { new: true }
            );
            return updatedRecord;
        } catch (error) {
            throw error;
        }
    },
    getAllListContect: async (filter,page = 1, limit = 10) => {
        try {
            const countOnly = filter.countOnly;
            delete filter.countOnly;
            if (countOnly) {
                return await ListContact.countDocuments(filter);
            }
            return await ListContact.find(filter)
                .populate('contactId')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);
        } catch (error) {
            throw error;
        }
    },
};

module.exports = ListService;