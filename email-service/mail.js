const nodemailer = require("nodemailer");
require("dotenv").config();

console.log(process.env.SMTP_HOST);
console.log(process.env.SMTP_PORT);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function sendEmail(to, subject, html) {
  const mailOptions = {
    from: process.env.SMTP_USER,
    to,
    subject,
    html,
  };

  // 使用 transporter.sendMail 并不等待其完成
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("邮件发送失败:", error);
    } else {
      console.log("邮件发送成功:", info.messageId);
    }
  });
}

// 验证 SMTP 连接
// transporter.verify((error, success) => {
//   if (error) {
//     console.error("SMTP连接失败:", error);
//   } else {
//     console.log("SMTP连接成功:", success);
//   }
// });

module.exports = sendEmail;