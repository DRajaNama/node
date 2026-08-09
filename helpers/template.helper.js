const cheerio = require("cheerio");

const prepareEmailHtml = (html) => {
    const $ = cheerio.load(html, {
        decodeEntities: false
    });


    // remove editor generated elements
    $("[id^='editor-element']").each((index, el) => {

        const $el = $(el);

        // get all children, keep content
        const children = $el.contents();

        // remove editor attributes
        children.each((i, child) => {

            if (child.type === "tag") {

                $(child)
                    .removeAttr("id")
                    .removeAttr("contenteditable")
                    .removeClass(
                        "editor-element editable-text ui-draggable-handle ui-droppable ui-draggable ui-resizable selected"
                    );

            }

        });


        // replace editor div with its inner HTML
        $el.replaceWith(children);

    });


    // remove empty paragraphs
    $("p").each((i, p) => {

        if ($(p).text().trim() === "" && $(p).children().length === 0) {
            $(p).remove();
        }

    });


    // remove absolute positioning styles
    $("[style]").each((i, el) => {

        let style = $(el).attr("style");

        style = style
            .replace(/position\s*:\s*absolute;?/gi, "")
            .replace(/left\s*:[^;]+;?/gi, "")
            .replace(/top\s*:[^;]+;?/gi, "")
            .replace(/z-index\s*:[^;]+;?/gi, "")
            .replace(/outline\s*:[^;]+;?/gi, "")
            .trim();


        if(style){
            $(el).attr("style", style);
        }
        else{
            $(el).removeAttr("style");
        }

    });

    $("table").each((i, table) => {

        const $table = $(table);

        const meaningfulContent = $table
            .find("img, h1, h2, h3, h4, h5, h6, p")
            .filter(function () {
                return $(this).text().trim() !== "";
            })
            .length;


        if (meaningfulContent === 0) {
            $table.remove();
        }

    });

    return $.html();
}

const replaceTemplateVariables = (html, data) => {
    try {
        let content = prepareEmailHtml(html);
        Object.keys(data).forEach((key)=>{
            const regex = new RegExp(
                `{{${key}}}`,
                "g"
            );
            content = content.replace(
                regex,
                data[key] || ""
            );
        });
        return content;
    } catch(error){
        throw error;
    }
};

module.exports = {
    replaceTemplateVariables
};