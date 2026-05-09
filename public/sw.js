self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Direct pass-through to network
  // This ensures the service worker doesn't stall or handle requests incorrectly
  event.respondWith(fetch(event.request));
});
