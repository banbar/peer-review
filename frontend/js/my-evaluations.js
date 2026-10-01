document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      alert('Giriş yapmanız gerekiyor');
      window.location.href = 'login.html';
      return;
    }
  
    try {
      const response = await fetch('/api/my-evaluations', {
        headers: { 
          'Authorization': `Bearer ${token}`,
        },
      });
  
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          alert('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
          window.location.href = 'login.html';
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Değerlendirmeler alınamadı');
      }
  
      const data = await response.json();
      const evaluationsDiv = document.getElementById('evaluations');
  
      if (data.length === 0) {
        evaluationsDiv.innerHTML = '<p>Kendi web sitelerinize henüz değerlendirme yapılmamış.</p>';
        return;
      }
  
      data.forEach(ws => {
        const wsDiv = document.createElement('div');
        wsDiv.className = 'website-evaluation';
        wsDiv.innerHTML = `
          <h3>Website: <a href="${ws.website}" target="_blank">${ws.website}</a></h3>
          <p>Ortalama Puan: <strong>${ws.average_score}</strong></p>
          <h4>Değerlendirmeler:</h4>
          ${ws.evaluations.length > 0 ? `
            <ul>
              ${ws.evaluations.map(ev => `
                <li>
                  <strong>${ev.evaluator}</strong> - Puan: ${ev.score}<br>
                  Yorum: ${escapeHTML(ev.comment)}<br>
                  Tarih: ${new Date(ev.date).toLocaleString()}
                </li>
              `).join('')}
            </ul>
          ` : '<p>Henüz değerlendirme yapılmamış.</p>'}
          <hr>
        `;
        evaluationsDiv.appendChild(wsDiv);
      });
    } catch (error) {
      alert(`Hata: ${error.message}`);
    }
  });
  
  // Basit HTML Kaçış Fonksiyonu (XSS Koruması)
  function escapeHTML(str) {
    return str.replace(/[&<>"']/g, function(match) {
      const escape = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return escape[match];
    });
  }
  
  // Çıkış Yapma
  document.getElementById('logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    sessionStorage.removeItem('token');
    alert('Çıkış yaptınız.');
    window.location.href = 'login.html';
  });
  