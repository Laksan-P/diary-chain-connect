const CACHE_NAME = 'dairy-chain-v2';
const OFFLINE_URL = '/index.html';

const INITIAL_CACHED_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png'
];

// On install, cache the basics
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(INITIAL_CACHED_RESOURCES);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Don't cache if not a success response or if it's a cross-origin request
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Cache successful asset requests (JS, CSS, images)
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // If fetch fails (offline) and it's a navigation request, return index.html
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});
