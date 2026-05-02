const CACHE_NAME = 'dairy-chain-v12';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // We only care about GET requests
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);

  // Strategy: 
  // 1. If it's a navigation request (page load/refresh), serve the cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        // When offline, always return index.html for navigation requests
        return caches.match('/index.html')
          .then((response) => response || caches.match('/'))
          .then((response) => {
            if (response) return response;
            // Last resort: if nothing is in cache, return a simple offline page
            return new Response('<h1>Offline</h1><p>Please connect to the internet to load this page for the first time.</p>', {
              headers: { 'Content-Type': 'text/html' }
            });
          });
      })
    );
    return;
  }

  // 2. EXCLUDE API requests from caching - always go to network
  if (url.pathname.startsWith('/api')) {
    event.respondWith(fetch(request));
    return;
  }

  // 3. For everything else (JS, CSS, Images): Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Fallback if network fails and no cache
          return cachedResponse || new Response('Offline', { status: 503 });
        });

        return cachedResponse || fetchPromise;
      });
    })
  );
});
