// sw.js
// Service worker: makes the app installable, caches the app shell for basic
// offline access, and displays push notifications sent from the server.

const CACHE_NAME = 'smartwaste-v1';

const APP_SHELL = [
  '/css/style.css',
  '/js/theme.js',
  '/js/fontsize.js',
  '/js/translations.js',
  '/js/auth.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// --- Install: cache the app shell ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// --- Activate: clean up old cache versions ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// --- Fetch: network-first for API calls (always want fresh data),
//     cache-first for everything else (fast + works offline) ---
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'You appear to be offline.' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((res) => {
        // Cache a copy of newly-fetched pages/assets for next time
        if (event.request.method === 'GET' && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => cached)
    )
  );
});

// --- Push: show a real system notification ---
self.addEventListener('push', (event) => {
  let data = { title: 'SmartWaste', body: 'You have a new update.' };
  try { data = event.data.json(); } catch (e) { if (event.data) data.body = event.data.text(); }

  event.waitUntil(
    self.registration.showNotification(data.title || 'SmartWaste', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/notifications.html' }
    })
  );
});

// --- Notification click: focus an open tab or open a new one ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/notifications.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
