// Y3S Service Worker — Network First Strategy
// This ensures users ALWAYS get the latest version automatically
const CACHE = 'y3s-v7';
const CORE = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE))
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // Delete ALL old caches immediately
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('Y3S SW: Deleting old cache', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim()) // Take control of all tabs immediately
      .then(() => {
        // Tell all open tabs to reload so they get the new version
        return self.clients.matchAll({ type: 'window' });
      })
      .then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE });
        });
      })
  );
});

self.addEventListener('fetch', e => {
  // Never intercept these — always go direct to server
  if (e.request.url.includes('anthropic.com')) return;
  if (e.request.url.includes('railway.app')) return;
  if (e.request.url.includes('paystack')) return;
  if (e.request.url.includes('googletagmanager')) return;
  if (e.request.url.includes('analytics')) return;

  // For HTML pages — Network First (always get latest)
  if (e.request.destination === 'document' || e.request.url.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          // Cache the fresh version
          if (response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Only use cache if network fails (offline)
          return caches.match(e.request)
            || caches.match('/index.html')
            || caches.match('/');
        })
    );
    return;
  }

  // For everything else — Cache First (faster)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (e.request.method === 'GET' && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// Push notifications
self.addEventListener('push', e => {
  var data = e.data ? e.data.json() : { title: 'Y3S', body: 'Check in today!' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'Y3S', {
      body: data.body || 'Your financial freedom journey continues today 🔥',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: '/' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'));
});
