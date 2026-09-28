// map.js
// Fetches all reports and plots them on a Leaflet map.

const session = guardPage(); // any logged-in user (resident or admin) can view the map

let allReports = [];
let markers = [];
let currentFilter = 'all';

// Start the map at a sensible default center; it re-fits to the actual reports below.
const map = L.map('map').setView([9.0765, 7.3986], 12); // default: Abuja, Nigeria area
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

function colorFor(report) {
  if (report.status === 'in-progress') return '#F59E0B';
  if (report.status === 'resolved') return '#16A34A';
  return report.reportType === 'illegal-dumping' ? '#DC2626' : '#16A34A';
}

function render() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  const filtered = currentFilter === 'all' ? allReports : allReports.filter(r => r.reportType === currentFilter);

  filtered.forEach(r => {
    const lat = parseFloat(r.latitude);
    const lng = parseFloat(r.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    const marker = L.circleMarker([lat, lng], {
      radius: 9,
      fillColor: colorFor(r),
      color: '#fff',
      weight: 2,
      fillOpacity: 0.9
    }).addTo(map);

    marker.bindPopup(`
      <strong>${r.reportType === 'illegal-dumping' ? 'Illegal Dumping' : (r.wasteType || 'Waste')}</strong><br>
      ${r.address || 'No landmark'}<br>
      Status: ${r.status}
    `);

    markers.push(marker);
  });

  if (filtered.length > 0) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.2));
  }

  // Legend counts
  document.getElementById('legWaste').textContent = allReports.filter(r => r.reportType !== 'illegal-dumping').length;
  document.getElementById('legDump').textContent = allReports.filter(r => r.reportType === 'illegal-dumping').length;
  document.getElementById('legProgress').textContent = allReports.filter(r => r.status === 'in-progress').length;
}

async function load() {
  const res = await fetch('/api/map-reports', { headers: { 'x-auth-token': session.token } });
  allReports = await res.json();
  render();
}

document.getElementById('filterRow').addEventListener('click', (e) => {
  if (!e.target.matches('.chip')) return;
  document.querySelectorAll('#filterRow .chip').forEach(c => c.classList.remove('active'));
  e.target.classList.add('active');
  currentFilter = e.target.dataset.filter;
  render();
});

load();
