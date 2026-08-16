const express = require('express');

const router =
    express.Router();

const WhatsAppController =
    require('../controller/whatsappController');

const authMiddleware =
    require('../middleware/auth.middleware');

const logger =
    require('../helpers/logging');


// ==========================================
// CONNECT WHATSAPP
// ==========================================

router.post(
    '/whatsapp/connect',
    authMiddleware,
    (req, res, next) => {

        logger.info(
            'WhatsApp connect route', {
                userId: req.userId
            }
        );

        WhatsAppController.connect(
            req,
            res,
            next
        );
    }
);


// ==========================================
// WHATSAPP STATUS / QR
// ==========================================

router.get(
    '/whatsapp/status',
    authMiddleware,
    (req, res, next) => {

        logger.info(
            'WhatsApp status route', {
                userId: req.userId
            }
        );

        WhatsAppController.status(
            req,
            res,
            next
        );
    }
);


// ==========================================
// GET GROUPS
// ==========================================

router.get(
    '/whatsapp/groups',
    authMiddleware,
    (req, res, next) => {

        logger.info(
            'WhatsApp groups route', {
                userId: req.userId
            }
        );

        WhatsAppController.getGroups(
            req,
            res,
            next
        );
    }
);


// ==========================================
// SEND MESSAGE
// ==========================================

router.post(
    '/whatsapp/send-message',
    authMiddleware,
    (req, res, next) => {

        logger.info(
            'WhatsApp send message route', {
                userId: req.userId
            }
        );

        WhatsAppController.sendMessage(
            req,
            res,
            next
        );
    }
);


// ==========================================
// LOGOUT
// ==========================================

router.post(
    '/whatsapp/logout',
    authMiddleware,
    (req, res, next) => {

        logger.info(
            'WhatsApp logout route', {
                userId: req.userId
            }
        );

        WhatsAppController.logout(
            req,
            res,
            next
        );
    }
);


module.exports = router;