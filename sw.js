// Y3S Service Worker v6
// Place this file at the ROOT of your GitHub Y3S-app repo (same level as index.html)
// It will be served at y3sapp.com/sw.js by Netlify

const C = 'y3s-v6';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

// Install: cache core assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(C).then(cache =>
      Promise.allSettled(ASSETS.map(a => cache.add(a).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== C).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: serve cache first, update in background
// API calls: network first, return {error:'offline'} if offline
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // API calls — network first, offline fallback
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Everything else — cache first, update in background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res && res.status === 200) {
          caches.open(C).then(cache => cache.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => cached || caches.match('./index.html'));
      return cached || fresh;
    })
  );
});

// Notification click: open/focus the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tag = e.notification.tag || '';
  const url = tag.includes('journey') || tag.includes('streak')
    ? '/?page=journey'
    : tag.includes('fire')
    ? '/?page=calculator'
    : '/?page=dashboard';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      for (var i = 0; i < cs.length; i++) {
        if ('focus' in cs[i]) return cs[i].focus();
      }
      return clients.openWindow(url);
    })
  );
});

// Push notifications
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : { title: 'Y3S', body: 'Check your financial journey' };
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || 'y3s',
      vibrate: [200, 100, 200, 100, 200]
    })
  );
});
