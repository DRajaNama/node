const cheerio = require("cheerio");
require('dotenv').config();

const getTrackingBaseUrl = () => String(
    process.env.FULL_URL || process.env.API_URL || 'http://localhost:3000'
).replace(/\/+$/, '').replace(/\/api$/i, '');

const injectEmailTracking = (html, data = {}) => {
    const token = String(data.TRACKTOKEN || '').trim();
    if (!token) return html;

    const $ = cheerio.load(html, { decodeEntities: false });
    const trackingBaseUrl = getTrackingBaseUrl();

    if (data.TRACK_CLICK !== false) {
        $('a[href]').each((_index, element) => {
            const link = $(element);
            const href = String(link.attr('href') || '').trim();
            if (!/^https?:\/\//i.test(href) || /\/api\/track\/click\//i.test(href)) return;

            link.attr(
                'href',
                `${trackingBaseUrl}/api/track/click/${token}?url=${encodeURIComponent(href)}`
            );
        });
    }

    if (data.TRACK_OPEN !== false && !$('[data-ve-open-tracking]').length) {
        $('body').append(
            `<img data-ve-open-tracking="true" src="${trackingBaseUrl}/api/track/open/${token}.png" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0" />`
        );
    }

    return $.html();
};

const prepareEmailHtml = (html) => {
    const $ = cheerio.load(html, {
        decodeEntities: false
    });

    const $container = $(".ve-email-container").first();

    if (!$container.length) {
        // CKEditor creates normal HTML fragments instead of the visual
        // editor's `.ve-email-container`. Preserve that content and give it a
        // minimal email-safe document/table wrapper so campaign sends work for
        // both authoring modes.
        const body = $("body").html() || html;
        return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f5;"><tr><td align="center" style="padding:20px;">
    <table class="ve-email-container" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;"><tr><td style="padding:32px;color:#222222;font-size:16px;line-height:1.5;">
      ${body}
    </td></tr></table>
  </td></tr></table>
</body></html>`;
    }

    $("body").find(".editor-element").each((index, el) => {

        const $el = $(el);

        // Don't touch the main email container
            if ($el.is(".ve-email-container")) {
                return;
            }

            // If this editor element is outside the email container
            if (!$el.closest(".ve-email-container").length) {
                $el.remove();
            }
        });
    $(".editor-element, .editable-text, .ui-droppable, .ui-draggable, .ui-draggable-handle, .ui-resizable, .selected")
        .removeClass(
            "editor-element " +
            "editable-text " +
            "ui-droppable " +
            "ui-draggable " +
            "ui-draggable-handle " +
            "ui-resizable " +
            "selected"
        );
    $("[data-type]").removeAttr("data-type");
    $("[data-resize]").removeAttr("data-resize");
    $("[data-drag]").removeAttr("data-drag");
    $("[contenteditable]").removeAttr("contenteditable");
    $("[tabindex]").removeAttr("tabindex");

    return $.html();
}

const replaceTemplateVariables = (html, data) => {
    try {
        let content = prepareEmailHtml(html);

        // Add default unsubscribe link if not provided
        if (content.includes('[[UNSUBSCRIBE_LINK]]')) {
            const unsubscribeLink =  data?.UNSUBSCRIBE_LINK || process.env.FULL_URL+'/api/public/unsubscribe/'+data?.EMAIL;
            console.log('unsubsribeLink',unsubscribeLink)
            content = content.replace(
                /\[\[UNSUBSCRIBE_LINK\]\]/g,
                unsubscribeLink
            );
        }

        Object.keys(data).forEach((key) => {
            const regex = new RegExp(
                `\\[\\[${key}\\]\\]`,
                "g"
            );
            content = content.replace(
                regex,
                data[key] ?? ""
            );
        });
        return injectEmailTracking(content, data);
    } catch(error) {
        throw error;
    }
};

const cleanEmailHtml = (html) => {
    const $ = cheerio.load(html, {
        decodeEntities: false
    });
    $("[class]").each((i, el) => {
        const $el = $(el);

        const classes = ($el.attr("class") || "")
            .split(/\s+/)
            .filter(Boolean)
            .filter(className => ![
                "editor-element",
                "editable-text",
                "ui-droppable",
                "ui-draggable",
                "ui-draggable-handle",
                "ui-resizable",
                "selected"
            ].includes(className));

        if (classes.length) {
            $el.attr("class", classes.join(" "));
        } else {
            $el.removeAttr("class");
        }
    });

    $("[contenteditable]").removeAttr("contenteditable");
    $("[data-type]").removeAttr("data-type");
    $("[data-resize]").removeAttr("data-resize");
    $("[data-drag]").removeAttr("data-drag");
    $("[tabindex]").removeAttr("tabindex");
    return $.html();
};
module.exports = {
    replaceTemplateVariables,
    cleanEmailHtml,
    prepareEmailHtml,
    injectEmailTracking
};
