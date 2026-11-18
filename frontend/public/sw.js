// RideCore service worker: shows Web Push notifications (driver found,
// driver arrived, new ride request…) even when the app isn't open, and
// brings the app forward when one is tapped. It doesn't cache anything,
// so updates always come straight from the server.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { title: 'RideCore', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(message.title || 'RideCore', {
      body: message.body || '',
      tag: message.tag,
      renotify: Boolean(message.tag),
      requireInteraction: Boolean(message.requireInteraction),
      icon: '/apple-touch-icon.png',
      badge: '/apple-touch-icon.png',
      vibrate: [200, 100, 200],
      data: { url: message.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin)
    .href;
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        const open = windows.find((w) => w.url.startsWith(self.location.origin));
        return open ? open.focus() : self.clients.openWindow(url);
      }),
  );
});
