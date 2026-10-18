// Service worker: riceve le notifiche dell'app (Web Push) e apre la bacheca quando le tocchi.
// Non mette niente in cache: l'app si carica sempre fresca dal server.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Promemoria', {
    body: d.body || '', tag: d.tag, lang: 'it',
    icon: '/icone/icona-192.png?v=2', badge: '/icone/badge-96.png?v=2',
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', self.location.origin);
  e.waitUntil((async () => {
    const finestre = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const f of finestre) {
      if (new URL(f.url).pathname === url.pathname && 'focus' in f) return f.focus();
    }
    return self.clients.openWindow(url.href);
  })());
});
