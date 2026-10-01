document.getElementById('changeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const newPass = document.getElementById('new_password').value.trim();
  const confirmPass = document.getElementById('confirm_password').value.trim();
  const msgEl = document.getElementById('message');

  if (!newPass || newPass !== confirmPass) {
    msgEl.textContent = 'Şifreler eşleşmiyor';
    msgEl.className = 'err';
    return;
  }

  try {
    const resp = await fetch('/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ new_password: newPass })
    });

    const data = await resp.json();
    if (resp.ok) {
      msgEl.textContent = 'Şifre başarıyla güncellendi. Yönlendiriliyorsunuz...';
      msgEl.className = 'ok';
      setTimeout(() => window.location.href = 'dashboard.html', 1500);
    } else {
      msgEl.textContent = data.error || 'Şifre değiştirilemedi.';
      msgEl.className = 'err';
    }
  } catch (err) {
    console.error(err);
    msgEl.textContent = 'Sunucu hatası';
    msgEl.className = 'err';
  }
});
