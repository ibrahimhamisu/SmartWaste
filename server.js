// server.js
// This is the backend "brain" of the application - it receives requests from the
// browser, stores data, and sends back responses.

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3000;

// Data file locations (we use JSON files as a lightweight database - no separate
// database server needed, which keeps setup simple).
const DB_FILE = path.join(__dirname, 'data', 'reports.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');
const RESETS_FILE = path.join(__dirname, 'data', 'password-resets.json');
const NOTIFICATIONS_FILE = path.join(__dirname, 'data', 'notifications.json');
const VAPID_FILE = path.join(__dirname, 'data', 'vapid-keys.json');
const PUSH_SUBS_FILE = path.join(__dirname, 'data', 'push-subscriptions.json');

const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer - handles photo uploads from the report form
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// --- Generic JSON file read/write helpers ---
function readJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  const raw = fs.readFileSync(file, 'utf-8');
  return raw ? JSON.parse(raw) : fallback;
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const readReports = () => readJSON(DB_FILE, []);
const writeReports = (data) => writeJSON(DB_FILE, data);
const readUsers = () => readJSON(USERS_FILE, []);
const writeUsers = (data) => writeJSON(USERS_FILE, data);
const readSessions = () => readJSON(SESSIONS_FILE, {});
const writeSessions = (data) => writeJSON(SESSIONS_FILE, data);
const readResets = () => readJSON(RESETS_FILE, {});
const writeResets = (data) => writeJSON(RESETS_FILE, data);
const readNotifications = () => readJSON(NOTIFICATIONS_FILE, []);
const writeNotifications = (data) => writeJSON(NOTIFICATIONS_FILE, data);
const readPushSubs = () => readJSON(PUSH_SUBS_FILE, []);
const writePushSubs = (data) => writeJSON(PUSH_SUBS_FILE, data);

// --- Password hashing (using Node's built-in crypto module - no extra
// dependency needed, and it avoids native-compile issues on some machines) ---
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createUserRecord({ name, email, password, role, address }) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  return {
    id: Date.now().toString(),
    name,
    email: email.toLowerCase().trim(),
    role, // 'resident' | 'admin'
    address: address || '',
    photoURL: null,
    salt,
    hash,
    createdAt: new Date().toISOString()
  };
}

// Create one default admin account the first time the server ever starts.
// Login: admin@smartwaste.com / admin123
// IMPORTANT: change this password before a real deployment!
function seedDefaultAdmin() {
  const users = readUsers();
  const hasAdmin = users.some(u => u.role === 'admin');
  if (!hasAdmin) {
    users.push(createUserRecord({
      name: 'Admin',
      email: 'admin@smartwaste.com',
      password: 'admin123',
      role: 'admin'
    }));
    writeUsers(users);
    console.log('Default admin account created -> admin@smartwaste.com / admin123');
  }
}

// --- Auth middleware: checks the token the client sends in a header ---
function requireAuth(role) {
  return (req, res, next) => {
    const token = req.headers['x-auth-token'];
    const sessions = readSessions();
    const session = token && sessions[token];

    if (!session) {
      return res.status(401).json({ error: 'You are not logged in. Please sign in first.' });
    }
    if (role && session.role !== role) {
      return res.status(403).json({ error: 'You do not have permission to access this.' });
    }
    req.user = session;
    next();
  };
}

// Optional auth - if a token is present we attach the user, but we never block the request
function optionalAuth(req) {
  const token = req.headers['x-auth-token'];
  const sessions = readSessions();
  return (token && sessions[token]) || null;
}

// Helper to create an in-app notification for a resident
function notifyUser(email, message, reportId) {
  const notifications = readNotifications();
  notifications.unshift({
    id: Date.now().toString(),
    email,
    message,
    reportId: reportId || null,
    read: false,
    createdAt: new Date().toISOString()
  });
  writeNotifications(notifications);
}

// --- Web Push setup ---
// Generates a VAPID key pair the first time the server runs, and reuses it after
// that (saved to data/vapid-keys.json). This is what lets the server send real
// browser/OS push notifications, even when the app isn't open.
function getOrCreateVapidKeys() {
  const existing = readJSON(VAPID_FILE, null);
  if (existing && existing.publicKey && existing.privateKey) return existing;

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pubJwk = publicKey.export({ format: 'jwk' });
  const privJwk = privateKey.export({ format: 'jwk' });

  const rawPublic = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(pubJwk.x, 'base64url'),
    Buffer.from(pubJwk.y, 'base64url')
  ]);

  const keys = { publicKey: rawPublic.toString('base64url'), privateKey: privJwk.d };
  writeJSON(VAPID_FILE, keys);
  console.log('Generated new VAPID keys for push notifications.');
  return keys;
}

const vapidKeys = getOrCreateVapidKeys();
webpush.setVapidDetails('mailto:admin@smartwaste.com', vapidKeys.publicKey, vapidKeys.privateKey);

// Sends a real push notification to every subscription saved for this email.
// Silently removes subscriptions that have expired or been revoked.
async function sendPushToUser(email, payload) {
  const subs = readPushSubs();
  const mine = subs.filter(s => s.email === email);
  if (mine.length === 0) return;

  const stillValid = [];
  for (const entry of subs) {
    if (entry.email !== email) { stillValid.push(entry); continue; }
    try {
      await webpush.sendNotification(entry.subscription, JSON.stringify(payload));
      stillValid.push(entry);
    } catch (err) {
      // 410/404 means the browser subscription is gone - drop it silently
    }
  }
  writePushSubs(stillValid);
}

// ================= AUTH ROUTES =================

// Sign up - creates resident accounts only (the one admin account is seeded automatically)
app.post('/api/signup', (req, res) => {
  const { name, email, password, address } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please fill in your name, email, and password.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const users = readUsers();
  const exists = users.some(u => u.email === email.toLowerCase().trim());
  if (exists) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const newUser = createUserRecord({ name, email, password, role: 'resident', address });
  users.push(newUser);
  writeUsers(users);

  res.status(201).json({ message: 'Account created. You can now sign in.' });
});

// Log in - works for both roles (resident / admin)
app.post('/api/login', (req, res) => {
  const { email, password, role } = req.body;
  const users = readUsers();
  const user = users.find(u => u.email === (email || '').toLowerCase().trim());

  if (!user || hashPassword(password || '', user.salt) !== user.hash) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  if (role && user.role !== role) {
    return res.status(403).json({ error: `This account is a '${user.role}' account, not '${role}'.` });
  }

  const token = crypto.randomBytes(24).toString('hex');
  const sessions = readSessions();
  sessions[token] = { userId: user.id, name: user.name, email: user.email, role: user.role, photoURL: user.photoURL || null };
  writeSessions(sessions);

  res.json({
    message: 'Signed in successfully.',
    token,
    user: { name: user.name, email: user.email, role: user.role, address: user.address || '', photoURL: user.photoURL || null }
  });
});

// Log out
app.post('/api/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  const sessions = readSessions();
  if (token && sessions[token]) {
    delete sessions[token];
    writeSessions(sessions);
  }
  res.json({ message: 'Logged out.' });
});

// Get the currently logged-in user
app.get('/api/me', requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

// Change password (any logged-in user)
app.post('/api/change-password', requireAuth(), (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Please fill in all fields.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const users = readUsers();
  const user = users.find(u => u.email === req.user.email);

  if (!user || hashPassword(currentPassword, user.salt) !== user.hash) {
    return res.status(401).json({ error: 'Your current password is incorrect.' });
  }

  const newSalt = crypto.randomBytes(16).toString('hex');
  user.salt = newSalt;
  user.hash = hashPassword(newPassword, newSalt);
  writeUsers(users);

  res.json({ message: 'Password updated successfully.' });
});

// --- Forgot / Reset password ---
// NOTE: this demo version does not send a real email (that needs an SMTP/email
// service and credentials). Instead it returns a reset link directly in the
// response so you can test the flow end-to-end. In a real deployment you would
// email this link to the user instead of showing it on screen.
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  const users = readUsers();
  const user = users.find(u => u.email === (email || '').toLowerCase().trim());

  // Always respond the same way whether or not the email exists, so people
  // can't use this endpoint to guess which emails are registered.
  if (!user) {
    return res.json({ message: 'If that email is registered, a reset link has been generated.' });
  }

  const token = crypto.randomBytes(20).toString('hex');
  const resets = readResets();
  resets[token] = { email: user.email, expiresAt: Date.now() + 30 * 60 * 1000 }; // 30 minutes
  writeResets(resets);

  res.json({
    message: 'If that email is registered, a reset link has been generated.',
    devResetLink: `/reset-password.html?token=${token}` // shown for demo purposes only
  });
});

app.post('/api/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  const resets = readResets();
  const entry = token && resets[token];

  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const users = readUsers();
  const user = users.find(u => u.email === entry.email);
  if (!user) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  const newSalt = crypto.randomBytes(16).toString('hex');
  user.salt = newSalt;
  user.hash = hashPassword(newPassword, newSalt);
  writeUsers(users);

  delete resets[token];
  writeResets(resets);

  res.json({ message: 'Password reset successfully. You can now sign in.' });
});

// Keep active sessions in sync when a user's name/photo changes
function syncSessionsForUser(email, patch) {
  const sessions = readSessions();
  Object.keys(sessions).forEach(token => {
    if (sessions[token].email === email) {
      Object.assign(sessions[token], patch);
    }
  });
  writeSessions(sessions);
}

// Update profile info (name, address)
app.post('/api/update-profile', requireAuth(), (req, res) => {
  const { name, address } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name cannot be empty.' });
  }

  const users = readUsers();
  const user = users.find(u => u.email === req.user.email);
  if (!user) return res.status(404).json({ error: 'Account not found.' });

  user.name = name.trim();
  user.address = (address || '').trim();
  writeUsers(users);

  syncSessionsForUser(user.email, { name: user.name });

  res.json({
    message: 'Profile updated.',
    user: { name: user.name, email: user.email, role: user.role, address: user.address, photoURL: user.photoURL }
  });
});

// Update profile picture
app.post('/api/update-profile-picture', requireAuth(), upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo was uploaded.' });

  const users = readUsers();
  const user = users.find(u => u.email === req.user.email);
  if (!user) return res.status(404).json({ error: 'Account not found.' });

  user.photoURL = '/uploads/' + req.file.filename;
  writeUsers(users);

  syncSessionsForUser(user.email, { photoURL: user.photoURL });

  res.json({ message: 'Profile picture updated.', photoURL: user.photoURL });
});

// Get full profile (name, email, role, address, photoURL)
app.get('/api/my-profile', requireAuth(), (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.email === req.user.email);
  if (!user) return res.status(404).json({ error: 'Account not found.' });

  res.json({
    name: user.name, email: user.email, role: user.role,
    address: user.address || '', photoURL: user.photoURL || null
  });
});

// ================= REPORT ROUTES =================

// 1. POST /api/reports -> submit a new report (open to guests too, but attaches
//    the logged-in user's details automatically if a session token is sent)
app.post('/api/reports', upload.single('photo'), (req, res) => {
  const { description, latitude, longitude, reporterName, address, wasteType, reportType } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Location is required.' });
  }

  const user = optionalAuth(req);
  const reports = readReports();

  const newReport = {
    id: Date.now().toString(),
    description: description || '',
    address: address || '',
    latitude,
    longitude,
    wasteType: wasteType || 'General waste',
    reportType: reportType || 'waste', // 'waste' | 'illegal-dumping'
    reporterName: user ? user.name : (reporterName || 'Anonymous'),
    reporterEmail: user ? user.email : null,
    photo: req.file ? '/uploads/' + req.file.filename : null,
    status: 'pending', // pending -> in-progress -> resolved
    dateReported: new Date().toISOString()
  };

  reports.unshift(newReport);
  writeReports(reports);

  res.status(201).json({ message: 'Your report has been received. Thank you!', report: newReport });
});

// 2. GET /api/reports -> admin views all reports
app.get('/api/reports', requireAuth('admin'), (req, res) => {
  res.json(readReports());
});

// 2b. GET /api/reports/:id -> view a single report (owner resident or admin)
app.get('/api/reports/:id', requireAuth(), (req, res) => {
  const report = readReports().find(r => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  if (req.user.role !== 'admin' && report.reporterEmail !== req.user.email) {
    return res.status(403).json({ error: 'You do not have permission to view this report.' });
  }
  res.json(report);
});

// 3. PATCH /api/reports/:id -> admin updates a report's status
app.patch('/api/reports/:id', requireAuth('admin'), (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'in-progress', 'resolved'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const reports = readReports();
  const report = reports.find(r => r.id === req.params.id);

  if (!report) {
    return res.status(404).json({ error: 'Report not found.' });
  }

  const previousStatus = report.status;
  report.status = status;
  writeReports(reports);

  // Notify the resident that submitted the report, if we know who they are
  if (report.reporterEmail && previousStatus !== status) {
    const message = `Your report "${report.address || report.wasteType || 'waste report'}" is now ${status}.`;
    notifyUser(report.reporterEmail, message, report.id);
    sendPushToUser(report.reporterEmail, {
      title: 'SmartWaste update',
      body: message,
      url: `/report-detail.html?id=${report.id}`
    }).catch(() => {});
  }

  res.json({ message: 'Status updated.', report });
});

// 4. DELETE /api/reports/:id -> admin deletes a report
app.delete('/api/reports/:id', requireAuth('admin'), (req, res) => {
  let reports = readReports();
  const exists = reports.some(r => r.id === req.params.id);

  if (!exists) {
    return res.status(404).json({ error: 'Report not found.' });
  }

  reports = reports.filter(r => r.id !== req.params.id);
  writeReports(reports);

  res.json({ message: 'Report deleted.' });
});

// 5. GET /api/stats -> quick summary for the admin dashboard
app.get('/api/stats', requireAuth('admin'), (req, res) => {
  const reports = readReports();
  res.json({
    total: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    inProgress: reports.filter(r => r.status === 'in-progress').length,
    resolved: reports.filter(r => r.status === 'resolved').length
  });
});

// 6. GET /api/my-reports -> a resident's own reports only
app.get('/api/my-reports', requireAuth('resident'), (req, res) => {
  const reports = readReports().filter(r => r.reporterEmail === req.user.email);
  res.json(reports);
});

// 7. GET /api/my-stats -> a resident's personal stats (for the Home screen)
app.get('/api/my-stats', requireAuth('resident'), (req, res) => {
  const mine = readReports().filter(r => r.reporterEmail === req.user.email);
  res.json({
    total: mine.length,
    pending: mine.filter(r => r.status === 'pending').length,
    inProgress: mine.filter(r => r.status === 'in-progress').length,
    resolved: mine.filter(r => r.status === 'resolved').length
  });
});

// 8. GET /api/map-reports -> lightweight fields for the Map View (any logged-in user)
app.get('/api/map-reports', requireAuth(), (req, res) => {
  const reports = readReports().map(r => ({
    id: r.id,
    description: r.description,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    status: r.status,
    reportType: r.reportType,
    wasteType: r.wasteType,
    dateReported: r.dateReported
  }));
  res.json(reports);
});

// ================= NOTIFICATION ROUTES =================

// GET /api/notifications -> a resident's notifications
app.get('/api/notifications', requireAuth('resident'), (req, res) => {
  const mine = readNotifications().filter(n => n.email === req.user.email);
  res.json(mine);
});

// GET /api/notifications/unread-count
app.get('/api/notifications/unread-count', requireAuth('resident'), (req, res) => {
  const count = readNotifications().filter(n => n.email === req.user.email && !n.read).length;
  res.json({ count });
});

// POST /api/notifications/mark-read -> mark all of the resident's notifications as read
app.post('/api/notifications/mark-read', requireAuth('resident'), (req, res) => {
  const notifications = readNotifications();
  notifications.forEach(n => { if (n.email === req.user.email) n.read = true; });
  writeNotifications(notifications);
  res.json({ message: 'Notifications marked as read.' });
});

// ================= PUSH NOTIFICATIONS (real browser/OS notifications) =================

// The client needs this public key to subscribe via the browser's Push API
app.get('/api/push/public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// Save a subscription so the server can push to this device later
app.post('/api/push/subscribe', requireAuth(), (req, res) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription.' });
  }

  const subs = readPushSubs();
  const withoutThisDevice = subs.filter(s => s.subscription.endpoint !== subscription.endpoint);
  withoutThisDevice.push({ email: req.user.email, subscription });
  writePushSubs(withoutThisDevice);

  res.json({ message: 'Push notifications enabled on this device.' });
});

// Remove a subscription (e.g. the user turned notifications off)
app.post('/api/push/unsubscribe', requireAuth(), (req, res) => {
  const { endpoint } = req.body;
  const subs = readPushSubs().filter(s => s.subscription.endpoint !== endpoint);
  writePushSubs(subs);
  res.json({ message: 'Push notifications disabled on this device.' });
});

// ================= ADMIN: USER MANAGEMENT =================

// GET /api/users -> admin views all resident accounts, with their report counts
app.get('/api/users', requireAuth('admin'), (req, res) => {
  const users = readUsers().filter(u => u.role === 'resident');
  const reports = readReports();
  const list = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    createdAt: u.createdAt,
    reportCount: reports.filter(r => r.reporterEmail === u.email).length
  }));
  res.json(list);
});

// DELETE /api/users/:id -> admin removes a resident account
app.delete('/api/users/:id', requireAuth('admin'), (req, res) => {
  const users = readUsers();
  const target = users.find(u => u.id === req.params.id);

  if (!target) {
    return res.status(404).json({ error: 'User not found.' });
  }
  if (target.role === 'admin') {
    return res.status(403).json({ error: 'Admin accounts cannot be deleted from here.' });
  }

  const remaining = users.filter(u => u.id !== req.params.id);
  writeUsers(remaining);

  res.json({ message: 'User account deleted.' });
});

// --- Start server ---
seedDefaultAdmin();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Sign in page: http://localhost:${PORT}/login.html`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin.html`);
});
