// Y3S Service Worker v7
// Handles offline caching + scheduled phone notifications

const C = 'y3s-v7';
const ASSETS = ['./', './index.html', './manifest.json'];

// ── Install: cache core assets ───────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(C)
      .then(cache => Promise.allSettled(ASSETS.map(a => cache.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ─────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== C).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for app, network-first for API ───
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
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

// ── Notification click: open/focus app ──────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tag = e.notification.tag || '';
  const url = tag.includes('journey') || tag.includes('streak')
    ? '/?page=journey'
    : tag.includes('fire') ? '/?page=calculator' : '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      for (let i = 0; i < cs.length; i++) {
        if ('focus' in cs[i]) return cs[i].focus();
      }
      return clients.openWindow(url);
    })
  );
});

// ── Message from app: show a notification now ───────────
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = e.data;
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag || 'y3s',
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: false
    });
  }
});

// ── Push (for future server-sent push) ──────────────────
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : { title: 'Y3S', body: 'Check your financial journey' };
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || 'y3s',
      vibrate: [200, 100, 200]
    })
  );
});
