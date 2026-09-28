// report.js
// Handles the report form: capturing location, photo preview, and submitting to the server.

const getLocBtn = document.getElementById('getLocBtn');
const locStatus = document.getElementById('locStatus');
const latInput = document.getElementById('latitude');
const lngInput = document.getElementById('longitude');
const form = document.getElementById('reportForm');
const formMsg = document.getElementById('formMsg');
const typeToggle = document.getElementById('typeToggle');
const photoTap = document.getElementById('photoTap');
const photoInput = document.getElementById('photo');
const locModeToggle = document.getElementById('locModeToggle');
const currentLocBlock = document.getElementById('currentLocBlock');
const pickLocBlock = document.getElementById('pickLocBlock');
const pickLocStatus = document.getElementById('pickLocStatus');

let selectedType = 'waste';
let pickMap = null;
let pickMarker = null;

// Location mode: "I'm at the location" (geolocation) vs "Different location" (tap a map pin)
locModeToggle.addEventListener('click', (e) => {
  if (!e.target.matches('button')) return;
  locModeToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');

  const mode = e.target.dataset.mode;
  latInput.value = '';
  lngInput.value = '';

  if (mode === 'current') {
    currentLocBlock.style.display = 'block';
    pickLocBlock.style.display = 'none';
    locStatus.textContent = 'No location captured yet';
  } else {
    currentLocBlock.style.display = 'none';
    pickLocBlock.style.display = 'block';
    pickLocStatus.textContent = 'No point selected yet';
    initPickMap();
  }
});

function initPickMap() {
  if (pickMap) { setTimeout(() => pickMap.invalidateSize(), 100); return; }

  pickMap = L.map('pickMap').setView([9.0765, 7.3986], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(pickMap);

  // If we already have the user's location, center on it as a starting point
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      pickMap.setView([pos.coords.latitude, pos.coords.longitude], 14);
    }, () => {}, { timeout: 5000 });
  }

  pickMap.on('click', (e) => {
    const { lat, lng } = e.latlng;
    latInput.value = lat;
    lngInput.value = lng;
    pickLocStatus.textContent = `Point selected: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    if (pickMarker) pickMap.removeLayer(pickMarker);
    pickMarker = L.marker([lat, lng]).addTo(pickMap);
  });

  setTimeout(() => pickMap.invalidateSize(), 100);
}

// If we arrived here from the "Report Illegal Dumping" card on Home, pre-select that tab
(function initFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  if (type === 'illegal-dumping') {
    selectedType = 'illegal-dumping';
    typeToggle.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    document.getElementById('pageTitle').textContent = 'Report Illegal Dumping';
  }
})();

typeToggle.addEventListener('click', (e) => {
  if (!e.target.matches('button')) return;
  typeToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  selectedType = e.target.dataset.type;
  document.getElementById('pageTitle').textContent = selectedType === 'waste' ? 'Report Waste' : 'Report Illegal Dumping';
});

// Photo tap -> preview
photoTap.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    photoTap.classList.add('has-image');
    photoTap.innerHTML = `<img src="${e.target.result}" alt="preview">`;
    photoTap.appendChild(photoInput);
  };
  reader.readAsDataURL(file);
});

// Geolocation
getLocBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    locStatus.textContent = 'Your browser does not support location.';
    return;
  }
  locStatus.textContent = 'Getting your location...';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      latInput.value = position.coords.latitude;
      lngInput.value = position.coords.longitude;
      locStatus.textContent = `Location captured: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
    },
    () => { locStatus.textContent = 'Could not get location. Please allow permission and try again.'; },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

// Submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!latInput.value || !lngInput.value) {
    showMsg('error', 'Please set a location before submitting your report.');
    return;
  }

  const formData = new FormData(form);
  formData.append('reportType', selectedType);

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  const session = getSession();
  const headers = session ? { 'x-auth-token': session.token } : {};

  try {
    const res = await fetch('/api/reports', { method: 'POST', body: formData, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong, please try again.');

    showMsg('success', '✅ Your report has been received. Thank you!');
    form.reset();
    locStatus.textContent = 'No location captured yet';
    locModeToggle.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.mode === 'current'));
    currentLocBlock.style.display = 'block';
    pickLocBlock.style.display = 'none';
    photoTap.classList.remove('has-image');
    photoTap.innerHTML = '<span id="photoTapText">📷 Tap to add photo (recommended)</span>';
    photoTap.appendChild(photoInput);
    setTimeout(() => { window.location.href = '/index.html'; }, 1200);
  } catch (err) {
    showMsg('error', '❌ ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Report';
  }
});

function showMsg(type, text) {
  formMsg.className = type;
  formMsg.textContent = text;
  formMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
