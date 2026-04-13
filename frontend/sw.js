const CACHE_NAME = 'flashcards-v4';

// Install — skip waiting to activate immediately
self.addEventListener('install', () => self.skipWaiting());

// Activate — clean ALL old caches and claim clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first for everything, cache as offline fallback
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls: network only, never cache
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503, headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Everything else: network first, cache fallback
  e.respondWith(
    fetch(e.request).then(res => {
      // Cache successful responses for offline use
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
