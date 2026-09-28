// my-reports.js
// Shows a resident their own reports, with status filtering. Tapping a report
// opens its full detail page.

const session = guardPage('resident');

let myReports = [];
let currentFilter = 'all';

const reportList = document.getElementById('reportList');
const filterRow = document.getElementById('filterRow');

async function load() {
  const res = await fetch('/api/my-reports', { headers: { 'x-auth-token': session.token } });
  myReports = await res.json();
  render();
}

function render() {
  const filtered = currentFilter === 'all' ? myReports : myReports.filter(r => r.status === currentFilter);

  if (filtered.length === 0) {
    reportList.innerHTML = '<p class="empty">No reports here yet. Tap "Report an Issue" on Home to get started.</p>';
    return;
  }

  reportList.innerHTML = filtered.map(r => `
    <div class="report-item clickable" onclick="window.location.href='/report-detail.html?id=${r.id}'">
      ${r.photo ? `<img src="${r.photo}" alt="report photo">` : `<div style="width:76px;height:76px;border-radius:8px;background:#E4ECE0;flex-shrink:0;"></div>`}
      <div class="report-body">
        <div class="report-top">
          <strong>${escapeHtml(r.reportType === 'illegal-dumping' ? 'Illegal Dumping' : (r.wasteType || 'Waste Collection'))}</strong>
          <span class="badge ${r.status}">${r.status}</span>
        </div>
        <p class="report-desc">${escapeHtml(r.address || r.description || 'No details added')}</p>
        <div class="report-meta">${new Date(r.dateReported).toLocaleDateString()}</div>
      </div>
    </div>
  `).join('');
}

filterRow.addEventListener('click', (e) => {
  if (!e.target.matches('.chip')) return;
  filterRow.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  e.target.classList.add('active');
  currentFilter = e.target.dataset.filter;
  render();
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

load();
