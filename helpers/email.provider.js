const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === "true",
    auth:{
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});


const sendEmail = async(data)=>{
    try {
        const mailOptions = {
            from: `"${data.fromName}" <${data.fromEmail}>`,
            to: data.email,
            subject: data.subject,
            html: data.html
        };

        const result = await transporter.sendMail(
            mailOptions
        );
        return result;
    } catch(error){
        throw error;
    }
};


module.exports = sendEmail;