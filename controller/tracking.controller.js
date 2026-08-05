const CampaignRecipient = require("../models/campaignRecipient.model");
const CampaignEvent = require("../models/campaignEvent.model");
const CampaignService = require("../services/campaign.services");


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
                });

                if (!recipient.openedAt) {
                    await CampaignRecipient.updateOne({ _id: recipient._id }, { openedAt: new Date(), status: "opened" });
                    await CampaignService.incrementStats( recipient.campaignId, {"stats.opened": 1 });
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
            "Content-Length": pixel.length
        });

        res.end(pixel);
    },

    click: async (req, res) => {
        try {
            const recipient =  await CampaignRecipient.findOne({ trackingToken: req.params.token });
            const url = req.query.url;
            if (recipient) {
                await CampaignEvent.create({
                    campaignId: recipient.campaignId,
                    recipientId: recipient._id,
                    event: "clicked",
                    url,
                    ip: req.ip,
                    userAgent: req.headers["user-agent"]
                });

                if (!recipient.clickedAt) {
                    await CampaignRecipient.updateOne({ _id: recipient._id }, { clickedAt: new Date(), status: "clicked" });
                    await CampaignService.incrementStats( recipient.campaignId, { "stats.clicked": 1});
                }
            }
            res.redirect(url || "/");
        } catch (error) {
            console.log(error);
            res.redirect("/");
        }
    }
};


module.exports = TrackingController;