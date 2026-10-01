// mailer.js
const nodemailer = require('nodemailer');

const {
  SMTP_HOST, SMTP_PORT, SMTP_SECURE,
  SMTP_USER, SMTP_PASS, MAIL_FROM
} = process.env;

let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,                     // smtp.gmail.com
    port: Number(SMTP_PORT || 465),      // 465
    secure: String(SMTP_SECURE) === 'true', // true
    auth: { user: SMTP_USER, pass: SMTP_PASS }
    // Gmail için ekstra TLS ayarına genelde gerek yok
  });

  await transporter.verify(); // bağlantıyı doğrular, hata varsa burada patlar
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const tx = await getTransporter();
  return tx.sendMail({
    from: MAIL_FROM || SMTP_USER, // Gmail SMTP kullanıyorsan from = gmail adresin olmalı
    to,
    subject,
    text,
    html
  });
}

module.exports = { sendMail };
