// Service worker: avisos en el móvil (Web Push)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
    let d = {};
    try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text() }; }
    e.waitUntil(self.registration.showNotification(d.title || 'Hyper Race X1', {
        body: d.body || '',
        icon: 'img/icono-192.png',
        badge: 'img/icono-192.png',
        tag: d.tag || undefined,
        data: { url: d.url || 'escuderia.html' },
    }));
});

self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    const url = new URL(e.notification.data?.url || 'escuderia.html', self.registration.scope).href;
    e.waitUntil((async () => {
        const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const misma = abiertas.find(c => c.url.startsWith(self.registration.scope));
        if (misma) { await misma.focus(); return misma.navigate(url); }
        return self.clients.openWindow(url);
    })());
});
