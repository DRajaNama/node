const cheerio = require("cheerio");

const prepareEmailHtml = (html) => {
    const $ = cheerio.load(html, {
        decodeEntities: false
    });

    const $container = $(".ve-email-container").first();

    if (!$container.length) {
        throw new Error("Email container not found");
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