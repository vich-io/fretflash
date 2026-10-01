// Rollback-only replacement for /sw.js, not part of the current runtime manifest.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('fretflash-offline-')) await caches.delete(name);
    }
    await self.registration.unregister();
  })());
});
// No fetch handler, forced reload or localStorage mutation: requests use network.
