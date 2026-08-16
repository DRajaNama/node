const WhatsAppService =
    require('../services/whatsapp.services');

const WhatsAppSession =
    require('../models/whatsappSession.model');

const logger =
    require('../helpers/logging');

const Message =
    require('../helpers/constant.message');


const WhatsAppController = {

    /**
     * Connect WhatsApp
     */
    connect: async (req, res) => {

        logger.info(
            'WhatsApp connect attempt',
            {
                userId: req.userId
            }
        );

        try {

            const session =
                await WhatsAppService.connect(
                    req.userId
                );

            return res.send({
                data: session,
                message:
                    'WhatsApp connection started successfully'
            });

        } catch (error) {

            logger.error(
                'WhatsApp connect error',
                error
            );

            return res.status(500).send({
                data: null,
                message:
                    error.message ||
                    Message.SERVER_ERROR
            });
        }
    },


    /**
     * Get WhatsApp connection status
     */
    status: async (req, res) => {

        logger.info(
            'WhatsApp status',
            {
                userId: req.userId
            }
        );

        try {

            const session =
                await WhatsAppService.getStatus(
                    req.userId
                );

            return res.send({
                data: session,
                message: 'Success'
            });

        } catch (error) {

            logger.error(
                'WhatsApp status error',
                error
            );

            return res.status(500).send({
                data: null,
                message:
                    error.message ||
                    Message.SERVER_ERROR
            });
        }
    },


    /**
     * Get WhatsApp groups
     */
    getGroups: async (req, res) => {

        logger.info(
            'WhatsApp groups fetch',
            {
                userId: req.userId
            }
        );

        try {

            const groups =
                await WhatsAppService.getGroups(
                    req.userId
                );

            return res.send({
                data: groups,
                message: 'Groups fetched successfully'
            });

        } catch (error) {

            logger.error(
                'WhatsApp groups error',
                error
            );

            return res.status(400).send({
                data: null,
                message:
                    error.message ||
                    Message.SERVER_ERROR
            });
        }
    },


    /**
     * Send message to selected groups
     */
    sendMessage: async (req, res) => {

        logger.info(
            'WhatsApp send message attempt',
            {
                userId: req.userId,
                groupIds: req.body.groupIds
            }
        );

        try {

            const {
                groupIds,
                message
            } = req.body;


            if (
                !Array.isArray(groupIds) ||
                groupIds.length === 0
            ) {

                return res.status(400).send({
                    data: null,
                    message:
                        'Please select at least one WhatsApp group'
                });
            }


            if (
                !message ||
                !message.trim()
            ) {

                return res.status(400).send({
                    data: null,
                    message:
                        'Message is required'
                });
            }


            const results =
                await WhatsAppService.sendMessage(
                    req.userId,
                    groupIds,
                    message
                );


            const successCount =
                results.filter(
                    item => item.status === 'sent'
                ).length;

            const failedCount =
                results.filter(
                    item => item.status === 'failed'
                ).length;


            logger.info(
                'WhatsApp message completed',
                {
                    userId: req.userId,
                    successCount,
                    failedCount
                }
            );


            return res.send({

                data: {
                    results,
                    total: results.length,
                    successCount,
                    failedCount
                },

                message:
                    'Message sending completed'
            });

        } catch (error) {

            logger.error(
                'WhatsApp send message error',
                error
            );

            return res.status(400).send({
                data: null,
                message:
                    error.message ||
                    Message.SERVER_ERROR
            });
        }
    },


    /**
     * Logout WhatsApp
     */
    logout: async (req, res) => {

        logger.info(
            'WhatsApp logout',
            {
                userId: req.userId
            }
        );

        try {

            await WhatsAppService.logout(
                req.userId
            );

            return res.send({
                data: null,
                message:
                    'WhatsApp disconnected successfully'
            });

        } catch (error) {

            logger.error(
                'WhatsApp logout error',
                error
            );

            return res.status(500).send({
                data: null,
                message:
                    error.message ||
                    Message.SERVER_ERROR
            });
        }
    }

};


module.exports =
    WhatsAppController;