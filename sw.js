// Y3S Service Worker v8 — Persistent notifications via SW
// The SW runs independently of the app tab, so timers here survive tab close

const C = 'y3s-v8';
const ASSETS = ['./', './index.html', './manifest.json'];

// ── Install ──────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(C)
      .then(cache => Promise.allSettled(ASSETS.map(a => cache.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== C).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for app, network-first for API ────
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
      const fresh = fetch(e.request)
        .then(res => {
          if (res && res.status === 200)
            caches.open(C).then(cache => cache.put(e.request, res.clone()));
          return res;
        })
        .catch(() => cached || caches.match('./index.html'));
      return cached || fresh;
    })
  );
});

// ── Notification click: open/focus app ───────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tag = e.notification.tag || '';
  const url = tag.includes('journey') || tag.includes('streak')
    ? '/?page=journey'
    : tag.includes('fire') ? '/?page=calculator' : '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      for (let c of cs) { if ('focus' in c) return c.focus(); }
      return clients.openWindow(url);
    })
  );
});

// ── Message from app ─────────────────────────────────────
// App sends: { type: 'INIT_NOTIFICATIONS', userData: {...} }
// SW stores user data and starts its own notification scheduler

let userData = null; // Stored user info for personalised messages

self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'INIT_NOTIFICATIONS') {
    // Store user data for personalised notifications
    userData = e.data.userData || {};
    // Start the SW-side scheduler
    startNotificationScheduler();
    // Confirm back to app
    e.source && e.source.postMessage({ type: 'NOTIFICATIONS_READY' });
  }

  if (e.data.type === 'SHOW_NOTIFICATION') {
    // Direct show from app (fallback)
    showNotif(e.data.title, e.data.body, e.data.tag || 'y3s');
  }

  if (e.data.type === 'UPDATE_USER_DATA') {
    userData = e.data.userData || {};
  }
});

// ── SW-side notification scheduler ───────────────────────
// Checks every minute — works even when app tab is closed

let schedulerStarted = false;

function startNotificationScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  setInterval(function() {
    const now = new Date();
    const hr = now.getHours();
    const min = now.getMinutes();
    const today = now.toDateString();

    // 7:00 AM — Morning motivation
    if (hr === 7 && min === 0) {
      const key = 'morning_' + today;
      if (!swStorage[key]) {
        swStorage[key] = true;
        const msg = getMorningMsg();
        showNotif(msg.title, msg.body, 'y3s-morning');
      }
    }

    // 1:00 PM — Midday check-in
    if (hr === 13 && min === 0) {
      const key = 'midday_' + today;
      if (!swStorage[key]) {
        swStorage[key] = true;
        const msg = getMiddayMsg();
        showNotif(msg.title, msg.body, 'y3s-midday');
      }
    }

    // 8:00 PM — Evening streak guard
    if (hr === 20 && min === 0) {
      const key = 'evening_' + today;
      if (!swStorage[key]) {
        swStorage[key] = true;
        const msg = getEveningMsg();
        showNotif(msg.title, msg.body, 'y3s-evening');
      }
    }

  }, 60000); // Check every 60 seconds
}

// Simple in-memory storage (resets when SW restarts, but that's OK)
const swStorage = {};

function showNotif(title, body, tag) {
  self.registration.showNotification(title, {
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: tag || 'y3s',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: false
  });
}

function getName() {
  return (userData && userData.name) ? userData.name.split(' ')[0] : 'Freedom Seeker';
}
function getDay() { return (userData && userData.habit_day) || 1; }
function getStreak() { return (userData && userData.streak) || 0; }

function getMorningMsg() {
  const name = getName(), day = getDay(), streak = getStreak();
  const msgs = [
    { title: 'Good morning, ' + name + ' \uD83D\uDD25', body: 'Day ' + day + ' of your 90-day journey. Your FIRE goal is waiting. Start strong.' },
    { title: 'Rise & Build, ' + name, body: 'Your ' + streak + '-day streak is alive. 10 minutes of Y3S compounds into millions.' },
    { title: 'Day ' + day + '/90 — ' + name, body: (day < 45 ? 'Building momentum!' : 'Past the halfway mark!') + ' Log your check-in today.' }
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function getMiddayMsg() {
  const name = getName(), day = getDay(), streak = getStreak();
  const msgs = [
    { title: 'Midday check-in, ' + name, body: 'Day ' + day + ' is half done. Logged your habits yet? Streak: ' + streak + ' days.' },
    { title: 'Y3S — quick check, ' + name + '?', body: '2 minutes to log Day ' + day + ' and keep your plan on track.' }
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function getEveningMsg() {
  const name = getName(), day = getDay(), streak = getStreak();
  const msgs = [
    { title: 'Evening nudge, ' + name, body: 'Day ' + day + ' is almost done. Log before midnight to protect your ' + streak + '-day streak.' },
    { title: name + ', your streak needs you', body: streak + ' days strong. 2 minutes to log Day ' + day + ' in Y3S.' },
    { title: 'Do not let Day ' + day + ' slip', body: name + ', log your habits before you sleep tonight.' }
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}
