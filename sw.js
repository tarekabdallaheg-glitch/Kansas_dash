
const CACHE = 'kansas-premium-v2';

const APP_FILES = [
  './',
  './index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('kansas-premium-') && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (
    req.method !== 'GET' ||
    url.origin !== self.location.origin
  ) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache =>
              cache.put('./index.html', copy)
            );
          }
          return response;
        })
        .catch(async () => {
          return await caches.match('./index.html') ||
                 await caches.match('./');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache =>
            cache.put(req, copy)
          );
        }
        return response;
      });

      return cached || network;
    })
  );
});
