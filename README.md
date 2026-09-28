# Smart Community Waste Management and Illegal Dumping Reporting System

Final year project by Ibrahim Hamisu.

## How it works

- **`public/login.html`** — sign in (resident or admin)
- **`public/signup.html`** — resident sign up
- **`public/forgot-password.html`** / **`reset-password.html`** — password recovery (demo mode: the reset link is shown on screen instead of emailed, since no email service is configured)
- **`public/index.html`** — resident Home dashboard (quick stats, quick actions, notification bell)
- **`public/report.html`** — report a waste or illegal dumping issue (photo + type + location)
- **`public/my-reports.html`** — a resident's own reports, filterable by status
- **`public/report-detail.html`** — full detail view of a single report, with a map pin
- **`public/map.html`** — map view of all reports (color-coded by status/type)
- **`public/notifications.html`** — a resident's notifications (sent when an admin updates a report's status)
- **`public/profile.html`** — account info, dark/light theme toggle, change password, about, logout
- **`public/admin.html`** — admin dashboard: stats, charts, search, CSV export, status updates
- **`public/users.html`** — admin: view and manage resident accounts
- **`public/about.html`** — about the app
- **`server.js`** — the backend. Handles authentication, reports, notifications, and user management, and stores everything in the `data/` folder as JSON files (no separate database server required).
- **`data/`** — JSON "database" files (reports, users, sessions, password resets, notifications)

## How to run it in VS Code / any computer

```bash
cd waste-management
npm install
npm start
```

Then open a browser to `http://localhost:3000` — it will redirect you to the sign-in page if you're not logged in.

## How to run it in Termux

```bash
cd waste-management
pkg install nodejs
npm install
npm start
```

## Default accounts

- **Admin:** `admin@smartwaste.com` / `admin123` (change this before a real deployment!)
- **Resident:** create your own via the Sign Up page.

## Full page structure

| Page | File | Who can access it |
|---|---|---|
| Sign in | `/login.html` | Everyone |
| Sign up | `/signup.html` | Everyone |
| Forgot / reset password | `/forgot-password.html`, `/reset-password.html` | Everyone |
| Home dashboard | `/index.html` | Resident (after login) |
| Report waste/dumping | `/report.html` | Resident |
| My Reports | `/my-reports.html` | Resident |
| Report Detail | `/report-detail.html` | Resident (own reports) / Admin |
| Notifications | `/notifications.html` | Resident |
| Map View | `/map.html` | Resident or Admin |
| Profile | `/profile.html` | Resident or Admin |
| Admin Dashboard | `/admin.html` | Admin only |
| Manage Users | `/users.html` | Admin only |
| About | `/about.html` | Everyone |

## Features implemented (v1.3)

- Resident and Admin authentication (sign up, login, logout)
- Report submission with photo, waste type, geolocation, and description
- Admin dashboard with live stats, trend chart, and report-type chart
- Status tracking: pending → in-progress → resolved
- Map View with color-coded markers (Leaflet.js)
- My Reports with status filtering and a full Report Detail page
- In-app notifications when a report's status changes
- Dark / light theme, saved per device
- Change password, and a demo-mode "forgot password" flow
- Admin: search reports, export all reports to CSV, and manage resident accounts

## v1.4 — design refresh + personalization

- **Edit Profile** — change your name, upload a profile picture, add a residential address (`/edit-profile.html`)
- **Font size** — Small / Medium / Large, in Profile settings
- **Language** — English / Hausa toggle (infrastructure in `public/js/translations.js`; currently applied to Login, Signup, Home, and Profile — extend to more pages by adding `data-i18n="key"` attributes and matching entries in the dictionary)
- **Privacy Policy** and **Terms & Conditions** pages, linked from Profile
- **Report location, two ways:** "I'm at the location" (GPS) or "Different location" (tap a pin on an embedded map)
- **Dark mode text-visibility bug fixed** — input fields, dropdowns, and photo upload box now use theme-aware colors instead of a hardcoded light background
- **Glassmorphism design** — frosted-glass cards, topbar, and bottom nav with backdrop blur
- **Professional SVG icons** replace emoji throughout the app
- **Admin nav** is now a collapsible dropdown menu (tap the ☰ icon) instead of a row of always-visible links

## v1.5 — installable app + real push notifications + smarter admin

- **Installable (PWA)** — visitors can "Add to Home Screen" / install SmartWaste like a native app (manifest + service worker + app icons in `public/icons/`)
- **Offline app shell** — core pages/styles are cached by the service worker so the app still opens without a connection (live data still needs internet)
- **Real push notifications** — toggle "Push Notifications" in Profile to get an actual system notification (even when the app/browser is closed) when a report's status changes. Uses the standard Web Push protocol; VAPID keys are auto-generated on first server start and saved to `data/vapid-keys.json` (gitignored — never commit this file, it's your server's private signing key)
- **Duplicate report detection (Admin)** — reports of the same type within ~120 meters and 5 days of each other are automatically flagged with a "⚠ Possible duplicate" badge, so admins can spot repeated reports of the same dump site at a glance

### Notes on push notifications
- Requires `npm install` to pull in the new `web-push` dependency.
- Works over `http://localhost` for local testing; a real deployment (e.g. Render) should already be HTTPS, which Push requires.
- If a browser subscription expires or is revoked, the server quietly removes it on the next failed send — no action needed.

## Suggested next steps

1. **Real email sending** for password resets (e.g. Nodemailer + an SMTP provider) instead of the on-screen demo link.
2. **Chapter 1–5 write-up** — Introduction, Literature Review, Methodology, Implementation, Conclusion.
3. **Deploy online** — e.g. Render.com or Railway.app (free tier) so anyone can use it, not just localhost.
4. **Move to a real database** (SQLite/MongoDB) if you want a more "production-grade" system instead of JSON files.
