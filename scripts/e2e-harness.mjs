import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE_PORT = Number(process.env.E2E_PORT) || 3458;
export { SITE_PORT as harnessPort };
export const MOCK_PORT = Number(process.env.BTT_MOCK_PORT) || 8787;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function startHarness() {
  const mock = spawn('node', ['scripts/mock-api.mjs'], {
    cwd: ROOT,
    stdio: 'pipe',
    env: { ...process.env, BTT_MOCK_PORT: String(MOCK_PORT) },
  });
  const site = spawn('python3', ['-m', 'http.server', String(SITE_PORT)], {
    cwd: ROOT,
    stdio: 'pipe',
  });
  return {
    mock,
    site,
    async stop() {
      mock.kill('SIGTERM');
      site.kill('SIGTERM');
      await sleep(200);
    },
    baseUrl: `http://127.0.0.1:${SITE_PORT}/index.html`,
    apiUrl: `http://127.0.0.1:${MOCK_PORT}/exec`,
  };
}

/** @param {import('playwright').Page} page */
export async function gotoApp(page, { seed = 'empty', extra = '' } = {}) {
  const api = `http://127.0.0.1:${MOCK_PORT}/exec`;
  const q = new URLSearchParams({ api, _seed: seed });
  if (extra) {
    for (const [k, v] of new URLSearchParams(extra)) q.set(k, v);
  }
  await page.goto(`http://127.0.0.1:${SITE_PORT}/index.html?${q}`, {
    waitUntil: 'networkidle',
  });
}

export async function waitForBoot(page, timeout = 20000) {
  await page.waitForFunction(() => window.__bttBoot != null, { timeout });
  await page.waitForFunction(
    () => {
      const e = window.__bttBoot?.lastBoot?.event;
      return e && (e.id || e.title);
    },
    { timeout },
  );
}
