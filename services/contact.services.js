const Contact = require('../models/contacts.model');
const ListContact =  require('../models/listContact.model')
const ListService = require('../services/list.services')
const List = require('../models/list.model')
const Message = require('../helpers/constant.message');
const fs = require("fs");
const csv = require("csv-parser");

const ContactService = {
    createRecord: async (userData) => {
        try {
            const record = new Contact(userData);
            await record.save();
            return record;
        } catch (error) {
            throw error;
        }
    },
    findRecordById: async (id) => {
        try {
            return await Contact.findById(id);
        } catch (error) {
            throw error;
        }
    },
    getAllRecord: async (filter,page = 1, limit = 10) => {
        try {
            const countOnly = filter.countOnly;
            delete filter.countOnly;
            if (countOnly) {
                return await Contact.countDocuments(filter);
            }
            return await Contact.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
        } catch (error) {
            throw error;
        }
    },
    updateRecord: async (id, updateData) => {
        try {
            const record = await Contact.findById(id);
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
            const record = await Contact.findById(id);
            if (!record) {
                throw new Error(Message.DATA_NOT_FOUND);
            }
            await Contact.deleteOne({ _id: id });
            return;
        } catch (error) {
            throw error;
        }
    },
    findByQuery: async (query)=>{
        try {
            return await Contact.aggregate(query);
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
    importContacts: async (contacts, userId, list = null) => {
        try {
            // Get emails from CSV
            const emails = contacts.map(contact => contact.email);
            // Find existing contacts for this user
            const existingContacts = await Contact.find({
                userId: userId,
                email: { $in: emails }
            }).select({ _id: 1, email: 1 });

            const existingEmails = new Set(
                existingContacts.map(contact => contact.email)
            );

            // Filter out duplicates
            const newContacts = contacts.filter(contact => !existingEmails.has(contact.email)).map(contact => ({
                ...contact,
                userId: userId
            }));
            if (newContacts.length === 0 && (list != null && existingContacts.length == 0)) {
                return [];
            }
            const insertedContacts = [];
            if(newContacts.length > 0){
                insertedContacts = await Contact.insertMany(newContacts);
            }
            if(list){
                let contacts = insertedContacts.map((contact)=>{
                    return contact._id;
                })
                let existIds = existingContacts.map((c)=>{ return c._id})
                let allContacts = [...contacts,...existIds]
                await ContactService.addContacts(userId,list._id,allContacts,list.contactCount)
            }
            // return insertedContacts
            return true;
        } catch (error) {
            throw error;
        }
    },
    addContacts: async (userId, listId, contacts,prevCount=0) => {
        try {
            const existingContacts = await ListContact.find({
                userId,
                listId,
                contactId: { $in: contacts }
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
    }
};

module.exports = ContactService;