const V = 'quer-web-3.8.0-7208032b';
const SHELL = ['./', './index.html', './ios.js', './manifest.webmanifest', './icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Gehashte Dateien (JS, CSS, Schriften): einmal laden, dann aus dem Cache
  if (u.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
        const cp = res.clone();
        caches.open(V).then((c) => c.put(e.request, cp));
        return res;
      }))
    );
    return;
  }
  // Seite selbst: zuerst Netz (für Updates), offline aus dem Cache
  e.respondWith(
    fetch(e.request).then((res) => {
      const cp = res.clone();
      caches.open(V).then((c) => c.put(e.request, cp));
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});

// Vorbereitet für echte Push-Nachrichten (Treffen, Abstimmungen)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'QUER', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'QUER', {
    body: d.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: d.tag || 'quer',
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow(e.notification.data && e.notification.data.url || './');
  }));
});
