// Service Worker for Brass: Lancashire push notifications

self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Brass: Lancashire';
  const options = {
    body: data.body || '',
    icon: '/img/cotton.jpg',
    badge: '/img/coal.jpg',
    tag: data.tag || 'brass-notification',
    data: { url: data.url || '/lobby' },
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data.url || '/lobby';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      return clients.openWindow(url);
    })
  );
});
