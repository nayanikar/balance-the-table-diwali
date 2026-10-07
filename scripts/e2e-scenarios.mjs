/**
 * Playwright scenario tests (BACKEND-PLAN §6) against mock API v2.
 */
import { chromium } from 'playwright';
import { setTimeout as sleep } from 'node:timers/promises';
import { createStore } from './lib/api-v2-store.mjs';
import {
  startHarness,
  gotoApp,
  waitForBoot,
  MOCK_PORT,
  SITE_PORT,
} from './e2e-harness.mjs';

const EVENT = 'diwali-2026';

/** @param {import('playwright').Page} page */
async function attend(page, name) {
  const rsvp = page.locator('rsvp-attendance');
  await rsvp.locator('button[data-status="attending"]').click();
  const input = rsvp.locator('[data-guest-name-input]');
  await input.waitFor({ timeout: 8000 });
  await input.fill(name);
  await input.blur();
  await page.waitForFunction(() => document.getElementById('stage')?.dataset.step === '2', {
    timeout: 15000,
  });
}

/** @param {import('playwright').Page} page @param {'sav'|'swt'} pick */
async function pickSide(page, pick) {
  const btt = page.locator('balance-the-table');
  await btt.locator(`button[data-pick="${pick}"]`).click({ timeout: 8000 });
  await page.waitForFunction(() => document.getElementById('stage')?.dataset.step === '3', {
    timeout: 25000,
  });
}

/** @param {import('playwright').Page} page */
async function fullHappyPath(page, name = 'Alex', pick = 'swt') {
  await gotoApp(page, { seed: 'empty' });
  await waitForBoot(page);
  await attend(page, name);
  await pickSide(page, pick);
}

async function A3(page) {
  await gotoApp(page, { seed: 'empty' });
  await waitForBoot(page);
  await attend(page, 'FirstGuest');
  const hint = page.locator('balance-the-table').locator('text=first dish on the table');
  await hint.waitFor({ timeout: 8000 });
  await pickSide(page, 'sav');
  await page.locator('event-details').getByText('Savoury').first().waitFor();
}

async function A4(page) {
  await gotoApp(page, { seed: 'empty' });
  await waitForBoot(page);
  await page.locator('rsvp-attendance').locator('button[data-status="declined"]').click();
  const declineName = page.locator('rsvp-attendance [data-guest-name-input]');
  await declineName.waitFor({ timeout: 8000 });
  await declineName.fill('NoShow Guest');
  await declineName.blur();
  await page.locator('rsvp-attendance').locator('text=Change my RSVP').waitFor({ timeout: 10000 });
  const guestId = await page.evaluate((eid) => localStorage.getItem(`guest:${eid}:id`), EVENT);
  const api = `http://127.0.0.1:${MOCK_PORT}/exec`;
  const boot = await page.evaluate(
    async ({ api, event, guestId }) => {
      const u = new URL(api);
      u.searchParams.set('event', event);
      u.searchParams.set('guestId', guestId);
      u.searchParams.set('_seed', 'empty');
      return fetch(u).then((r) => r.json());
    },
    { api, event: EVENT, guestId },
  );
  if (boot.me?.status !== 'declined') throw new Error('A4: expected declined row');
}

async function A5(_page, harness, browser) {
  const api = harness.apiUrl;
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage({ viewport: { width: 1280, height: 800 } });
  const p2 = await ctx2.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await gotoApp(p1, { seed: 'empty' });
    await gotoApp(p2, { seed: 'empty' });
    await Promise.all([waitForBoot(p1), waitForBoot(p2)]);
    await Promise.all([attend(p1, 'ConcurrentA'), attend(p2, 'ConcurrentB')]);
    await Promise.all([pickSide(p1, 'sav'), pickSide(p2, 'swt')]);
    const dishes = await p1.evaluate(
      async ({ api, event }) => {
        const u = new URL(api);
        u.searchParams.set('event', event);
        u.searchParams.set('_seed', 'empty');
        const j = await fetch(u).then((r) => r.json());
        return j.dishes?.length ?? 0;
      },
      { api, event: EVENT },
    );
    if (dishes < 2) throw new Error(`A5: expected 2 dishes, got ${dishes}`);
  } finally {
    await ctx1.close();
    await ctx2.close();
  }
}

async function B1(page) {
  await fullHappyPath(page, 'Blake', 'swt');
  await page.locator('event-details').getByText('Sweet').first().waitFor();
}

async function B3(page) {
  await fullHappyPath(page, 'Returner', 'sav');
  await page.reload({ waitUntil: 'networkidle' });
  await waitForBoot(page);
  await page.waitForFunction(() => document.getElementById('details3')?.hidden === false, {
    timeout: 15000,
  });
}

async function B4(page) {
  await fullHappyPath(page, 'LinkGuest', 'swt');
  const guestId = await page.evaluate((eid) => localStorage.getItem(`guest:${eid}:id`), EVENT);
  const ctx2 = await page.context().browser().newContext();
  const p2 = await ctx2.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    const api = `http://127.0.0.1:${MOCK_PORT}/exec`;
    const q = new URLSearchParams({ api, _seed: 'empty', g: guestId });
    await p2.goto(`http://127.0.0.1:${SITE_PORT}/index.html?${q}`, {
      waitUntil: 'networkidle',
    });
    await p2.waitForFunction(() => document.getElementById('details3')?.hidden === false, {
      timeout: 15000,
    });
    await p2.locator('event-details').getByText('Sweet').first().waitFor();
  } finally {
    await ctx2.close();
  }
}

async function B6(page) {
  await fullHappyPath(page, 'Switcher', 'swt');
  await page.evaluate(() => {
    document.getElementById('details3')?.dispatchEvent(new CustomEvent('details:back', { bubbles: true }));
  });
  await page.waitForFunction(() => document.getElementById('btt')?.hidden === false);
  await pickSide(page, 'sav');
  await page.locator('event-details').getByText('Savoury').first().waitFor();
}

async function B7(page) {
  await fullHappyPath(page, 'Leaver', 'sav');
  await page.evaluate(() => {
    document.querySelector('event-details')?.dispatchEvent(
      new CustomEvent('details:change-rsvp', { bubbles: true }),
    );
  });
  await page.waitForFunction(() => document.getElementById('rsvp1')?.hidden === false);
  await page.locator('rsvp-attendance').locator('button[data-status="declined"]').click();
  await page.locator('rsvp-attendance').locator('text=Change my RSVP').waitFor({ timeout: 12000 });
}

async function B9(page) {
  await fullHappyPath(page, 'Priya', 'swt');
  await page.evaluate(() => {
    document.getElementById('rsvp1')?.dispatchEvent(new CustomEvent('rsvp:not-you'));
  });
  await page.waitForFunction(() => document.getElementById('rsvp1')?.hidden === false);
  await attend(page, 'Partner');
  await pickSide(page, 'sav');
}

async function B11(page) {
  await fullHappyPath(page, 'AllergyGuest', 'sav');
  await page.locator('event-details').locator('[data-action="allergies-start"]').click();
  await page.locator('event-details').locator('[data-allergies-input]').fill('Peanuts');
  await page.locator('event-details').locator('[data-allergies-input]').press('Enter');
  await page.locator('event-details').getByRole('button', { name: 'TAKEN CARE OF!' }).waitFor({
    timeout: 10000,
  });
}

async function B13(page) {
  await gotoApp(page, { seed: 'empty' });
  await waitForBoot(page);
  await attend(page, 'OfflinePick');
  const api = `http://127.0.0.1:${MOCK_PORT}/exec`;
  await page.route('**/exec**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await pickSide(page, 'swt');
  await page.locator('#sync-status').filter({ hasText: 'Saving' }).waitFor({ timeout: 15000 });
  await page.unroute('**/exec**');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await sleep(2500);
  const guestId = await page.evaluate((eid) => localStorage.getItem(`guest:${eid}:id`), EVENT);
  const me = await page.evaluate(
    async ({ api, event, guestId }) => {
      const u = new URL(api);
      u.searchParams.set('event', event);
      u.searchParams.set('guestId', guestId);
      u.searchParams.set('_seed', 'empty');
      return fetch(u).then((r) => r.json());
    },
    { api, event: EVENT, guestId },
  );
  if (me.me?.side !== 'sweet') throw new Error('B13: contribution not synced after flush');
}

async function B17() {
  const store = createStore();
  store.applySeed('empty');
  const guestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  let busy = 0;
  for (let i = 0; i < 25; i++) {
    const result = await store.post({
      action: 'rsvp',
      event: EVENT,
      guestId,
      status: 'attending',
      displayName: `Spam${i}`,
    });
    if (result?.error === 'busy') busy++;
  }
  if (busy < 1) throw new Error('B17: expected rate limit busy');
}

async function B18(page) {
  await gotoApp(page, { seed: 'host-only' });
  await waitForBoot(page);
  const json = await page.evaluate(
    async ({ api, event }) => {
      const u = new URL(api);
      u.searchParams.set('event', event);
      u.searchParams.set('_seed', 'host-only');
      return fetch(u).then((r) => r.json());
    },
    { api: `http://127.0.0.1:${MOCK_PORT}/exec`, event: EVENT },
  );
  if (json.me != null) throw new Error('B18: anonymous GET should not include me');
  for (const d of json.dishes || []) {
    if ('displayName' in d || 'guestId' in d || 'allergies' in d) {
      throw new Error('B18: dish leaked private fields');
    }
  }
}

async function C2(page) {
  await gotoApp(page, { seed: 'empty', extra: '_state=full' });
  await waitForBoot(page);
  await page.locator('rsvp-attendance').getByText('table').first().waitFor({ timeout: 8000 });
}

async function C3(page) {
  await fullHappyPath(page, 'StillHere', 'sav');
  await gotoApp(page, { seed: 'empty', extra: '_state=closed' });
  await waitForBoot(page);
  await page.waitForFunction(() => document.getElementById('details3')?.hidden === false, {
    timeout: 15000,
  });
  const hidden = await page.locator('event-details').locator('[data-action="change-rsvp"]').isHidden();
  if (!hidden) throw new Error('C3: change-rsvp should be hidden when closed');
}

async function C4(page) {
  await fullHappyPath(page, 'StaleTab', 'swt');
  await gotoApp(page, { seed: 'empty', extra: '_state=closed' });
  await waitForBoot(page);
  const guestId = await page.evaluate((eid) => localStorage.getItem(`guest:${eid}:id`), EVENT);
  const api = `http://127.0.0.1:${MOCK_PORT}/exec`;
  const post = await page.evaluate(
    async ({ api, event, guestId }) => {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'allergies',
          event,
          guestId,
          allergies: 'Nuts',
        }),
      });
      return res.json();
    },
    { api, event: EVENT, guestId },
  );
  if (post.error !== 'closed') throw new Error('C4: expected closed error');
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('btt:server-state', { detail: { state: 'closed' } }));
  });
  const hidden = await page.locator('event-details').locator('[data-action="change-rsvp"]').isHidden();
  if (!hidden) throw new Error('C4: expected read-only after closed');
}

async function C6(page) {
  await gotoApp(page, { seed: 'host-only', extra: '_state=past' });
  await waitForBoot(page);
  await page.locator('rsvp-attendance').getByText(/happened|delicious/i).waitFor({ timeout: 8000 });
}

const SCENARIOS = [
  { id: 'A3', fn: A3 },
  { id: 'A4', fn: A4 },
  { id: 'A5', fn: (p, h, b) => A5(p, h, b) },
  { id: 'B1', fn: B1 },
  { id: 'B3', fn: B3 },
  { id: 'B4', fn: B4 },
  { id: 'B6', fn: B6 },
  { id: 'B7', fn: B7 },
  { id: 'B9', fn: B9 },
  { id: 'B11', fn: B11 },
  { id: 'B13', fn: B13 },
  { id: 'B17', fn: () => B17() },
  { id: 'B18', fn: B18 },
  { id: 'C2', fn: C2 },
  { id: 'C3', fn: C3 },
  { id: 'C4', fn: C4 },
  { id: 'C6', fn: C6 },
];

async function main() {
  const harness = startHarness();
  await sleep(1200);
  let failed = 0;
  const browser = await chromium.launch({ headless: true });

  for (const scenario of SCENARIOS) {
    const context = await browser.newContext();
    const page = await context.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => console.warn(`[${scenario.id}] pageerror`, e.message));
    try {
      await scenario.fn(page, harness, browser);
      console.log(`OK ${scenario.id}`);
    } catch (err) {
      failed++;
      console.error(`FAIL ${scenario.id}:`, err.message);
    } finally {
      await context.close();
    }
  }

  await browser.close();
  await harness.stop();
  if (failed) {
    console.error(`${failed} scenario(s) failed`);
    process.exit(1);
  }
  console.log(`All ${SCENARIOS.length} scenarios passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
