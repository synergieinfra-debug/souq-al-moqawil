const CACHE_NAME = 'souq-al-moqawil-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/404.html',
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@300;400;500;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install: pre-cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.filter(u => u.startsWith('/')));
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Supabase/API calls: Network first, no cache
// - Google Fonts/CDN: Cache first
// - App files: Stale-while-revalidate
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  var url = e.request.url;

  // Skip Supabase API calls
  if (url.includes('supabase.co') || url.includes('supabase.io')) return;

  // CDN assets: Cache first
  if (url.includes('fonts.googleapis.com') || url.includes('cdn.jsdelivr.net') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // App files: Stale-while-revalidate
  e.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(e.request).then(cached => {
        var fetchPromise = fetch(e.request).then(response => {
          if (response.ok) cache.put(e.request, response.clone());
          return response;
        }).catch(() => null);

        return cached || fetchPromise || caches.match('/index.html');
      });
    })
  );
});

// Background sync for offline messages
self.addEventListener('sync', e => {
  if (e.tag === 'sync-messages') {
    e.waitUntil(syncOfflineMessages());
  }
});

async function syncOfflineMessages() {
  // Messages queued while offline will be sent when back online
  var clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({type: 'SYNC_COMPLETE'}));
}
