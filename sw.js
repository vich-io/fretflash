// precache:start
const CACHE_NAME = 'fretflash-offline-dea46a68572a1f346baf7394f4946b822acfd1af9f0f7f3159b21186c258ac8b';
const PRECACHE = [
  {
    "url": "/",
    "integrity": "sha256-qzTOHyv0rjCMMX3glBBbEpWkod4+hDjGHF905+rgmJM="
  },
  {
    "url": "/app.js?v=8f147a0a6df7dadd",
    "integrity": "sha256-G/BJ0luh9W29GXtgZ/8o0+lYGC8FzKPtADIz5vBfgXE="
  },
  {
    "url": "/assets/fonts/inter-latin-variable.woff2?v=8f147a0a6df7dadd",
    "integrity": "sha256-MQDndehhbNJhG+7PojpCY9cDdYZ4m0PwNSNqLm+9TGI="
  },
  {
    "url": "/assets/fonts/OFL.txt?v=8f147a0a6df7dadd",
    "integrity": "sha256-JiSB6ERSGzJvXs0FPlm5jIstp4yO4b27boF0MF5Uk1o="
  },
  {
    "url": "/assets/icons/fretflash-192.png?v=8f147a0a6df7dadd",
    "integrity": "sha256-d67c8MWP6XLJ07+ggB18/PmEEst6pToUlvGDOMeaADk="
  },
  {
    "url": "/assets/icons/fretflash-512.png?v=8f147a0a6df7dadd",
    "integrity": "sha256-KqAVbdM36Sr+PqMAhdYU5nkOU6uHyGtkS3CWZ1EAy0w="
  },
  {
    "url": "/assets/icons/fretflash-apple-180.png?v=8f147a0a6df7dadd",
    "integrity": "sha256-jOWKoeh+TzlR4BgQxIIw/3pDvj0rgv2kbLAPiji5CeY="
  },
  {
    "url": "/assets/icons/fretflash-maskable-512.png?v=8f147a0a6df7dadd",
    "integrity": "sha256-w0W7RCBs+8i3foZC51qM6mULCAXKO57cuWoXCH3HgXs="
  },
  {
    "url": "/assets/icons/fretflash-six-line-f.svg?v=8f147a0a6df7dadd",
    "integrity": "sha256-rgXkhkcwkRi+yFvX5UCSzGxCe6CH/0DkuSI+7hKyBLU="
  },
  {
    "url": "/assets/share-card.png?v=8f147a0a6df7dadd",
    "integrity": "sha256-NIIUesi9Lu+iGZwVOVfbTHeEVf+6gvB4LtuvRCXvMYE="
  },
  {
    "url": "/assets/voice/george-fast.wav?v=8f147a0a6df7dadd",
    "integrity": "sha256-+k+/nyGgvr8jxXmoTXyKunMz84Topd6tCyqz6QsdLQc="
  },
  {
    "url": "/assets/voice/george-tight.wav?v=8f147a0a6df7dadd",
    "integrity": "sha256-nDtuLdO4HbYLlI042xPPT4vgMaWVjVkbYUCDyeQOI6E="
  },
  {
    "url": "/assets/voice/george.wav?v=8f147a0a6df7dadd",
    "integrity": "sha256-vCoaS+dfs9D8mrGOHCU8QgbtIFG9S/uNYaAhqHGTNeM="
  },
  {
    "url": "/manifest.json?v=8f147a0a6df7dadd",
    "integrity": "sha256-t1YKf5FqdqtD+VD5GIPYBpCpdSusygRVdYAY1E+Wp8E="
  },
  {
    "url": "/src/audio.js?v=8f147a0a6df7dadd",
    "integrity": "sha256-8t2tqZ0p75GVugmBzSr95W43eHidFo4r8ZawHlzHTHA="
  },
  {
    "url": "/src/browser/numeric-gestures.js?v=8f147a0a6df7dadd",
    "integrity": "sha256-CqRfxDk2TTSCduoJ9vzQwbL9fe13GSMqkCwWpOklLfs="
  },
  {
    "url": "/src/browser/pwa.js?v=8f147a0a6df7dadd",
    "integrity": "sha256-JvpN4OuM/zVEQlzg5smJfPzENrGuCdP1JShQLmh1oyE="
  },
  {
    "url": "/src/browser/setup-drafts.js?v=8f147a0a6df7dadd",
    "integrity": "sha256-hFmXzKyKaeyA3m4EKdamFOSgRVdgBzObKbivLnKfe6A="
  },
  {
    "url": "/src/controller.js?v=8f147a0a6df7dadd",
    "integrity": "sha256-7ROsTf4ovPcWeEfgLqE2TgCcbu9omsPIQZMD8G1qHrk="
  },
  {
    "url": "/src/music.js?v=8f147a0a6df7dadd",
    "integrity": "sha256-m2XpbDkBVCP837NOrMTw9ufacpC3suENJ3ZoOSLpAyw="
  },
  {
    "url": "/src/render.js?v=8f147a0a6df7dadd",
    "integrity": "sha256-jynNe/0zs8mWGnUy6KUQMRAmwFhG7fvk/k+NtJ53+QQ="
  },
  {
    "url": "/src/round.js?v=8f147a0a6df7dadd",
    "integrity": "sha256-N3gd/Gnc+DskhXfxQSiKK5h2W3fKq2DvdlnHYevBcHA="
  },
  {
    "url": "/src/settings.js?v=8f147a0a6df7dadd",
    "integrity": "sha256-Rvkc7OOmNtge1BvM2ZcgBiErLXGDmdqkhx9jxrtkAWw="
  },
  {
    "url": "/src/speech.js?v=8f147a0a6df7dadd",
    "integrity": "sha256-nkoArV64AuV0l+HYRHe2300sEWAKNszXmG7ee0Pxkwg="
  },
  {
    "url": "/src/state.js?v=8f147a0a6df7dadd",
    "integrity": "sha256-H/SA21PofKr0IF/+y6xfnMP4nY3w/2QNvLsZuKZrmjg="
  },
  {
    "url": "/src/view-model.js?v=8f147a0a6df7dadd",
    "integrity": "sha256-Nq0dQkqUIIuuHXioByvhhPEeCmpeP0ebx7jkFsG6qr8="
  },
  {
    "url": "/src/voice-bank.js?v=8f147a0a6df7dadd",
    "integrity": "sha256-Obj5krDqxbficrgq2i15K6YSX8XqwQ9nRjq4QH9iwSs="
  },
  {
    "url": "/style.css?v=8f147a0a6df7dadd",
    "integrity": "sha256-4ifltXCNVg9OaMfip6EpLl5ECZV9BO6q23/A2I7w2J0="
  }
];
// precache:end

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
