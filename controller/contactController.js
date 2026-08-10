const { contactCreateValidation } = require('../validations/contact.validations');
const ContactService = require('../services/contact.services')
const ListService = require('../services/list.services')
const EntitlementService = require('../services/entitlement.services');
const { handleQuotaError } = require('../middleware/quota.middleware');
const QuotaExceededError = require('../helpers/quotaError');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const { ObjectId } = require('mongodb');

const ContactController = {
    create: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.CONTACT_CONTROLLER+Message.CREATE_ATTEMPT,req.body);
        try {
            const { errors, isValid } = contactCreateValidation(req.body);
            if (!isValid) {
                logger.error(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.ERROR_IN+Message.CREATE_ATTEMPT, errors);
                return res.status(400).send({ errors });
            }
            req.body.userId = req.userId;
            const query = [{
                $match: {
                email: req.body.email,
                userId: new ObjectId(req.userId)
                }
            }];
            const isExist = await ContactService.findByQuery(query)
            if(isExist.length > 0){
                logger.error(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.DUPLICATE_RECORD+Message.CREATE_ATTEMPT, {});
                return res.status(400).send({ data: null, message: Message.DUPLICATE_RECORD });
            }
            const record = await ContactService.createRecord(req.body);
            logger.info(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.CREATE_ATTEMPT+Message.SUCCESS, { userId: record._id });
            res.send({ data: record, message: Message.RECODE_CREATED });
        } catch (error) {
            if (error instanceof QuotaExceededError) {
                return handleQuotaError(res, error);
            }
            if (error.code === 11000) {
                logger.error(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.ERROR_IN+Message.CREATE_ATTEMPT, req.body.email);
                return res.status(400).send({data: null, message: Message.EMAIL_ALREADY_EXISTS });
            }
            logger.error(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.ERROR_IN+Message.CREATE_ATTEMPT, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR });
        }
    },
    get: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.CONTACT_CONTROLLER+Message.FETCHING_RECORD, { userId: req.userId });
        try {
            if(!req.params.id){
                logger.error(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.ERROR_IN+Message.FETCHING_USER_INFO, { error: Message.ID_IS_REQUIRED });
                return res.status(400).send({data: null, message: Message.ID_IS_REQUIRED});
            }
            const record = await ContactService.findRecordById(req.params.id);
            if (!record) {
                logger.error(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.ERROR_IN+Message.FETCHING_USER_INFO, { userId: req.userId });
                return res.status(404).send({data: null, message: Message.USER_NOT_FOUND});
            }
            if (record.userId.toString() !== req.userId) {
                return res.status(403).send({ data: null, message: 'Access denied' });
            }
            logger.info(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.FETCHING_USER_INFO+Message.SUCCESS, { userId: req.userId });
            res.send({ data: { record }, message: Message.USER_FOUND });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.ERROR_IN+Message.FETCHING_USER_INFO, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }  
    },
    delete: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.CONTACT_CONTROLLER+Message.DELETE_RECORD_ATTEMPT, { userId: req.params.id });
        try {
            if(!req.params.id){
                logger.error(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.ERROR_IN+Message.DELETE_RECORD_ATTEMPT, { error: Message.ID_IS_REQUIRED });
                return res.status(400).send({data: null, message: Message.ID_IS_REQUIRED});
            }
            const query = [{
                $match: {
                _id: new ObjectId(req.params.id),
                userId: new ObjectId(req.userId)
                }
            }];
            const record = await ContactService.findByQuery(query);
            if (!record) {
                logger.error(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.ERROR_IN+Message.DELETE_RECORD_ATTEMPT, { userId: req.params.id, query });
                return res.status(404).send({data: null, message: Message.DATA_NOT_FOUND});
            }
            await ContactService.deleteRecord(new ObjectId(record[0]._id));
            logger.info(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.DELETE_RECORD_ATTEMPT+Message.SUCCESS, { userId: req.params.id });
            res.send({ data: null, message: Message.USER_DELETED });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.ERROR_IN+Message.DELETE_RECORD_ATTEMPT, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }
    },
    update: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.CONTACT_CONTROLLER+Message.UPDATE_RECORD_ATTEMPT, { userId: req.params.id });
        try {
            if(!req.params.id){
                logger.error(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.ERROR_IN+Message.UPDATE_RECORD_ATTEMPT, { error: Message.ID_IS_REQUIRED });
                return res.status(400).send({data: null, message: Message.ID_IS_REQUIRED});
            }
            const existing = await ContactService.findRecordById(req.params.id);
            if (!existing) {
                return res.status(404).send({ data: null, message: Message.DATA_NOT_FOUND });
            }
            if (existing.userId.toString() !== req.userId) {
                return res.status(403).send({ data: null, message: 'Access denied' });
            }
            const record = await ContactService.updateRecord(req.params.id, req.body);
            logger.info(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.UPDATE_RECORD_ATTEMPT+Message.SUCCESS, { userId: req.params.id });
            res.send({ data: record, message: Message.RECORD_UPDATED });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.ERROR_IN+Message.UPDATE_RECORD_ATTEMPT, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }
    },
    getAll: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.CONTACT_CONTROLLER+Message.GET_ALL_RECORD_ATTEMPT);
        try {
            const ownerFilter = { userId: new ObjectId(req.userId) };
            let filter = { ...ownerFilter };
            if (req.query.search) {
               filter = {
                    $and: [
                        ownerFilter,
                        {
                            $or: [
                                { firstName: { $regex: req.query.search, $options: 'i' } },
                                { lastName: { $regex: req.query.search, $options: 'i' } },
                                { email: { $regex: req.query.search, $options: 'i' } },
                                { mobile: { $regex: req.query.search, $options: 'i' } }
                            ]
                        }
                    ]
                };
            }
            const data = await ContactService.getAllRecord(filter, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 10);
            const totalUsers = await ContactService.getAllRecord({ ...filter, countOnly: true });
            logger.info(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.GET_ALL_RECORD_ATTEMPT+Message.SUCCESS);
            res.send({ data: data, message: Message.SUCCESS, meta: { page: parseInt(req.query.page) || 1, limit: parseInt(req.query.limit) || 10, total: totalUsers } });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.GET_ALL_RECORD_ATTEMPT+Message.ERROR_IN, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }
    },
    importContact: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.CONTACT_CONTROLLER+Message.UPLOAD_FILE, { userId: req.userId });
        try {
            if (!req.file) {
                logger.error(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.ERROR_IN+Message.UPLOAD_FILE, {error: Message.UPLOAD_FILE + ' ' + Message.IS_REQUIRED });
                return res.status(400).send({
                    data: null,
                    message: Message.UPLOAD_FILE + ' ' + Message.IS_REQUIRED
                });
            }
            let list = null;
            if(req.body.id != null){
                const query = [{
                    $match: {
                    _id: new ObjectId(req.body.id),
                    userId: new ObjectId(req.userId)
                    }
                }];
                list = await ListService.findByQuery(query)
                if(list.length == 0){
                    logger.error(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.DATA_NOT_FOUND+Message.ADD_LIST_CONTACTS, {});
                    return res.status(400).send({ data: null, message: Message.DATA_NOT_FOUND });
                }
            }
            // Parse CSV
            const contacts = await ContactService.parseCSV(req.file.path);
            await EntitlementService.checkLimit(req.userId, 'contacts', contacts.length);
            const record = await ContactService.importContacts(contacts,req.userId,list?list[0]:null);
            logger.info(Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.UPLOAD_FILE+Message.SUCCESS, { userId: req.userId });
            return res.send({ data: record,  message: Message.UPLOADED_CONTACT_SUCCESS });
        } catch (error) {
            if (error instanceof QuotaExceededError) {
                return handleQuotaError(res, error);
            }
            logger.error( Message.LOG_END+' - '+Message.CONTACT_CONTROLLER+Message.ERROR_IN+Message.UPLOAD_FILE, error );
            return res.status(500).send({ data: null, message: Message.SERVER_ERROR });
        }
    },
};

module.exports = ContactController;