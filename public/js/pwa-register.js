// pwa-register.js
// Registers the service worker so the app can be installed and (later)
// receive push notifications. Safe to include on every page.

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
