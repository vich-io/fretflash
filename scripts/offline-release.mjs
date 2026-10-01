import { createHash } from 'node:crypto';
import { dirname, posix } from 'node:path';

const markers = /\/\/ precache:start[\s\S]*?\/\/ precache:end/;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const unversion = source => source.replace(/(\.(?:js|css|svg|woff2|wav|png|txt|json))\?v=[a-zA-Z0-9-]+/g, '$1');
const textual = name => /\.(?:html|css|js|json)$/.test(name);

export function versionRuntime(original, version) {
  const files = new Map();
  for (const [name, bytes] of original) {
    if (name === 'sw.js' || !textual(name)) { files.set(name, bytes); continue; }
    const source = unversion(bytes.toString()).replace(/(["'])([^"'\s<>]+)\1/g, (match, quote, ref) => {
      if (/^(?:[a-z]+:|#)/i.test(ref)) return match;
      const path = ref.startsWith('/') ? ref.slice(1) : ref.startsWith('assets/') ? ref : posix.normalize(posix.join(dirname(name), ref));
      // Bank metadata remains rebuildable; audio.js versions the actual fetch URL.
      if (name === 'src/voice-bank.js' || path === 'sw.js' || !original.has(path)) return match;
      return `${quote}${ref}?v=${version}${quote}`;
    });
    files.set(name, Buffer.from(source));
  }
  return files;
}

export function buildWorker(files, version) {
  const source = files.get('sw.js').toString();
  if (!markers.test(source)) throw new Error('sw.js requires one precache marker pair');
  const body = source.replace(markers, '// precache:generated');
  // Social metadata needs the preview online, not in the practice cache.
  const assets = [...files].filter(([name]) => name !== 'sw.js' && name !== 'assets/share-card.png').map(([name, bytes]) => ({
    url: name === 'index.html' ? '/' : `/${name}?v=${version}`,
    integrity: `sha256-${createHash('sha256').update(bytes).digest('base64')}`,
  })).sort((a, b) => a.url.localeCompare(b.url));
  const cacheName = `fretflash-offline-${digest(body + JSON.stringify(assets))}`;
  return source.replace(markers, `// precache:start\nconst CACHE_NAME = '${cacheName}';\nconst PRECACHE = ${JSON.stringify(assets, null, 2)};\n// precache:end`);
}

export function prepareOffline(original) {
  const normalized = [...original].filter(([name]) => name !== 'sw.js').map(([name, bytes]) => [name, textual(name) ? unversion(bytes.toString()) : bytes.toString('base64')]);
  const body = original.get('sw.js').toString().replace(markers, '// precache:generated');
  // Packaging changes can alter emitted bytes without changing authored sources.
  const version = digest(JSON.stringify(normalized) + body + versionRuntime.toString() + buildWorker.toString() + unversion.toString() + textual.toString()).slice(0, 16);
  const files = versionRuntime(original, version);
  files.set('sw.js', Buffer.from(buildWorker(files, version)));
  return { files, version };
}
