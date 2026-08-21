const cheerio = require("cheerio");

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
        return content;
    } catch(error){
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
    prepareEmailHtml
};
