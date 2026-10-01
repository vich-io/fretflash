import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createIdleState } from '../src/state.js';
import { getViewModel } from '../src/view-model.js';
import { renderHtml } from '../src/render.js';
import { runtimeFiles } from './runtime-manifest.mjs';
import { prepareOffline } from './offline-release.mjs';

const root = new URL('../', import.meta.url);
const start = '<!-- setup:start -->';
const end = '<!-- setup:end -->';
const helpSlot = '<div id="quick-reference-slot"></div>';

export function renderDocument(template) {
  const [before, source, extraStart] = template.split(start);
  const [help, after, extraEnd] = (source ?? '').split(end);
  if (source === undefined || after === undefined || extraStart !== undefined || extraEnd !== undefined || before.includes(end) || after.includes(end)) {
    throw new Error('Document template requires exactly one ordered setup:start/setup:end pair');
  }
  const setup = renderHtml(getViewModel(createIdleState()));
  if (setup.split(helpSlot).length !== 2) throw new Error('Setup renderer must provide exactly one quick-reference slot');
  // Only renderer-owned controls are inactive. Native disclosures and links remain usable.
  const inactive = setup.replace(/<(button|input)\b([^>]*)>/g, (tag, name, attributes) =>
    /\sdisabled(?:\s|=|$)/.test(attributes) ? tag : `<${name}${attributes} disabled>`);
  return before + inactive.replace(helpSlot, help.trim()) + after;
}

export async function prerender({ check = false } = {}) {
  const files = new Map(await Promise.all((await runtimeFiles()).map(async name => [name, await readFile(new URL(name, root))])));
  files.set('index.html', Buffer.from(renderDocument(await readFile(new URL('scripts/page-template.html', root), 'utf8'))));
  const prepared = prepareOffline(files);
  for (const [name, output] of prepared.files) {
    const destination = new URL(name, root);
    const current = await readFile(destination);
    if (check) {
      if (!current.equals(output)) throw new Error(`${name} is stale. Run npm run prerender and include the generated offline release.`);
    } else if (!current.equals(output)) {
      await writeFile(destination, output);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error('Usage: node scripts/prerender.mjs [--check]');
  await prerender({ check: args[0] === '--check' });
  console.log(args[0] === '--check' ? 'Initial setup HTML is current.' : 'Prerendered the default setup into index.html.');
}
