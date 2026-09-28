// notifications.js
// Loads a resident's notifications and marks them as read.

const session = guardPage('resident');
const notifList = document.getElementById('notifList');

async function load() {
  const res = await fetch('/api/notifications', { headers: { 'x-auth-token': session.token } });
  const notifications = await res.json();

  if (notifications.length === 0) {
    notifList.innerHTML = '<p class="empty">No notifications yet. You will be notified here when the status of your reports changes.</p>';
    return;
  }

  notifList.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}">
      <div>${escapeHtml(n.message)}</div>
      <div class="notif-date">${new Date(n.createdAt).toLocaleString()}</div>
    </div>
  `).join('');

  // Mark everything as read once viewed
  fetch('/api/notifications/mark-read', {
    method: 'POST',
    headers: { 'x-auth-token': session.token }
  }).catch(() => {});
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

load();
