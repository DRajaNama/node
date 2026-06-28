const { listCreateValidation, listAddContactsValidation } = require('../validations/list.validations');
const ListService = require('../services/list.services')
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const { ObjectId } = require('mongodb');

const ListController = {
    create: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.LIST_CONTROLLER+Message.CREATE_ATTEMPT,req.body);
        try {
            const { errors, isValid } = listCreateValidation(req.body);
            if (!isValid) {
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.CREATE_ATTEMPT, errors);
                return res.status(400).send({ errors });
            }
            req.body.userId = req.userId;
            const query = [{
                $match: {
                name: req.body.name,
                userId: new ObjectId(req.userId)
                }
            }];
            const isExist = await ListService.findByQuery(query)
            if(isExist.length > 0){
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.DUPLICATE_RECORD+Message.CREATE_ATTEMPT, {});
                return res.status(400).send({ data: null, message: Message.DUPLICATE_RECORD });
            }
            const record = await ListService.createRecord(req.body);
            logger.info(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.CREATE_ATTEMPT+Message.SUCCESS, { userId: record._id });
            res.send({ data: record, message: Message.RECODE_CREATED });
        } catch (error) {
            if (error.code === 11000) {
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.CREATE_ATTEMPT, req.body.email);
                return res.status(400).send({data: null, message: Message.EMAIL_ALREADY_EXISTS });
            }
            logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.CREATE_ATTEMPT, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR });
        }
    },
    get: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.LIST_CONTROLLER+Message.FETCHING_RECORD, { userId: req.userId });
        try {
            if(!req.params.id){
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.FETCHING_USER_INFO, { error: Message.ID_IS_REQUIRED });
                return res.status(400).send({data: null, message: Message.ID_IS_REQUIRED});
            }
            const record = await ListService.findRecordById(req.params.id);
            if (!record) {
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.FETCHING_USER_INFO, { userId: req.userId });
                return res.status(404).send({data: null, message: Message.USER_NOT_FOUND});
            }
            logger.info(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.FETCHING_USER_INFO+Message.SUCCESS, { userId: req.userId });
            res.send({ data: { record }, message: Message.USER_FOUND });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.FETCHING_USER_INFO, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }  
    },
    delete: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.LIST_CONTROLLER+Message.DELETE_RECORD_ATTEMPT, { userId: req.params.id });
        try {
            if(!req.params.id){
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.DELETE_RECORD_ATTEMPT, { error: Message.ID_IS_REQUIRED });
                return res.status(400).send({data: null, message: Message.ID_IS_REQUIRED});
            }
            const query = [{
                $match: {
                _id: new ObjectId(req.params.id),
                userId: new ObjectId(req.userId)
                }
            }];
            const record = await ListService.findByQuery(query);
            if (!record) {
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.DELETE_RECORD_ATTEMPT, { userId: req.params.id, query });
                return res.status(404).send({data: null, message: Message.DATA_NOT_FOUND});
            }
            await ListService.deleteRecord(new ObjectId(record[0]._id));
            logger.info(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.DELETE_RECORD_ATTEMPT+Message.SUCCESS, { userId: req.params.id });
            res.send({ data: null, message: Message.USER_DELETED });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.DELETE_RECORD_ATTEMPT, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }
    },
    update: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.LIST_CONTROLLER+Message.UPDATE_RECORD_ATTEMPT, { userId: req.params.id });
        try {
            if(!req.params.id){
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.UPDATE_RECORD_ATTEMPT, { error: Message.ID_IS_REQUIRED });
                return res.status(400).send({data: null, message: Message.ID_IS_REQUIRED});
            }
            const record = await ListService.updateRecord(req.params.id, req.body);
            logger.info(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.UPDATE_RECORD_ATTEMPT+Message.SUCCESS, { userId: req.params.id });
            res.send({ data: record, message: Message.RECORD_UPDATED });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.UPDATE_RECORD_ATTEMPT, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }
    },
    getAll: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.LIST_CONTROLLER+Message.GET_ALL_RECORD_ATTEMPT);
        try {
            let filter = {};
            if (req.query.search) {
               filter = {
                    $or: [
                        { firstName: { $regex: req.query.search, $options: 'i' } },
                        { lastName: { $regex: req.query.search, $options: 'i' } },
                        { email: { $regex: req.query.search, $options: 'i' } },
                        { mobile: { $regex: req.query.search, $options: 'i' } }
                    ]
                }
            }
            const data = await ListService.getAllRecord(filter, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 10);
            const totalUsers = await ListService.getAllRecord({ ...filter, countOnly: true });
            logger.info(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.GET_ALL_RECORD_ATTEMPT+Message.SUCCESS);
            res.send({ data: data, message: Message.SUCCESS, meta: { page: parseInt(req.query.page) || 1, limit: parseInt(req.query.limit) || 10, total: totalUsers } });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.GET_ALL_RECORD_ATTEMPT+Message.ERROR_IN, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }
    },
    addContacts: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.LIST_CONTROLLER+Message.ADD_LIST_CONTACTS,req.body);
        try {
            const { errors, isValid } = listAddContactsValidation(req.body);
            if (!isValid) {
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.ADD_LIST_CONTACTS, errors);
                return res.status(400).send({ errors });
            }
            const query = [{
                $match: {
                _id: new ObjectId(req.body.id),
                userId: new ObjectId(req.userId)
                }
            }];
            const list = await ListService.findByQuery(query)
            if(list.length == 0){
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.DATA_NOT_FOUND+Message.ADD_LIST_CONTACTS, {});
                return res.status(400).send({ data: null, message: Message.DATA_NOT_FOUND });
            }
            let counts = list[0].contactCount || 0;
            const record = await ListService.addContacts(req.userId,req.body.id,req.body.contactsId,counts);
            logger.info(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ADD_LIST_CONTACTS+Message.SUCCESS, { userId: record._id });
            res.send({ data: record, message: Message.RECODE_CREATED });
        } catch (error) {
            if (error.code === 11000) {
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.ADD_LIST_CONTACTS, req.body.email);
                return res.status(400).send({data: null, message: Message.EMAIL_ALREADY_EXISTS });
            }
            logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.ADD_LIST_CONTACTS, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR });
        }
    },
    importContact: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.LIST_CONTROLLER+Message.UPLOAD_FILE, { userId: req.userId });
        try {
            if (!req.file) {
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.UPLOAD_FILE, {error: Message.UPLOAD_FILE + ' ' + Message.IS_REQUIRED });
                return res.status(400).send({
                    data: null,
                    message: Message.UPLOAD_FILE + ' ' + Message.IS_REQUIRED
                });
            }
            // Parse CSV
            const contacts = await ListService.parseCSV(req.file.path);
            // Save into database
            const record = await ListService.importContacts(contacts,req.userId);
            logger.info(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.UPLOAD_FILE+Message.SUCCESS, { userId: req.userId });
            return res.send({ data: record,  message: Message.UPLOADED_CONTACT_SUCCESS });
        } catch (error) {
            logger.error( Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.UPLOAD_FILE, error );
            return res.status(500).send({ data: null, message: Message.SERVER_ERROR });
        }
    },
    removeContacts: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.LIST_CONTROLLER+Message.REMOVE_LIST_CONTACTS,req.body);
        try {
            const { errors, isValid } = listAddContactsValidation(req.body);
            if (!isValid) {
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.REMOVE_LIST_CONTACTS, errors);
                return res.status(400).send({ errors });
            }
            const query = [{
                $match: {
                _id: new ObjectId(req.body.id),
                userId: new ObjectId(req.userId)
                }
            }];
            const list = await ListService.findByQuery(query)
            if(list.length == 0){
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.DATA_NOT_FOUND+Message.REMOVE_LIST_CONTACTS, {});
                return res.status(400).send({ data: null, message: Message.DATA_NOT_FOUND });
            }
            let counts = list[0].contactCount || 0;
            const record = await ListService.removeContacts(req.userId,req.body.id,req.body.contactsId,counts);
            logger.info(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.REMOVE_LIST_CONTACTS+Message.SUCCESS, { userId: record._id });
            res.send({ data: record, message: Message.RECODE_CREATED });
        } catch (error) {
            if (error.code === 11000) {
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.REMOVE_LIST_CONTACTS, req.body.email);
                return res.status(400).send({data: null, message: Message.EMAIL_ALREADY_EXISTS });
            }
            logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.REMOVE_LIST_CONTACTS, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR });
        }
    },
    listContects: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.LIST_CONTROLLER+Message.GET_ALL_RECORD_ATTEMPT);
        try {
            if(!req.params.id){
                logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.ERROR_IN+Message.GET_ALL_RECORD_ATTEMPT, { error: Message.ID_IS_REQUIRED });
                return res.status(400).send({data: null, message: Message.ID_IS_REQUIRED});
            }
            let filter = {};
            let id = req.params.id;
            if (req.query.search) {
               filter = {
                    $or: [
                        { firstName: { $regex: req.query.search, $options: 'i' } },
                        { lastName: { $regex: req.query.search, $options: 'i' } },
                        { email: { $regex: req.query.search, $options: 'i' } },
                        { mobile: { $regex: req.query.search, $options: 'i' } }
                    ]
                }
            }
            const data = await ListService.getAllListContect(filter, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 10);
            const totalUsers = await ListService.getAllListContect({ ...filter, countOnly: true });
            logger.info(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.GET_ALL_RECORD_ATTEMPT+Message.SUCCESS);
            res.send({ data: data, message: Message.SUCCESS, meta: { page: parseInt(req.query.page) || 1, limit: parseInt(req.query.limit) || 10, total: totalUsers } });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.LIST_CONTROLLER+Message.GET_ALL_RECORD_ATTEMPT+Message.ERROR_IN, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }
    },
};

module.exports = ListController;