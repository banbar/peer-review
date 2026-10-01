// frontend/js/admin-login.js
document.addEventListener('DOMContentLoaded', () => {
  // Eski/yanlış cookie kalmış olabilir — temizle (sessizce)
  fetch('/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});

  const form = document.getElementById('adminLoginForm');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const student_number = document.getElementById('student_number').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!student_number || !password) {
      alert('Student number ve password zorunlu.');
      return;
    }

    try {
      const resp = await fetch('/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',               // 🔑 cookie al
        body: JSON.stringify({ student_number, password })
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Admin login failed');
      }

      if (data.role === 'admin' || data.role === 'editor') {
        window.location.href = '/admin-dashboard.html';
      } else {
        alert('Bu sayfa sadece admin/editor kullanıcılar içindir.');
      }
    } catch (err) {
      console.error('Admin Login Error:', err);
      alert(err.message);
    }
  });
});
