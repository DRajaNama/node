const { userRegisterValidation, userLoginValidation } = require('../validations/user.validations');
const AIService = require('../services/ai.service');
const Message = require('../helpers/constant.message');
const logger = require('../helpers/logging');
const AiContoller = {
    search: async (req, res) => {
        logger.info(Message.LOG_START+' - '+Message.AI_CONTROLLER+Message.AI_SEARCH, { userId: req.userId });
        try {
            if(!req.body.query) {
                logger.error(Message.LOG_END+' - '+Message.AI_CONTROLLER+Message.ERROR_IN+Message.AI_SEARCH, { userId: req.userId });
                return res.status(400).send({data: null, message: Message.QUERY_REQUIRED});
            }
            // const ai = await AIService.searchByOpenAI(req); 
            const ai = await AIService.searchByGoogleGenerativeAI(req);
            if (!ai) {
                logger.error(Message.LOG_END+' - '+Message.AI_CONTROLLER+Message.ERROR_IN+Message.AI_SEARCH, { userId: req.userId });
                return res.status(404).send({data: null, message: Message.ERROR_IN+Message.AI_SEARCH});
            }
            logger.info(Message.LOG_END+' - '+Message.AI_CONTROLLER+Message.AI_SEARCH+Message.SUCCESS, { userId: req.userId });
            res.send({ data: ai, message: Message.DATA_FOUND });
        } catch (error) {
            logger.error(Message.LOG_END+' - '+Message.AI_CONTROLLER+Message.ERROR_IN+Message.AI_SEARCH, error);
            res.status(500).send({data: null, message: Message.SERVER_ERROR});
        }  
    }
};

module.exports = AiContoller;