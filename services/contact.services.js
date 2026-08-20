const Contact = require('../models/contacts.model');
const ListContact =  require('../models/listContact.model')
const ListService = require('../services/list.services')
const List = require('../models/list.model')
const Message = require('../helpers/constant.message');
const fs = require("fs");
const csv = require("csv-parser");

const IMPORT_BATCH_SIZE = 1000;
const CONTACT_STATUSES = new Set(['active', 'inactive', 'bounced', 'unsubscribed']);

const normaliseContact = (row) => {
    const email = String(row.email || '').trim().toLowerCase();
    const status = String(row.status || '').trim();
    if (!email) return null;

    return {
        email,
        firstName: row.firstName == null ? undefined : String(row.firstName).trim(),
        lastName: row.lastName == null ? undefined : String(row.lastName).trim(),
        mobile: row.mobile == null ? undefined : String(row.mobile).trim(),
        address: row.address == null ? undefined : String(row.address).trim(),
        status: CONTACT_STATUSES.has(status) ? status : undefined,
    };
};

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
    // Counts CSV rows without retaining them. This preserves the existing
    // entitlement check while keeping memory bounded for multi-million imports.
    countCSVRows: async (filePath) => {
        let count = 0;
        const parser = fs.createReadStream(filePath).pipe(csv({
            mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim()
        }));
        for await (const _row of parser) count += 1;
        return count;
    },
    importCSV: async (filePath, userId, list = null) => {
        const summary = { processed: 0, inserted: 0, existing: 0, invalid: 0, duplicatesInFile: 0, addedToList: 0 };
        const processBatch = async (rows) => {
            const contactsByEmail = new Map();
            for (const row of rows) {
                summary.processed += 1;
                const contact = normaliseContact(row);
                if (!contact) {
                    summary.invalid += 1;
                    continue;
                }
                if (contactsByEmail.has(contact.email)) {
                    summary.duplicatesInFile += 1;
                    continue;
                }
                contactsByEmail.set(contact.email, contact);
            }

            const contacts = [...contactsByEmail.values()];
            if (!contacts.length) return;

            // $setOnInsert plus the unique { userId, email } index makes this
            // idempotent and avoids loading existing contacts into application memory.
            const result = await Contact.bulkWrite(
                contacts.map((contact) => ({
                    updateOne: {
                        filter: { userId, email: contact.email },
                        update: { $setOnInsert: { ...contact, userId } },
                        upsert: true,
                    }
                })),
                { ordered: false }
            );
            summary.inserted += result.upsertedCount || 0;
            summary.existing += result.matchedCount || 0;

            if (!list) return;

            const persisted = await Contact.find(
                { userId, email: { $in: contacts.map((contact) => contact.email) } },
                { _id: 1 }
            ).lean();
            if (!persisted.length) return;

            const listResult = await ListContact.bulkWrite(
                persisted.map((contact) => ({
                    updateOne: {
                        filter: { userId, listId: list._id, contactId: contact._id },
                        update: { $setOnInsert: { userId, listId: list._id, contactId: contact._id } },
                        upsert: true,
                    }
                })),
                { ordered: false }
            );
            const added = listResult.upsertedCount || 0;
            summary.addedToList += added;
            if (added) {
                await List.updateOne({ _id: list._id, userId }, { $inc: { contactCount: added } });
            }
        };

        const parser = fs.createReadStream(filePath).pipe(csv({
            mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim()
        }));
        let batch = [];
        for await (const row of parser) {
            batch.push(row);
            if (batch.length === IMPORT_BATCH_SIZE) {
                await processBatch(batch);
                batch = [];
            }
        }
        if (batch.length) await processBatch(batch);
        return summary;
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