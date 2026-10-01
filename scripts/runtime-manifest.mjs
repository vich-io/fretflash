import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, posix } from 'node:path';

const root = new URL('../', import.meta.url);
const entry = 'index.html';
const safe = path => typeof path === 'string' && path !== '' && !path.startsWith('/') && !path.includes('\\') && path.split('/').every(part => part !== '.' && part !== '..' && part !== '');

export async function runtimeFiles() {
  const manifest = JSON.parse(await readFile(new URL('../runtime-files.json', import.meta.url), 'utf8'));
  const files = manifest.files;
  if (!Array.isArray(files) || files.some(path => !safe(path)) || new Set(files).size !== files.length || files[0] !== entry) {
    throw new Error('runtime-files.json must contain unique safe relative paths starting with index.html');
  }
  return files;
}

function references(file, source) {
  const refs = [];
  if (extname(file) === '.html') {
    for (const match of source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) refs.push(match[1]);
    // Sharing crawlers use absolute image URLs, but the image is a shipped local asset.
    for (const match of source.matchAll(/<meta\b[^>]*(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']https:\/\/fretflash\.vich\.io\/([^"']+)["']/g)) refs.push('/' + match[1]);
  } else if (extname(file) === '.css') {
    for (const match of source.matchAll(/\burl\(\s*["']?([^\s)'" ]+)["']?\s*\)|@import\s*["']([^"']+)["']/g)) refs.push(match[1] || match[2]);
  } else if (extname(file) === '.js') {
    for (const match of source.matchAll(/\b(?:import|export)\s*(?:[\s\S]*?\s+from\s*)?["'](\.[^"']+)["']|\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/g)) refs.push(match[1] || match[2]);
    // The renderer emits an image URL as HTML rather than a module import.
    for (const match of source.matchAll(/["'](assets\/(?:fonts|icons|voice)\/[^"'\s<>]+)["']/g)) refs.push('/' + match[1]);
  }
  return refs.filter(ref => !/^(?:https?:|data:|#|mailto:)/i.test(ref)).map(ref => {
    const resolved = ref.startsWith('/') ? ref.slice(1) : posix.normalize(posix.join(dirname(file), ref));
    if (!safe(resolved)) throw new Error(`Unsafe runtime reference ${file}: ${ref}`);
    return resolved;
  });
}

export async function checkRuntimeGraph() {
  const files = await runtimeFiles();
  const declared = new Set(files);
  const visited = new Set();
  async function visit(path) {
    if (visited.has(path)) return;
    visited.add(path);
    if (!declared.has(path)) throw new Error(`Unlisted runtime graph asset: ${path}`);
    const url = new URL(path, root);
    if (!(await stat(url)).isFile()) throw new Error(`Not a runtime file: ${path}`);
    if (/\.(?:html|css|js)$/.test(path)) {
      const source = await readFile(url, 'utf8');
      for (const child of references(path, source)) await visit(child);
    }
  }
  await visit(entry);
  for (const file of files) {
    if (!visited.has(file)) throw new Error(`Manifest entry outside runtime graph: ${file}`);
  }
  return files;
}
