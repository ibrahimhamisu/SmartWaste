// report-detail.js
// Loads and displays a single report's full details, including a small map.

const session = guardPage();
const params = new URLSearchParams(window.location.search);
const reportId = params.get('id');
const main = document.getElementById('main');

function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ');
}

async function load() {
  if (!reportId) {
    main.innerHTML = '<p class="empty">No report specified.</p>';
    return;
  }

  const res = await fetch(`/api/reports/${reportId}`, { headers: { 'x-auth-token': session.token } });
  if (!res.ok) {
    main.innerHTML = '<p class="empty">This report could not be found, or you do not have permission to view it.</p>';
    return;
  }
  const r = await res.json();

  main.innerHTML = `
    ${r.photo
      ? `<img src="${r.photo}" alt="report photo" class="detail-photo">`
      : `<div class="detail-photo" style="display:flex;align-items:center;justify-content:center;color:var(--ink-soft);">No photo attached</div>`}

    <div class="card">
      <div class="detail-row"><span class="k">Type</span><span class="v">${r.reportType === 'illegal-dumping' ? 'Illegal Dumping' : 'Waste'}</span></div>
      <div class="detail-row"><span class="k">Waste type</span><span class="v">${escapeHtml(r.wasteType || '—')}</span></div>
      <div class="detail-row"><span class="k">Status</span><span class="v"><span class="badge ${r.status}">${statusLabel(r.status)}</span></span></div>
      <div class="detail-row"><span class="k">Reported by</span><span class="v">${escapeHtml(r.reporterName)}</span></div>
      <div class="detail-row"><span class="k">Date</span><span class="v">${new Date(r.dateReported).toLocaleString()}</span></div>
      <div class="detail-row"><span class="k">Address</span><span class="v">${escapeHtml(r.address || '—')}</span></div>
      ${r.description ? `<div class="detail-row"><span class="k">Description</span><span class="v">${escapeHtml(r.description)}</span></div>` : ''}
    </div>

    <div id="detailMap"></div>
  `;

  const lat = parseFloat(r.latitude);
  const lng = parseFloat(r.longitude);
  if (!isNaN(lat) && !isNaN(lng)) {
    const map = L.map('detailMap').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    L.marker([lat, lng]).addTo(map);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

load();
