// precache:start
const CACHE_NAME = 'fretflash-offline-6587813641a848b8384036fc2f102e2d3807ea6753027302836384a06b503440';
const PRECACHE = [
  {
    "url": "/",
    "integrity": "sha256-59xfO8gIKUKcqsTJvpLEnqQLEMgrFUdNcPDEn7TbAqw="
  },
  {
    "url": "/app.js?v=a4ebea2a326f3f0a",
    "integrity": "sha256-DV0E8gFMxZjKKR7IDcV4Qs/NsmIwSfqkmcjM9ujh9Yc="
  },
  {
    "url": "/assets/fonts/inter-latin-variable.woff2?v=a4ebea2a326f3f0a",
    "integrity": "sha256-6F0dycojnXiMFEW4yyRoHFRcZZf+j4+loiPBFwY9lns="
  },
  {
    "url": "/assets/fonts/OFL.txt?v=a4ebea2a326f3f0a",
    "integrity": "sha256-JiSB6ERSGzJvXs0FPlm5jIstp4yO4b27boF0MF5Uk1o="
  },
  {
    "url": "/assets/icons/fretflash-192.png?v=a4ebea2a326f3f0a",
    "integrity": "sha256-d67c8MWP6XLJ07+ggB18/PmEEst6pToUlvGDOMeaADk="
  },
  {
    "url": "/assets/icons/fretflash-512.png?v=a4ebea2a326f3f0a",
    "integrity": "sha256-KqAVbdM36Sr+PqMAhdYU5nkOU6uHyGtkS3CWZ1EAy0w="
  },
  {
    "url": "/assets/icons/fretflash-apple-180.png?v=a4ebea2a326f3f0a",
    "integrity": "sha256-jOWKoeh+TzlR4BgQxIIw/3pDvj0rgv2kbLAPiji5CeY="
  },
  {
    "url": "/assets/icons/fretflash-maskable-512.png?v=a4ebea2a326f3f0a",
    "integrity": "sha256-w0W7RCBs+8i3foZC51qM6mULCAXKO57cuWoXCH3HgXs="
  },
  {
    "url": "/assets/icons/fretflash-six-line-f.svg?v=a4ebea2a326f3f0a",
    "integrity": "sha256-rgXkhkcwkRi+yFvX5UCSzGxCe6CH/0DkuSI+7hKyBLU="
  },
  {
    "url": "/assets/voice/george-fast.webm?v=a4ebea2a326f3f0a",
    "integrity": "sha256-SAhaa+CDa4R7GAMTSJw6Aaj3kql1udBYlhcsYQsyQUw="
  },
  {
    "url": "/assets/voice/george-tight.webm?v=a4ebea2a326f3f0a",
    "integrity": "sha256-P9PUaOvmTHWhQAlrCoOyBVJtQRuOI/hrdcdb1e3Jw14="
  },
  {
    "url": "/assets/voice/george.webm?v=a4ebea2a326f3f0a",
    "integrity": "sha256-QGdatWFX46N2xKlqb0kf50Y9XP0/xNYrdlErEoBhex8="
  },
  {
    "url": "/manifest.json?v=a4ebea2a326f3f0a",
    "integrity": "sha256-9NItwpO9iXXWJ1T7pnUIIxlBqIjmlCd8NSHXXbe9kqo="
  },
  {
    "url": "/src/audio.js?v=a4ebea2a326f3f0a",
    "integrity": "sha256-LikUzcQ9VPo3hPBQNfo2ypl6ndTRC2nm8Opsjkpibfc="
  },
  {
    "url": "/src/browser/numeric-gestures.js?v=a4ebea2a326f3f0a",
    "integrity": "sha256-CqRfxDk2TTSCduoJ9vzQwbL9fe13GSMqkCwWpOklLfs="
  },
  {
    "url": "/src/browser/pwa.js?v=a4ebea2a326f3f0a",
    "integrity": "sha256-TuI23TycFKdV2w67+c3bIEvtH/Dg4BGVyoelABVJreI="
  },
  {
    "url": "/src/browser/setup-drafts.js?v=a4ebea2a326f3f0a",
    "integrity": "sha256-kRXmwQnG92Gy8Gby5dqKPiHdwwmxJa/Hhgwer20RnZs="
  },
  {
    "url": "/src/controller.js?v=a4ebea2a326f3f0a",
    "integrity": "sha256-1np23OFYFq2SEzR6sHg7DkjTi+7yKyImaxq8UEl4Qsc="
  },
  {
    "url": "/src/music.js?v=a4ebea2a326f3f0a",
    "integrity": "sha256-m2XpbDkBVCP837NOrMTw9ufacpC3suENJ3ZoOSLpAyw="
  },
  {
    "url": "/src/render.js?v=a4ebea2a326f3f0a",
    "integrity": "sha256-l4m9nITrcqh4mrdMPP2bIA4b4zvyvGVTQfudbu81JZE="
  },
  {
    "url": "/src/round.js?v=a4ebea2a326f3f0a",
    "integrity": "sha256-nF7iGzvGjqdL/f8WXMvMCCFDzaNlWGIvL+Dk10/LECE="
  },
  {
    "url": "/src/settings.js?v=a4ebea2a326f3f0a",
    "integrity": "sha256-oAYxHcjZGcum0onC6o+TzIotwaH1GOnB+N2OtWa8so8="
  },
  {
    "url": "/src/speech.js?v=a4ebea2a326f3f0a",
    "integrity": "sha256-zKduM2adqToCZFqYwoxst1Km1jjqh+aN+ZcS/EZqbaw="
  },
  {
    "url": "/src/state.js?v=a4ebea2a326f3f0a",
    "integrity": "sha256-Fvz3EFlLxQoNuG1XrWUb7gbqgGQZnd2Z5DiHlPuYpMg="
  },
  {
    "url": "/src/view-model.js?v=a4ebea2a326f3f0a",
    "integrity": "sha256-Nq0dQkqUIIuuHXioByvhhPEeCmpeP0ebx7jkFsG6qr8="
  },
  {
    "url": "/src/voice-bank.js?v=a4ebea2a326f3f0a",
    "integrity": "sha256-ZQk0IhfKg7idrEelU4Ot0pgaidGKloIvr2jfKeqfXmo="
  },
  {
    "url": "/style.css?v=a4ebea2a326f3f0a",
    "integrity": "sha256-OKyjFZ14SO+Tcy3u3o4c7ALhjf4Y5S1Pgb3hA5hG9Ag="
  }
];
// precache:end

// Update-position retry release; no app or worker behavior changes.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const retained = await caches.has(CACHE_NAME);
    const cache = await caches.open(CACHE_NAME);
    try {
      // One integrity-checked batch refuses incomplete or mixed releases.
      await cache.addAll(PRECACHE.map(asset => new Request(asset.url, {
        integrity: asset.integrity, cache: 'reload', credentials: 'same-origin', redirect: 'error',
      })));
    } catch (error) {
      // Failed exact-version rollbacks must not destroy a retained valid cache.
      if (!retained) await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // A claimed controller can still serve an older open document. Retain its
    // versioned resources until an activation with no clients, not a guessed cap.
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    if (clients.length === 0) {
      for (const name of await caches.keys()) {
        if (name.startsWith('fretflash-offline-') && name !== CACHE_NAME) await caches.delete(name);
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/sw.js') return;
  const navigation = event.request.mode === 'navigate' && ['/', '/index.html'].includes(url.pathname);
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const current = await cache.match(navigation ? '/' : event.request);
    if (current) return current;
    if (!navigation) {
      for (const name of await caches.keys()) {
        if (!name.startsWith('fretflash-offline-') || name === CACHE_NAME) continue;
        const retained = await (await caches.open(name)).match(event.request);
        if (retained) return retained;
      }
    }
    return fetch(event.request);
  })());
});
