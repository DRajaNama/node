const replaceTemplateVariables = (html, data) => {
    try {
        let content = html;
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