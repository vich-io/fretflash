import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRuntimeGraph } from './runtime-manifest.mjs';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const allowed = new Set(await checkRuntimeGraph());
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain', '.png': 'image/png', '.wav': 'audio/wav' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/index.html') { response.writeHead(301, { Location: '/' }).end(); return; }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep) || !allowed.has(relative)) throw new Error('outside runtime graph');
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
server.listen(4178, '127.0.0.1', () => console.log('FretFlash browser fixture ready at http://127.0.0.1:4178/'));
