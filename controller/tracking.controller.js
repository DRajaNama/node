const CampaignRecipient = require("../models/campaignRecipient.model");
const CampaignEvent = require("../models/campaignEvent.model");
const CampaignService = require("../services/campaign.services");
const RealtimeService = require('../services/realtime.services');

const getRedirectUrl = (value) => {
    try {
        const url = new URL(String(value || ''));
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '/';
    } catch {
        return '/';
    }
};

const TrackingController = {
    open: async (req, res) => {
        try {
            const recipient = await CampaignRecipient.findOne({ trackingToken: req.params.token });
            if (recipient) {
                await CampaignEvent.create({
                    campaignId: recipient.campaignId,
                    recipientId: recipient._id,
                    event: "opened",
                    ip: req.ip,
                    userAgent: req.headers["user-agent"]
                }).catch(() => undefined);

                const firstOpen = await CampaignRecipient.updateOne(
                    { _id: recipient._id, openedAt: null },
                    { $set: { openedAt: new Date() } }
                );
                if (firstOpen.modifiedCount) {
                    await CampaignRecipient.updateOne(
                        { _id: recipient._id, status: { $in: ['sent', 'delivered'] } },
                        { $set: { status: 'opened' } }
                    );
                    await CampaignService.incrementStats(recipient.campaignId, { "stats.opened": 1 });
                    RealtimeService.emitToUser(recipient.userId, 'campaign:updated', {
                        campaignId: String(recipient.campaignId),
                        event: 'opened'
                    });
                }
            }
        } catch (error) {
            console.log(error);
        }
        // 1px transparent image
        const pixel = Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
            "base64"
        );
        res.writeHead(200, {
            "Content-Type": "image/png",
            "Content-Length": pixel.length,
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Pragma": "no-cache"
        });

        res.end(pixel);
    },

    click: async (req, res) => {
        try {
            const recipient =  await CampaignRecipient.findOne({ trackingToken: req.params.token });
            const url = getRedirectUrl(req.query.url);
            if (recipient) {
                await CampaignEvent.create({
                    campaignId: recipient.campaignId,
                    recipientId: recipient._id,
                    event: "clicked",
                    url,
                    ip: req.ip,
                    userAgent: req.headers["user-agent"]
                }).catch(() => undefined);

                const firstClick = await CampaignRecipient.updateOne(
                    { _id: recipient._id, clickedAt: null },
                    { $set: { clickedAt: new Date(), status: 'clicked' } }
                );
                if (firstClick.modifiedCount) {
                    await CampaignService.incrementStats(recipient.campaignId, { "stats.clicked": 1});
                    RealtimeService.emitToUser(recipient.userId, 'campaign:updated', {
                        campaignId: String(recipient.campaignId),
                        event: 'clicked'
                    });
                }
            }
            res.redirect(url);
        } catch (error) {
            console.log(error);
            res.redirect("/");
        }
    }
};


module.exports = TrackingController;
