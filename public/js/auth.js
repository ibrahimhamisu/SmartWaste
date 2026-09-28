// auth.js
// Shared helper functions used by every page: login, signup, logout,
// password reset, and page protection (guardPage).

async function apiLogin(email, password, role) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed.');
  return data;
}

async function apiSignup(name, email, password) {
  const res = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Sign up failed.');
  return data;
}

async function apiForgotPassword(email) {
  const res = await fetch('/api/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

async function apiResetPassword(token, newPassword) {
  const res = await fetch('/api/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function saveSession(token, user) {
  localStorage.setItem('sw_token', token);
  localStorage.setItem('sw_user', JSON.stringify(user));
}

function getSession() {
  const token = localStorage.getItem('sw_token');
  const userRaw = localStorage.getItem('sw_user');
  if (!token || !userRaw) return null;
  return { token, user: JSON.parse(userRaw) };
}

function clearSession() {
  localStorage.removeItem('sw_token');
  localStorage.removeItem('sw_user');
}

async function logout() {
  const session = getSession();
  if (session) {
    await fetch('/api/logout', { headers: { 'x-auth-token': session.token } }).catch(() => {});
  }
  clearSession();
  window.location.href = '/login.html';
}

// Call this at the top of any page that requires login (e.g. admin.html).
// requiredRole: 'admin' or 'resident' - leave blank to allow any logged-in user.
function guardPage(requiredRole) {
  const session = getSession();
  if (!session) {
    window.location.href = '/login.html';
    return null;
  }
  if (requiredRole && session.user.role !== requiredRole) {
    window.location.href = '/login.html';
    return null;
  }
  return session;
}
