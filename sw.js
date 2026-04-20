// Y3S Service Worker v4 — forces cache refresh
const CACHE = 'y3s-v4';
const CORE  = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('anthropic.com')) return;
  if (e.request.url.includes('paystack')) return;
  if (e.request.url.includes('railway.app')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request)
        .then(resp => {
          if (e.request.method === 'GET' && resp.status === 200) {
            var clone = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match('/') || caches.match('/index.html'));
    })
  );
});

self.addEventListener('push', e => {
  var data = e.data ? e.data.json() : { title: 'Y3S', body: "Check in today — protect your streak!" };
  e.waitUntil(
    self.registration.showNotification(data.title || 'Y3S', {
      body: data.body || "Your financial freedom journey continues today 🔥",
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: '/' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data && e.notification.data.url || '/'));
});
