const CACHE_NAME = 'huvi-v32';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/404.html',
  '/offer.html',
  '/manual.html',
  '/manifest.json',
  '/css/design-system.css',
  '/css/components.css',
  '/css/layout.css',
  '/css/pages.css',
  '/js/config.js',
  '/js/supabase-client.js',
  '/js/auth.js',
  '/js/router.js',
  '/js/app.js',
  '/js/dashboard.js',
  '/js/offers.js',
  '/js/offer.js',
  '/js/sources.js',
  '/js/opportunities.js',
  '/js/campaigns.js',
  '/js/conversions.js',
  '/js/discovery.js',
  '/js/web-discovery.js',
  '/js/import-leads.js',
  '/js/municipios.js',
  '/js/settings.js',
  '/js/onboarding.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((r) => r || new Response('', { status: 404 }))
      )
    );
    return;
  }

  if (
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const fallback = await caches.match('/404.html');
          return fallback || new Response('Offline', { status: 503 });
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        return cached || new Response('', { status: 404, statusText: 'Not Found' });
      })
  );
});
