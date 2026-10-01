// server.js
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');

const app = express();
const models = require('./models');
const PORT = process.env.PORT || 5000;
app.use(express.static(path.join(__dirname, 'frontend')));
/* ------------------ Mailer ------------------ */
let transporterPromise;

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (process.env.NODE_ENV === 'production') {
        return nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT || 465),
          secure: String(process.env.SMTP_SECURE || 'true') === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      }
      // DEV: Ethereal
      const testAccount = await nodemailer.createTestAccount();
      return nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
    })();
  }
  return transporterPromise;
}

// E-posta doğrulama gönderimi
async function sendVerificationEmail({ to }) {
  const transporter = await getTransporter();
  const baseUrl = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
  
  // sadece email parametresiyle link
  const verifyUrl = `${baseUrl}/auth/verify-email-link?email=${encodeURIComponent(to)}`;

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || `"Review System" <${process.env.SMTP_USER || 'no-reply@example.com'}>`,
    to,
    subject: 'Hesabınızı Doğrulayın',
    html: `
      <div style="font-family:system-ui,Arial">
        <h2>Merhaba,</h2>
        <p>Hesabınızı doğrulamak için aşağıdaki bağlantıya tıklayın:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>Tıkladığınız anda hesabınız aktifleşecektir.</p>
      </div>
    `
  });

  if (process.env.NODE_ENV !== 'production') {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log('Ethereal preview URL:', previewUrl);
  }
  return { messageId: info.messageId };
}


// Şifre sıfırlama kodu
app.locals.sendPasswordResetCode = async ({ to, code }) => {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || `"GMT458 Review System" <${process.env.SMTP_USER || 'no-reply@example.com'}>`,
    to,
    subject: 'Şifre Sıfırlama Kodunuz',
    html: `
      <div style="font-family:system-ui,Arial">
        <h2>Şifre Sıfırlama</h2>
        <p>Yeni şifreniz:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:2px">${code}</p>
        <p>Bu kod <b>15 dakika</b> geçerlidir.</p>
      </div>
    `
  });
  if (process.env.NODE_ENV !== 'production') {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log('Ethereal preview URL (reset code):', previewUrl);
  }
  return { messageId: info.messageId };
};

// Şifre sıfırlama linki
// server.js içindeki
async function sendPasswordResetEmail({ to, token }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || `"GMT458 Review System" <${process.env.SMTP_USER || 'no-reply@example.com'}>`,
    to,
    subject: 'Yeni Şifreniz',
    html: `
      <div style="font-family:system-ui,Arial">
        <h2>Şifreniz sıfırlandı</h2>
        <p>Yeni şifreniz aşağıdadır:</p>
        <p style="font-size:20px;font-weight:bold">${token}</p>
        <p>Bu şifreyle giriş yaptıktan sonra sizden yeni şifre belirlemeniz istenecektir.</p>
      </div>
    `
  });

  if (process.env.NODE_ENV !== 'production') {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log('Ethereal preview URL (new password):', previewUrl);
    return { messageId: info.messageId, previewUrl };
  }
  return { messageId: info.messageId };
}


app.locals.sendVerificationEmail = sendVerificationEmail;
app.locals.sendPasswordResetEmail = sendPasswordResetEmail;

/* ------------------ Middleware ------------------ */
app.use(cors({
  origin: 'http://localhost:5000',
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(cookieParser());

/* ------------------ Routes ------------------ */
const apiRoutes   = require('./routes/api');
const authRoutes  = require('./routes/auth');
const adminRoutes = require('./routes/admin');

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

/* ------------------ Static frontend ------------------ */
const frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));

// test mail gönderme
app.post('/_dev/send-test-email', async (req, res) => {
  try {
    const { to = 'test@example.com', code = '123456' } = req.body || {};
    const out = await req.app.locals.sendVerificationEmail({ to, code });
    res.json({ ok: true, ...out });
  } catch (e) {
    console.error('send-test-email error:', e);
    res.status(500).json({ ok: false, error: 'Mail gönderilemedi' });
  }
});


/* ------------------ Error middleware ------------------ */
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).send('Sunucu hatası.');
});

/* ------------------ Start server ------------------ */
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
