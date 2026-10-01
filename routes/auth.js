// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { Student } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET;
const isProd = process.env.NODE_ENV === 'production';

// Ortak: Auth cookie setleme
function setAuthCookie(res, token) {
  res.cookie('token', token, {
  httpOnly: true,
  secure: false,         // local test için false
  sameSite: 'lax',
  maxAge: 60 * 60 * 1000,
  path: '/'
});
}

// ----------------------------
// Giriş Yap
// ----------------------------
// Student Login
// Student Login
router.post('/login', async (req, res) => {
  const { student_number, password } = req.body;
  if (!student_number || !password) {
    return res.status(400).json({ error: 'Student number and password are required.' });
  }

  try {
    const student = await Student.findOne({ where: { student_number } });
    if (!student) return res.status(400).json({ error: 'Invalid student number or password.' });

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid student number or password.' });

    if (!student.is_verified) {
      const emailHint = student.email.replace(/(.{2}).+(@.+)/, '$1***$2');
      return res.status(401).json({
        error: 'E-posta doğrulanmamış. Lütfen e-posta doğrulamasını tamamlayın.',
        needsVerification: true,
        emailHint
      });
    }

    // Eğer geçici şifreyle giriş yaptıysa
    if (student.must_change_password) {
      const token = jwt.sign({ id: student.id, role: student.role }, JWT_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'lax' : 'strict',
        maxAge: 60 * 60 * 1000,
        path: '/'
      });
      return res.json({
        message: 'Geçici şifre ile giriş yapıldı. Yeni şifre belirleyin.',
        forceChange: true
      });
    }

    // Normal giriş
    const token = jwt.sign({ id: student.id, role: student.role }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'lax' : 'strict',
      maxAge: 60 * 60 * 1000,
      path: '/'
    });

    return res.json({ message: 'Login successful!', role: student.role });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'An error occurred during login.' });
  }
});

// ----------------------------
// E-posta Doğrulama Kodu Yeniden Gönder
// ----------------------------
router.post('/resend-code', async (req, res) => {
  try {
    const { email, student_number } = req.body || {};
    let user = null;

    if (email) {
      const emailNorm = String(email).trim().toLowerCase();
      const hacettepeRegex = /^[a-z0-9._%+-]+@hacettepe\.edu\.tr$/;
      if (!hacettepeRegex.test(emailNorm)) {
        return res.status(400).json({ error: 'Yalnızca @hacettepe.edu.tr kabul edilir.' });
      }
      user = await Student.findOne({ where: { email: emailNorm } });
    } else if (student_number) {
      user = await Student.findOne({ where: { student_number } });
    } else {
      return res.status(400).json({ error: 'email veya student_number gönderin.' });
    }

    // Kullanıcı olsa da olmasa da benzer mesaj (enumeration engeli)
    if (!user) return res.json({ message: 'Eğer kullanıcı varsa doğrulama e-postası gönderildi.' });
    if (user.is_verified) return res.json({ message: 'Hesap zaten doğrulanmış.' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 dk
    user.verification_code = code;
    user.verification_expires = expires;
    await user.save();

    try {
      await req.app.locals.sendVerificationEmail({ to: user.email, code });
    } catch (mailErr) {
      console.error('sendVerificationEmail error:', mailErr);
    }

    return res.json({ message: 'Doğrulama kodu e-postanıza gönderildi.' });
  } catch (err) {
    console.error('resend-code error:', err);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ----------------------------
// E-posta Doğrula
// ----------------------------
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: 'email ve code zorunludur.' });

    const emailNorm = String(email).trim().toLowerCase();
    const user = await Student.findOne({ where: { email: emailNorm } });
    if (!user) return res.status(400).json({ error: 'Geçersiz doğrulama bilgisi' });

    if (user.is_verified) return res.json({ message: 'Hesap zaten doğrulandı.' });

    if (!user.verification_code || !user.verification_expires) {
      return res.status(400).json({ error: 'Doğrulama kodu mevcut değil. Kod gönderin.' });
    }
    if (String(user.verification_code) !== String(code)) {
      return res.status(400).json({ error: 'Kod geçersiz.' });
    }
    if (new Date(user.verification_expires) < new Date()) {
      return res.status(400).json({ error: 'Kodun süresi dolmuş.' });
    }

    user.is_verified = true;
    user.verification_code = null;
    user.verification_expires = null;
    await user.save();

    return res.json({ message: 'E-posta doğrulandı. Artık giriş yapabilirsiniz.' });
  } catch (err) {
    console.error('verify-email error:', err);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ----------------------------
// Şifremi Unuttum: Link Gönder
// ----------------------------
// ----------------------------
// Yeni Şifre Belirle
// ----------------------------

// ----------------------------
// Oturum Bilgisi
// ----------------------------
router.get('/me', async (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Yetkilendirme gerektirir' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await Student.findByPk(decoded.id, {
      attributes: ['id', 'student_number', 'first_name', 'last_name', 'role', 'email', 'is_verified']
    });
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    return res.json(user);
  } catch (err) {
    console.error('Token doğrulama hatası:', err);
    return res.status(401).json({ error: 'Geçersiz token' });
  }
});
// ----------------------------
// ŞİFREMİ UNUTTUM: 6 HANELİ KOD GÖNDER
// ----------------------------
// Şifremi Unuttum: Geçici Şifre Gönder
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    const emailNorm = String(email || '').trim().toLowerCase();
    const hacettepeRegex = /^[a-z0-9._%+-]+@hacettepe\.edu\.tr$/;

    if (!hacettepeRegex.test(emailNorm)) {
      return res.status(400).json({ error: 'Yalnızca @hacettepe.edu.tr kabul edilir.' });
    }

    const user = await Student.findOne({ where: { email: emailNorm } });
    if (!user) {
      // Enumeration koruması
      return res.json({ message: 'Eğer kayıtlıysa geçici şifre gönderildi.' });
    }

    // Geçici şifre üret
    const tempPassword = Math.random().toString(36).slice(-8); // 8 karakter
    const hashed = await bcrypt.hash(tempPassword, 10);

    // DB güncelle
    user.password = hashed;
    user.must_change_password = true; // İlk login'de değiştirmek zorunda
    await user.save();

    // Mail gönder (server.js içindeki helper ile)
    await req.app.locals.sendPasswordResetCode({
      to: emailNorm,
      code: tempPassword // burada geçici şifreyi kod gibi kullanıyoruz
    });

    return res.json({ message: 'Eğer kayıtlıysa geçici şifre gönderildi.' });
  } catch (err) {
    console.error('forgot-password error:', err);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ADMIN LOGIN
router.post('/admin-login', async (req, res) => {
  const { student_number, password } = req.body;
  if (!student_number || !password) {
    return res.status(400).json({ error: 'Student number and password are required.' });
  }

  try {
    const student = await Student.findOne({ where: { student_number } });
    if (!student) return res.status(400).json({ error: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials.' });

    if (!['admin', 'editor'].includes(student.role)) {
      return res.status(403).json({ error: 'Unauthorized. Only admins/editors can login here.' });
    }

    const token = jwt.sign(
      { id: student.id, role: student.role },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 🔑 DEV'de de LAX kullan (STRICT bazen sorun çıkarır)
    res.cookie('token', token, {
      httpOnly: true,
      secure: false,         // dev
      sameSite: 'lax',       // <— ÖNEMLİ
      maxAge: 2 * 60 * 60 * 1000,
      path: '/'
    });

    return res.json({ message: 'Admin login successful', role: student.role });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ error: 'Server error during admin login' });
  }
});

// ... alt kısımlar aynı





// Yeni Şifre Belirle
router.post('/change-password', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Yetkilendirme gerekiyor.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: 'Yeni şifre gerekli.' });

    const user = await Student.findByPk(decoded.id);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const hashed = await bcrypt.hash(new_password, 10);
    user.password = hashed;
    user.must_change_password = false; // zorunluluk kalktı
    await user.save();

    return res.json({ message: 'Şifre güncellendi. Artık giriş yapabilirsiniz.' });
  } catch (err) {
    console.error('change-password error:', err);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});
// E-posta Doğrula (LINK ile - GET)
// ----------------------------
// Tek tık doğrulama (sadece email ile)
router.get('/verify-email-link', async (req, res) => {
  try {
    const { email } = req.query || {};
    if (!email) return res.status(400).send('Geçersiz bağlantı.');

    const emailNorm = String(email).trim().toLowerCase();
    const user = await Student.findOne({ where: { email: emailNorm } });
    if (!user) return res.status(400).send('Kullanıcı bulunamadı.');

    if (user.is_verified) {
      return res.redirect('/login.html');
    }

    // direkt aktif et
    user.is_verified = true;
    user.verification_code = null;
    user.verification_expires = null;
    await user.save();

    return res.redirect('/login.html');
  } catch (err) {
    console.error('verify-email-link error:', err);
    return res.status(500).send('Sunucu hatası.');
  }
});

// ----------------------------
// Çıkış
// ----------------------------
router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ message: 'Çıkış yapıldı' });
});

module.exports = router;
