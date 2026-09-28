// admin.js
// Loads all reports for the admin dashboard, renders stats and charts,
// and lets the admin update status, delete reports, search, and export CSV.

const session = guardPage('admin');
document.getElementById('welcomeText').textContent = `Welcome, ${session.user.name}`;

const menuToggleBtn = document.getElementById('menuToggleBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
menuToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  dropdownMenu.classList.toggle('open');
});
document.addEventListener('click', (e) => {
  if (!dropdownMenu.contains(e.target) && e.target !== menuToggleBtn) {
    dropdownMenu.classList.remove('open');
  }
});

document.getElementById('logoutLink').addEventListener('click', (e) => {
  e.preventDefault();
  logout();
});

const themeToggleLink = document.getElementById('themeToggleLink');
function syncThemeLabel() {
  const isDark = localStorage.getItem('sw_theme') === 'dark';
  themeToggleLink.textContent = isDark ? '☀️ Light mode' : '🌙 Dark mode';
}
syncThemeLabel();
themeToggleLink.addEventListener('click', (e) => {
  e.preventDefault();
  const isDark = localStorage.getItem('sw_theme') === 'dark';
  toggleTheme(!isDark);
  syncThemeLabel();
});

let allReports = [];
let currentFilter = 'all';

const reportList = document.getElementById('reportList');
const filterRow = document.getElementById('filterRow');

// Step 1: load reports + stats when the page opens
async function loadReports() {
  const res = await fetch('/api/reports', { headers: { 'x-auth-token': session.token } });
  if (res.status === 401 || res.status === 403) { clearSession(); window.location.href = '/login.html'; return; }
  allReports = await res.json();
  flagDuplicates();
  render();
  loadStats();
  renderCharts();
}

// --- Duplicate detection ---
// Flags reports as likely duplicates if another report of the same type sits
// within ~120 meters and was submitted within 5 days of it.
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function flagDuplicates() {
  const DISTANCE_M = 120;
  const DAYS = 5;

  allReports.forEach(r => { r.duplicateCount = 0; });

  for (let i = 0; i < allReports.length; i++) {
    const a = allReports[i];
    const aLat = parseFloat(a.latitude), aLng = parseFloat(a.longitude);
    if (isNaN(aLat) || isNaN(aLng)) continue;

    for (let j = i + 1; j < allReports.length; j++) {
      const b = allReports[j];
      if (a.reportType !== b.reportType) continue;
      const bLat = parseFloat(b.latitude), bLng = parseFloat(b.longitude);
      if (isNaN(bLat) || isNaN(bLng)) continue;

      const daysApart = Math.abs(new Date(a.dateReported) - new Date(b.dateReported)) / 86400000;
      if (daysApart > DAYS) continue;

      if (haversineMeters(aLat, aLng, bLat, bLng) <= DISTANCE_M) {
        a.duplicateCount++;
        b.duplicateCount++;
      }
    }
  }
}

async function loadStats() {
  const res = await fetch('/api/stats', { headers: { 'x-auth-token': session.token } });
  const stats = await res.json();
  document.getElementById('statTotal').textContent = stats.total;
  document.getElementById('statPending').textContent = stats.pending;
  document.getElementById('statProgress').textContent = stats.inProgress;
  document.getElementById('statResolved').textContent = stats.resolved;
}

// Step 2: render reports (filtered by status + search text)
function render() {
  let filtered = currentFilter === 'all'
    ? allReports
    : allReports.filter(r => r.status === currentFilter);

  const query = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  if (query) {
    filtered = filtered.filter(r =>
      (r.description || '').toLowerCase().includes(query) ||
      (r.address || '').toLowerCase().includes(query) ||
      (r.reporterName || '').toLowerCase().includes(query)
    );
  }

  if (filtered.length === 0) {
    reportList.innerHTML = '<p class="empty">No reports in this category.</p>';
    return;
  }

  reportList.innerHTML = filtered.map(r => `
    <div class="report-item" data-id="${r.id}">
      ${r.photo ? `<img src="${r.photo}" alt="dump site photo">` : `<div style="width:76px;height:76px;border-radius:8px;background:#E4ECE0;flex-shrink:0;"></div>`}
      <div class="report-body">
        <div class="report-top">
          <strong>${escapeHtml(r.address || 'No landmark given')}</strong>
          <span class="badge ${r.status}">${r.status}</span>
        </div>
        ${r.duplicateCount > 0 ? `<span class="badge duplicate">⚠ Possible duplicate (${r.duplicateCount} nearby)</span>` : ''}
        <p class="report-desc">${escapeHtml(r.description)}</p>
        <div class="report-meta">
          By ${escapeHtml(r.reporterName)} · ${new Date(r.dateReported).toLocaleString()}<br>
          📍 ${r.latitude}, ${r.longitude}
          <a href="https://www.google.com/maps?q=${r.latitude},${r.longitude}" target="_blank">(view on map)</a>
        </div>
        <div class="report-actions">
          <select onchange="updateStatus('${r.id}', this.value)">
            <option value="pending" ${r.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="in-progress" ${r.status === 'in-progress' ? 'selected' : ''}>In progress</option>
            <option value="resolved" ${r.status === 'resolved' ? 'selected' : ''}>Resolved</option>
          </select>
          <button class="btn btn-ghost" onclick="deleteReport('${r.id}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

// Step 3: update status
async function updateStatus(id, status) {
  await fetch(`/api/reports/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-auth-token': session.token },
    body: JSON.stringify({ status })
  });
  await loadReports();
}

// Step 4: delete a report
async function deleteReport(id) {
  if (!confirm('Are you sure you want to delete this report?')) return;
  await fetch(`/api/reports/${id}`, { method: 'DELETE', headers: { 'x-auth-token': session.token } });
  await loadReports();
}

// Charts - trend (by month) and report types (donut)
let trendChartInstance, typeChartInstance;

function renderCharts() {
  // --- Trend: count of reports per month, last 6 months ---
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleString('en', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() });
  }
  const trendData = months.map(m =>
    allReports.filter(r => {
      const rd = new Date(r.dateReported);
      return rd.getFullYear() === m.year && rd.getMonth() === m.month;
    }).length
  );

  const trendCtx = document.getElementById('trendChart');
  if (trendChartInstance) trendChartInstance.destroy();
  trendChartInstance = new Chart(trendCtx, {
    type: 'line',
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        data: trendData,
        borderColor: '#16A34A',
        backgroundColor: 'rgba(22,163,74,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 3
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });

  // --- Report types donut ---
  const wasteCount = allReports.filter(r => r.reportType !== 'illegal-dumping').length;
  const dumpCount = allReports.filter(r => r.reportType === 'illegal-dumping').length;

  const typeCtx = document.getElementById('typeChart');
  if (typeChartInstance) typeChartInstance.destroy();
  typeChartInstance = new Chart(typeCtx, {
    type: 'doughnut',
    data: {
      labels: ['Waste Collection', 'Illegal Dumping'],
      datasets: [{ data: [wasteCount, dumpCount], backgroundColor: ['#16A34A', '#DC2626'] }]
    },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
  });
}

// Filter chips
filterRow.addEventListener('click', (e) => {
  if (!e.target.matches('.chip')) return;
  filterRow.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  e.target.classList.add('active');
  currentFilter = e.target.dataset.filter;
  render();
});

// Search box
document.getElementById('searchInput').addEventListener('input', render);

// Export CSV - lets the admin download all reports as an Excel/CSV file
document.getElementById('exportBtn').addEventListener('click', () => {
  if (allReports.length === 0) {
    alert('There are no reports to export.');
    return;
  }

  const headers = ['ID', 'Type', 'Waste Type', 'Description', 'Address', 'Latitude', 'Longitude', 'Reporter', 'Status', 'Date'];
  const rows = allReports.map(r => [
    r.id, r.reportType, r.wasteType || '', r.description || '', r.address || '',
    r.latitude, r.longitude, r.reporterName, r.status, r.dateReported
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smartwaste-reports-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

loadReports();
