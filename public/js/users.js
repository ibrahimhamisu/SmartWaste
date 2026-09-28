// users.js
// Lets an admin view all resident accounts and delete accounts if needed.

const session = guardPage('admin');
const userList = document.getElementById('userList');

async function load() {
  const res = await fetch('/api/users', { headers: { 'x-auth-token': session.token } });
  const users = await res.json();

  if (users.length === 0) {
    userList.innerHTML = '<p class="empty">No resident accounts yet.</p>';
    return;
  }

  userList.innerHTML = users.map(u => `
    <div class="report-item">
      <div class="avatar" style="flex-shrink:0;">${escapeHtml(u.name.charAt(0).toUpperCase())}</div>
      <div class="report-body">
        <div class="report-top">
          <strong>${escapeHtml(u.name)}</strong>
        </div>
        <p class="report-desc">${escapeHtml(u.email)}</p>
        <div class="report-meta">
          ${u.reportCount} report(s) submitted · Joined ${new Date(u.createdAt).toLocaleDateString()}
        </div>
        <div class="report-actions">
          <button class="btn btn-ghost" onclick="deleteUser('${u.id}', '${escapeHtml(u.name)}')">Delete account</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function deleteUser(id, name) {
  if (!confirm(`Are you sure you want to delete ${name}'s account? This cannot be undone.`)) return;
  const res = await fetch(`/api/users/${id}`, { method: 'DELETE', headers: { 'x-auth-token': session.token } });
  const data = await res.json();
  if (!res.ok) { alert(data.error || 'Could not delete this account.'); return; }
  await load();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

load();
