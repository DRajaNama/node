const nodemailer = require("nodemailer");
const Message = require('../helpers/constant.message');


// var transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST,
//     port: process.env.SMTP_PORT,
//     secure: process.env.SMTP_SECURE === "true",
//     auth:{
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASSWORD
//     }
// });


const sendEmail = async(data,smtp=null)=>{
    console.log('sendmail',smtp)
    try {
        if(smtp){
            transporter = nodemailer.createTransport({
                host: smtp.host,
                port: smtp.port,
                secure: smtp.encryption === "SSL",
                auth:{
                    user: smtp.username,
                    pass: smtp.password
                }
            });

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
        }else{
            throw new Error(Message.SMTP_NOT_FOUND);
        }
    } catch(error){
        throw error;
    }
};


module.exports = sendEmail;