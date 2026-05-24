const CACHE_NAME = 'dairy-chain-v13';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/favicon.ico',
];

const offlineJsonResponse = () =>
  new Response(JSON.stringify({ offline: true, error: 'Network unavailable' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });

const offlineHtmlResponse = () =>
  new Response(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body><h1>Offline</h1><p>Please connect to the internet to load this page for the first time.</p></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );

const offlineAssetResponse = () =>
  new Response('Asset unavailable offline', {
    status: 503,
    statusText: 'Service Unavailable',
  });

const isNavigationRequest = (request) =>
  request.mode === 'navigate' ||
  (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));

const isApiRequest = (url) => url.pathname.startsWith('/api');

const getCachedIndexHtml = async () => {
  const cached =
    (await caches.match('/index.html')) ||
    (await caches.match('/'));
  return cached || offlineHtmlResponse();
};

const handleNavigation = async (request) => {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      return networkResponse;
    }
    const cached = await getCachedIndexHtml();
    if (cached && cached.status !== 503) {
      return cached;
    }
    return networkResponse || offlineHtmlResponse();
  } catch {
    return getCachedIndexHtml();
  }
};

const handleApi = async (request) => {
  try {
    return await fetch(request);
  } catch {
    return offlineJsonResponse();
  }
};

const handleStatic = async (request, cache) => {
  try {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
        })
        .catch(() => {});
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // SPA route requests (e.g. /login) that are not mode=navigate still need index.html
    if (isNavigationRequest(request)) {
      return getCachedIndexHtml();
    }

    return offlineAssetResponse();
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        PRECACHE_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn('[SW] precache failed:', asset, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : undefined)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        if (isNavigationRequest(request)) {
          return await handleNavigation(request);
        }

        if (isApiRequest(url)) {
          return await handleApi(request);
        }

        const cache = await caches.open(CACHE_NAME);
        return await handleStatic(request, cache);
      } catch (err) {
        console.error('[SW] fetch handler error:', err);

        if (isApiRequest(url)) {
          return offlineJsonResponse();
        }

        if (isNavigationRequest(request)) {
          return getCachedIndexHtml();
        }

        return offlineAssetResponse();
      }
    })()
  );
});
