import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { buildWorker, versionRuntime } from '../../scripts/offline-release.mjs';

export function release(version, { delay = 0, ignoreActivation = false } = {}) {
  const names = JSON.parse(readFileSync('runtime-files.json')).files;
  const files = versionRuntime(new Map(names.map(name => [name, readFileSync(name)])), version);
  files.set('index.html', Buffer.from(files.get('index.html').toString().replace(/<title>[^<]*<\/title>/, `<title>FretFlash ${version}</title>`)));
  if (delay || ignoreActivation) {
    const source = files.get('sw.js').toString();
    if (!source.includes('event.waitUntil(self.skipWaiting());')) throw new Error('Activation fixture seam changed');
    files.set('sw.js', Buffer.from(source.replace('event.waitUntil(self.skipWaiting());', ignoreActivation
      ? 'return;' : `event.waitUntil(new Promise(resolve => setTimeout(resolve, ${delay})).then(() => self.skipWaiting()));`)));
  }
  files.set('sw.js', Buffer.from(buildWorker(files, version)));
  return files;
}

// A portable non-PWA fixture, not an archived release. Runtime app bytes stay untouched.
export function retiredRelease(version) {
  const files = release(version);
  files.set('src/browser/pwa.js', Buffer.from('export const setupPwa = () => ({ refresh() {} });'));
  const html = files.get('index.html').toString();
  if (!/<(?:aside|div) class="pwa-notice"[\s\S]*?<\/(?:aside|div)>/.test(html)) throw new Error('Maintenance fixture seam changed');
  files.set('index.html', Buffer.from(html.replace(/<(?:aside|div) class="pwa-notice"[\s\S]*?<\/(?:aside|div)>/, '')));
  files.set('sw.js', readFileSync('scripts/retire-service-worker.js'));
  return files;
}

// Service-worker requests bypass page.route. Use real, isolated loopback HTTP.
export async function serveRelease(initial) {
  let files = initial;
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path === '/index.html') { response.writeHead(301, { Location: '/' }).end(); return; }
    const name = path === '/' ? 'index.html' : path.slice(1), bytes = files.get(name);
    const type = { js: 'text/javascript', css: 'text/css', html: 'text/html', json: 'application/json', png: 'image/png', svg: 'image/svg+xml', woff2: 'font/woff2', wav: 'audio/wav', txt: 'text/plain' }[name.split('.').pop()];
    response.writeHead(bytes ? 200 : 404, { 'Content-Type': type ?? 'text/plain', 'Cache-Control': 'no-store' });
    response.end(bytes ?? 'Not found');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/`, set: next => { files = next; },
    close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
