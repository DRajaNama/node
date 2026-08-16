const {
    Client,
    LocalAuth
} = require('whatsapp-web.js');

const QRCode = require('qrcode');

const WhatsAppSession =
    require('../models/whatsappSession.model');

const WhatsAppGroup =
    require('../models/whatsappGroup.model');

const logger =
    require('../helpers/logging');


class WhatsAppService {

    constructor() {

        this.clients = new Map();

        this.initializing = new Map();
    }


    // =====================================================
    // GET CLIENT
    // =====================================================

    getClient(userId) {

        return this.clients.get(
            userId.toString()
        );
    }


    // =====================================================
    // CREATE CLIENT
    // =====================================================

    async createClient(userId) {

        const userKey =
            userId.toString();


        // -----------------------------------------------
        // Already running
        // -----------------------------------------------

        if (this.clients.has(userKey)) {

            logger.info(
                `[WA:${userKey}] Client already exists`
            );

            return this.clients.get(userKey);
        }


        // -----------------------------------------------
        // Already initializing
        // -----------------------------------------------

        if (this.initializing.has(userKey)) {

            logger.info(
                `[WA:${userKey}] Initialization already running`
            );

            return this.initializing.get(userKey);
        }


        // -----------------------------------------------
        // Initialization promise
        // -----------------------------------------------

        const promise =
            this.initializeClient(userKey);


        this.initializing.set(
            userKey,
            promise
        );


        try {

            return await promise;

        } finally {

            this.initializing.delete(
                userKey
            );
        }
    }


    // =====================================================
    // INITIALIZE CLIENT
    // =====================================================

    async initializeClient(userId) {

        logger.info(
            `[WA:${userId}] Creating WhatsApp client`
        );


        const client = new Client({

            authStrategy: new LocalAuth({

                clientId:
                    `user-${userId}`,

                dataPath:
                    './whatsapp-sessions'
            }),


            puppeteer: {

                headless: true,

                args: [

                    '--no-sandbox',

                    '--disable-setuid-sandbox',

                    '--disable-dev-shm-usage',

                    '--disable-gpu',

                    '--disable-extensions'
                ]
            },


            authTimeoutMs:
                120000,


            qrMaxRetries:
                10,


            takeoverOnConflict:
                true,


            takeoverTimeoutMs:
                10000
        });


        // -----------------------------------------------
        // IMPORTANT
        // -----------------------------------------------

        this.clients.set(
            userId,
            client
        );


        this.registerEvents(
            client,
            userId
        );


        await WhatsAppSession.findOneAndUpdate(

            {
                userId
            },

            {
                $set: {

                    status:
                        'connecting',

                    qrCode:
                        null,

                    authFailureReason:
                        null
                }
            },

            {
                upsert: true
            }
        );


        try {

            logger.info(
                `[WA:${userId}] Calling client.initialize()`
            );


            await client.initialize();


            logger.info(
                `[WA:${userId}] initialize() completed`
            );


            return client;

        } catch (error) {

            logger.error(
                `[WA:${userId}] initialize() FAILED`,
                error
            );


            this.clients.delete(
                userId
            );


            await WhatsAppSession.findOneAndUpdate(

                {
                    userId
                },

                {
                    $set: {

                        status:
                            'error',

                        authFailureReason:
                            error?.message ||
                            'Initialization failed'
                    }
                }
            );


            throw error;
        }
    }


    // =====================================================
    // EVENTS
    // =====================================================

    registerEvents(
        client,
        userId
    ) {


        // -----------------------------------------------
        // LOADING
        // -----------------------------------------------

        client.on(
            'loading_screen',
            (percent, message) => {

                logger.info(
                    `[WA:${userId}] LOADING ${percent}% - ${message}`
                );
            }
        );


        // -----------------------------------------------
        // QR
        // -----------------------------------------------

        client.on(
            'qr',
            async (qr) => {

                logger.info(
                    `[WA:${userId}] QR RECEIVED`
                );


                try {

                    const qrCode =
                        await QRCode.toDataURL(qr);


                    await WhatsAppSession.findOneAndUpdate(

                        {
                            userId
                        },

                        {
                            $set: {

                                status:
                                    'qr',

                                qrCode,

                                authFailureReason:
                                    null
                            }
                        },

                        {
                            upsert: true
                        }
                    );


                    logger.info(
                        `[WA:${userId}] QR SAVED TO DATABASE`
                    );

                } catch (error) {

                    logger.error(
                        `[WA:${userId}] QR ERROR`,
                        error
                    );
                }
            }
        );


        // -----------------------------------------------
        // AUTHENTICATED
        // -----------------------------------------------

        client.on(
            'authenticated',
            async () => {

                logger.info(
                    `[WA:${userId}] AUTHENTICATED`
                );


                await WhatsAppSession.findOneAndUpdate(

                    {
                        userId
                    },

                    {
                        $set: {

                            status:
                                'authenticated',

                            qrCode:
                                null,

                            authFailureReason:
                                null
                        }
                    },

                    {
                        upsert: true
                    }
                );
            }
        );


        // -----------------------------------------------
        // READY
        // -----------------------------------------------

        client.on(
            'ready',
            async () => {

                logger.info(
                    `[WA:${userId}] =======================`
                );

                logger.info(
                    `[WA:${userId}] WHATSAPP READY`
                );

                logger.info(
                    `[WA:${userId}] =======================`
                );


                try {

                    const info =
                        client.info;


                    logger.info(
                        `[WA:${userId}] PHONE: ${info?.wid?.user}`
                    );


                    await WhatsAppSession.findOneAndUpdate(

                        {
                            userId
                        },

                        {
                            $set: {

                                status:
                                    'ready',

                                qrCode:
                                    null,

                                phoneNumber:
                                    info?.wid?.user ||
                                    null,

                                name:
                                    info?.pushname ||
                                    null,

                                lastConnectedAt:
                                    new Date(),

                                authFailureReason:
                                    null
                            }
                        },

                        {
                            upsert: true
                        }
                    );

                } catch (error) {

                    logger.error(
                        `[WA:${userId}] READY ERROR`,
                        error
                    );
                }
            }
        );


        // -----------------------------------------------
        // CHANGE STATE
        // -----------------------------------------------

        client.on(
            'change_state',
            (state) => {

                logger.info(
                    `[WA:${userId}] STATE = ${state}`
                );
            }
        );


        // -----------------------------------------------
        // AUTH FAILURE
        // -----------------------------------------------

        client.on(
            'auth_failure',
            async (message) => {

                logger.error(
                    `[WA:${userId}] AUTH FAILURE`
                );

                logger.error(
                    message
                );


                await WhatsAppSession.findOneAndUpdate(

                    {
                        userId
                    },

                    {
                        $set: {

                            status:
                                'auth_failure',

                            authFailureReason:
                                message?.toString() ||
                                'Authentication failed',

                            qrCode:
                                null
                        }
                    }
                );


                this.clients.delete(
                    userId
                );
            }
        );


        // -----------------------------------------------
        // DISCONNECTED
        // -----------------------------------------------

        client.on(
            'disconnected',
            async (reason) => {

                logger.error(
                    `[WA:${userId}] DISCONNECTED: ${reason}`
                );


                await WhatsAppSession.findOneAndUpdate(

                    {
                        userId
                    },

                    {
                        $set: {

                            status:
                                'disconnected',

                            lastDisconnectedAt:
                                new Date()
                        }
                    }
                );


                this.clients.delete(
                    userId
                );
            }
        );
    }


    // =====================================================
    // CONNECT
    // =====================================================

    async connect(userId) {

    const userKey = userId.toString();

    logger.info(
        `[WA:${userKey}] CONNECT REQUEST`
    );

    const session =
        await WhatsAppSession.findOneAndUpdate(
            {
                userId: userKey
            },
            {
                $set: {
                    status: 'connecting',
                    qrCode: null,
                    authFailureReason: null
                }
            },
            {
                upsert: true,
                new: true
            }
        );

    // Already running
    if (
        this.clients.has(userKey) ||
        this.initializing.has(userKey)
    ) {

        logger.info(
            `[WA:${userKey}] Already running`
        );

        return session;
    }

    // IMPORTANT:
    // Start WhatsApp in background.
    // Do NOT await it.
    this.createClient(userKey)
        .then(() => {

            logger.info(
                `[WA:${userKey}] WhatsApp initialization finished`
            );

        })
        .catch(async (error) => {

            logger.error(
                `[WA:${userKey}] WhatsApp initialization failed`,
                error
            );

            await WhatsAppSession.findOneAndUpdate(
                {
                    userId: userKey
                },
                {
                    $set: {
                        status: 'error',
                        authFailureReason:
                            error?.message ||
                            'Initialization failed'
                    }
                }
            );
        });

    return session;
}


    // =====================================================
    // STATUS
    // =====================================================

    async getStatus(userId) {

        let session =
            await WhatsAppSession.findOne({
                userId
            });


        if (!session) {

            session =
                await WhatsAppSession.create({

                    userId,

                    status:
                        'disconnected'
                });
        }


        return session;
    }


    // =====================================================
    // READY
    // =====================================================

    async isReady(userId) {

        const client =
            this.getClient(userId);


        if (!client) {
            return false;
        }


        try {

            const state =
                await client.getState();


            logger.info(
                `[WA:${userId}] CURRENT STATE = ${state}`
            );


            return state ===
                'CONNECTED';

        } catch (error) {

            logger.error(
                `[WA:${userId}] STATE ERROR`,
                error
            );

            return false;
        }
    }


    // =====================================================
    // GROUPS
    // =====================================================

    async syncGroups(
        userId,
        client
    ) {

        logger.info(
            `[WA:${userId}] START GROUP SYNC`
        );


        const chats =
            await client.getChats();


        const groups =
            chats.filter(
                chat => chat.isGroup
            );


        logger.info(
            `[WA:${userId}] GROUPS FOUND: ${groups.length}`
        );


        const operations =
            groups.map(group => ({

                updateOne: {

                    filter: {

                        userId,

                        groupId:
                            group.id._serialized
                    },

                    update: {

                        $set: {

                            name:
                                group.name,

                            description:
                                group.description ||
                                null,

                            memberCount:
                                group.participants
                                    ? group.participants.length
                                    : 0,

                            isGroup:
                                true,

                            lastSyncedAt:
                                new Date()
                        }
                    },

                    upsert:
                        true
                }
            }));


        if (operations.length) {

            await WhatsAppGroup.bulkWrite(
                operations
            );
        }


        return groups;
    }


    // =====================================================
    // GET GROUPS
    // =====================================================

    async getGroups(userId) {

        const client =
            this.getClient(userId);


        if (!client) {

            throw new Error(
                'WhatsApp is not connected'
            );
        }


        const state =
            await client.getState();


        if (state !== 'CONNECTED') {

            throw new Error(
                `WhatsApp is not ready. Current state: ${state}`
            );
        }


        await this.syncGroups(
            userId,
            client
        );


        return await WhatsAppGroup.find({
            userId
        }).sort({
            name: 1
        });
    }


    // =====================================================
    // SEND MESSAGE
    // =====================================================

    async sendMessage(
        userId,
        groupIds,
        message
    ) {

        if (
            !Array.isArray(groupIds) ||
            groupIds.length === 0
        ) {

            throw new Error(
                'At least one group is required'
            );
        }


        if (
            !message ||
            !message.trim()
        ) {

            throw new Error(
                'Message is required'
            );
        }


        const client =
            this.getClient(userId);


        if (!client) {

            throw new Error(
                'WhatsApp is not connected'
            );
        }


        const state =
            await client.getState();


        if (state !== 'CONNECTED') {

            throw new Error(
                `WhatsApp is not ready. Current state: ${state}`
            );
        }


        const groups =
            await WhatsAppGroup.find({

                userId,

                groupId: {
                    $in: groupIds
                }
            });


        const results = [];


        for (const group of groups) {

            try {

                await client.sendMessage(

                    group.groupId,

                    message.trim()
                );


                results.push({

                    groupId:
                        group.groupId,

                    groupName:
                        group.name,

                    status:
                        'sent'
                });


            } catch (error) {

                results.push({

                    groupId:
                        group.groupId,

                    groupName:
                        group.name,

                    status:
                        'failed',

                    error:
                        error.message
                });
            }
        }


        return results;
    }


    // =====================================================
    // LOGOUT
    // =====================================================

    async logout(userId) {

        const userKey =
            userId.toString();


        const client =
            this.getClient(userKey);


        if (client) {

            try {

                await client.logout();

            } catch (error) {

                logger.error(
                    `[WA:${userKey}] LOGOUT ERROR`,
                    error
                );
            }


            try {

                await client.destroy();

            } catch (error) {

                logger.error(
                    `[WA:${userKey}] DESTROY ERROR`,
                    error
                );
            }


            this.clients.delete(
                userKey
            );
        }


        await WhatsAppGroup.deleteMany({
            userId
        });


        await WhatsAppSession.findOneAndUpdate(

            {
                userId
            },

            {
                $set: {

                    status:
                        'disconnected',

                    qrCode:
                        null,

                    phoneNumber:
                        null,

                    name:
                        null,

                    lastDisconnectedAt:
                        new Date()
                }
            }
        );


        return true;
    }
}


module.exports =
    new WhatsAppService();