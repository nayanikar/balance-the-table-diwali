/**
 * Headless E2E smoke test via Playwright (install: npx playwright install chromium)
 * Run: npm run test:e2e
 */
import { chromium } from 'playwright';
import { setTimeout as sleep } from 'node:timers/promises';
import { startHarness, gotoApp, waitForBoot } from './e2e-harness.mjs';

async function main() {
  const harness = startHarness();
  await sleep(1200);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];

  page.on('pageerror', (e) => errors.push(String(e)));

  try {
    await gotoApp(page, { seed: 'empty' });
    await waitForBoot(page);

    const card = page.locator('#rsvpCard');
    await card.waitFor({ state: 'visible' });
    const box1 = await card.boundingBox();
    if (!box1 || box1.width < 600) throw new Error('rsvp-card too narrow on load');

    const rsvp1 = page.locator('rsvp-attendance');
    await rsvp1.locator('button[data-status="attending"]').click({ timeout: 5000 });
    const nameInput = rsvp1.locator('[data-guest-name-input]');
    await nameInput.waitFor({ timeout: 5000 });
    await nameInput.fill('Alex');
    await nameInput.blur();

    await page.waitForFunction(() => document.getElementById('stage')?.dataset.step === '2');
    const box2 = await card.boundingBox();
    if (!box2) throw new Error('no card box step 2');
    if (Math.abs(box2.width - box1.width) > 2) {
      throw new Error(`card width jump step1→2: ${box1.width} → ${box2.width}`);
    }

    const btt = page.locator('balance-the-table');
    await btt.locator('button[data-pick="sav"]').click({ timeout: 5000 });

    await page.waitForFunction(
      () => document.getElementById('stage')?.dataset.step === '3',
      { timeout: 25000 },
    );

    const box3 = await card.boundingBox();
    if (!box3) throw new Error('no card box step 3');
    if (Math.abs(box3.width - box1.width) > 2) {
      throw new Error(`card width jump step1→3: ${box1.width} → ${box3.width}`);
    }

    await page.locator('event-details').getByRole('heading', { name: 'See you there!' }).waitFor();

    await page.locator('event-details').locator('[data-action="allergies-start"]').click();
    await page.locator('event-details').locator('[data-allergies-input]').fill('Peanuts');
    await page.locator('event-details').locator('[data-allergies-input]').press('Enter');
    await page.locator('event-details').getByRole('button', { name: 'TAKEN CARE OF!' }).waitFor();

    console.log('E2E OK — steps 1→2→3, card width stable, allergies flow');
    if (errors.length) {
      console.warn('Page errors:', errors);
      process.exit(1);
    }
  } finally {
    await browser.close();
    await harness.stop();
  }
}

main().catch((e) => {
  console.error('E2E FAILED:', e.message);
  process.exit(1);
});
