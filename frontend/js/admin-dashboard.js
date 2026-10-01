// frontend/js/admin-dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
  // ========== 1) YETKİ KONTROLÜ ==========
  try {
    const resp = await fetch('/auth/me', { method: 'GET', credentials: 'include' });
    if (!resp.ok) {
      window.location.href = '/admin-login.html';
      return;
    }
    const user = await resp.json();
    if (user.role !== 'admin' && user.role !== 'editor') {
      alert('You do not have permission to access this page.');
      window.location.href = '/login.html';
      return;
    }
    console.log('Welcome admin/editor:', user);
  } catch (err) {
    console.error('Auth check error:', err);
    window.location.href = '/admin-login.html';
    return;
  }

  // ========== 2) LOGOUT ==========
  document.getElementById('logoutButton')?.addEventListener('click', async () => {
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    window.location.href = '/admin-login.html';
  });

  // ========== 3) GENEL FETCH HELPER ==========
  const fetchData = async (url) => {
    try {
      const response = await fetch(url, { credentials: 'include' });
      const text = await response.text(); // boş body'yi tolere et
      const data = text ? JSON.parse(text) : null;

      if (!response.ok) {
        throw new Error((data && data.error) || `HTTP error! status: ${response.status}`);
      }
      return data;
    } catch (error) {
      console.error('Fetch Hatası:', error);
      alert(`Veri çekme hatası: ${error.message}`);
      return null;
    }
  };

  // ========== 4) ÖĞRENCİLER ==========
  const loadStudents = async () => {
    const students = await fetchData('/admin/students');
    const tbody = document.querySelector('#studentsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!Array.isArray(students)) return;

    students.forEach(student => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${student.id}</td>
        <td>${student.student_number}</td>
        <td>${student.first_name}</td>
        <td>${student.last_name}</td>
        <td>${student.role || 'student'}</td>
      `;
      tbody.appendChild(tr);
    });
  };

  // ========== 5) DEĞERLENDİRMELER ==========
  const loadEvaluations = async () => {
    const evaluations = await fetchData('/admin/evaluations');
    const tbody = document.querySelector('#evaluationsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!Array.isArray(evaluations)) return;

    evaluations.forEach(ev => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${ev.id}</td>
        <td>${ev.evaluator.first_name} ${ev.evaluator.last_name} (SN: ${ev.evaluator.student_number})</td>
        <td><a href="${ev.website.url}" target="_blank">${ev.website.url}</a></td>
        <td>${ev.score ?? 'No score'}</td>
        <td>${ev.comment || 'No comment'}</td>
        <td>${new Date(ev.created_at).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  };

  // ========== 6) WEBSİTELER ==========
  const loadWebsites = async () => {
    const websites = await fetchData('/admin/websites');
    const tbody = document.querySelector('#websitesTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!Array.isArray(websites)) return;

    websites.forEach(w => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${w.id}</td>
        <td><a href="${w.url}" target="_blank">${w.url}</a></td>
        <td>${w.project?.name || '-'}</td>
        <td>${(w.student?.first_name || '')} ${(w.student?.last_name || '')}</td>
        <td>${w.evaluation_count || 0}</td>
        <td>${w.total_score || 0}</td>
      `;
      tbody.appendChild(tr);
    });
  };

  // ========== 7) EXCEL EXPORT (Proje filtreli) ==========
async function handleStudentsExportClick() {
  // 0) Başlangıç logu
  console.log('[Export] Clicked');

  try {
    // 1) Proje filtresi
    const pid = document.getElementById('filterWebsitesProject')?.value || '';
    const qs = pid ? `?project_id=${encodeURIComponent(pid)}` : '';
    const url = `/admin/reports/student-project-scores${qs}`;

    console.log('[Export] GET', url);

    // 2) İstek
    const resp = await fetch(url, { method: 'GET', credentials: 'include' });

    console.log('[Export] status:', resp.status, 'redirected:', resp.redirected);
    const ct = resp.headers.get('content-type') || '';
    const cd = resp.headers.get('content-disposition') || '';
    console.log('[Export] content-type:', ct);
    console.log('[Export] content-disposition:', cd);

    // 3) Yetki/redirect yakalama (çoğu zaman login sayfası döner)
    if (resp.redirected || (ct.includes('text/html') && !cd.toLowerCase().includes('attachment'))) {
      alert('İndirme başlatılamadı: Görünüşe göre oturum doğrulama/redirect var. Doğrudan indirme başlatıyorum.');
      // B Planı: tarayıcıyı direkt URL’e gönder (server Content-Disposition ile indirme tetikler)
      window.location.href = url;
      return;
    }

    // 4) Hata kodu
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(t || `Export failed (${resp.status})`);
    }

    // 5) Excel beklenmiyorsa kullanıcıya göster
    if (!ct.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
      // Yine de indirmeyi deneyeceğiz ama kullanıcıyı bilgilendirelim:
      console.warn('[Export] Beklenen Excel content-type gelmedi:', ct);
    }

    // 6) Blob -> indir
    const blob = await resp.blob();
    if (!blob || blob.size === 0) {
      // Sunucu 204/no content vb.
      alert('Rapor boş döndü (içerik yok).');
      return;
    }

    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = `student-project-scores${pid ? `-project-${pid}` : '-all'}-${today}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);

    console.log('[Export] Download triggered');
  } catch (e) {
    console.error('Export error:', e);
    alert(e.message || 'Export failed.');
  }
}

function wireExportExcel() {
  const btn = document.getElementById('exportExcelBtn');
  if (!btn) {
    console.warn('Export Excel button (exportExcelBtn) bulunamadı.');
    return;
  }
  // Olası çift bağlamayı önle
  btn.removeEventListener('click', handleStudentsExportClick);
  btn.addEventListener('click', handleStudentsExportClick);
}

  // ========== 8) TÜM VERİLERİ YÜKLE + BUTON BAĞLA ==========
  const loadAllData = async () => {
    await loadStudents();
    await loadEvaluations();
    await loadWebsites();
    wireExportExcel(); // Export butonunu en sonda bağla
  };

  await loadAllData();
});
