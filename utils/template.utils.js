

const getBlankTemplate = (template) => {

    const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Blank Email Template</title>
            </head>

            <body style="margin:0;padding:20px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                <td align="center">

                    <!-- Email Container -->
                    <table
                    role="presentation"
                    width="600"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="max-width:600px;background:#ffffff;border:1px solid #dddddd;border-radius:6px;"
                    >

                    <!-- Blank Content Area -->
                    <tr>
                        <td style="padding:40px;font-size:16px;line-height:1.6;color:#333333;">

                        {{CONTENT}}

                        </td>
                    </tr>

                    </table>

                </td>
                </tr>
            </table>

            </body>
            </html>
            `;

    return {
        html: html,
    };
}

module.exports = {
    getBlankTemplate,
};
