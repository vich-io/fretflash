import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const override = process.env.PREVIEW_URL || process.env.BASE_URL;
if (override) {
  const url = new URL(override);
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('PREVIEW_URL/BASE_URL must be an HTTP(S) origin root URL without path, query, hash or credentials');
  }
}
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/sbin/chromium') ? '/usr/sbin/chromium' : undefined);
export default defineConfig({
  testDir: './browser-tests',
  timeout: 30000,
  expect: { timeout: 5000 },
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: override || 'http://127.0.0.1:4178/',
    browserName: 'chromium',
    launchOptions: executablePath ? { executablePath } : {},
    trace: 'retain-on-failure',
  },
  webServer: override ? undefined : {
    command: 'node scripts/serve-fixture.mjs',
    url: 'http://127.0.0.1:4178/',
    reuseExistingServer: false,
    timeout: 15000,
  },
});
