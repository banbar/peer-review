// frontend/js/login.js

document.getElementById('loginForm').addEventListener('submit', onLoginSubmit);
const msgEl = document.getElementById('message');
const unverifiedBox = document.getElementById('unverifiedActions');
const unverifiedHint = document.getElementById('unverifiedHint');
const resendBtn = document.getElementById('resendBtn');
const loginBtn = document.getElementById('loginBtn');

function setMessage(text, type) {
  msgEl.textContent = text;
  msgEl.className = '';
  if (type === 'ok') msgEl.classList.add('ok');
  else if (type === 'err') msgEl.classList.add('err');
  else msgEl.classList.add('muted');
}

function showUnverifiedActions(student_number) {
  unverifiedHint.textContent = 'You can resend the email verification code.';
  unverifiedBox.style.display = 'block';
  // duplicate listener oluşmasın
  resendBtn.replaceWith(resendBtn.cloneNode(true));
  const freshBtn = document.getElementById('resendBtn');

  freshBtn.addEventListener('click', async () => {
    freshBtn.disabled = true;
    setMessage('Code is being sent...', 'muted');
    try {
      const r = await fetch('/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ student_number })
      });
      const j = await r.json();
      if (r.ok) setMessage(j.message || 'Confirmation email has been sent.', 'ok');
      else setMessage(j.error || 'Kod gönderilemedi.', 'err');
    } catch (e) {
      console.error('resend-code error:', e);
      setMessage('An error occurred while sending the code.', 'err');
    } finally {
      freshBtn.disabled = false;
    }
  });
}

async function onLoginSubmit(e) {
  e.preventDefault();

  setMessage('', 'muted');
  unverifiedBox.style.display = 'none';

  const student_number = document.getElementById('student_number').value.trim();
  const password = document.getElementById('password').value;

  if (!student_number || !password) {
    setMessage('Student number and password are required.', 'err');
    return;
  }

  loginBtn.disabled = true;

  try {
    const resp = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // cookie set edilsin
      body: JSON.stringify({ student_number, password })
    });

    const data = await resp.json();
    console.log('LOGIN resp status:', resp.status, data); // teşhis için

    if (resp.ok) {
      if (data.forceChange) {
        setMessage('You have logged in with a temporary password. Please choose a new password…', 'ok');
        setTimeout(() => { window.location.href = 'change_password.html'; }, 500);
        return;
      }
      setMessage('Login successful. Redirecting...', 'ok');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
      return;
    }

    // 401 ve doğrulanmamış hesap
    if (data && data.needsVerification) {
      const hint = data.emailHint ? ` (${data.emailHint})` : '';
      setMessage('Your account is not verified. Please check your email.' + hint, 'err');
      showUnverifiedActions(student_number);
      return;
    }

    // Diğer hatalar
    setMessage(data?.error || 'Giriş başarısız.', 'err');

  } catch (err) {
    console.error('Login error:', err);
    setMessage('An error occurred while logging in.', 'err');
  } finally {
    loginBtn.disabled = false;
  }
}

// Enter ile hızlı gönderim
document.getElementById('password').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') {
    document.getElementById('loginForm').dispatchEvent(new Event('submit'));
  }
});
