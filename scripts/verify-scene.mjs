#!/usr/bin/env node
/**
 * Post-build check: stick-figure module (figures.js) is bundled into dist/balance-the-table.js.
 * Run: npm run build && node scripts/verify-scene.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bundlePath = path.join(root, 'dist/balance-the-table.js');
const plateScenePath = path.join(root, 'src/plate-scene.js');

const MARKERS = ['platterSVG', 'fg-limb', 'class="fg-limb"', 'poseFor', 'export function figure'];
const LEGACY = ['function stickFigure', 'class="fig"'];

function fail(msg) {
  console.error(`verify-scene: FAIL — ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`verify-scene: OK — ${msg}`);
}

if (process.argv.includes('--build')) {
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
}

if (!fs.existsSync(bundlePath)) {
  fail(`missing ${path.relative(root, bundlePath)} — run: npm run build`);
}

const bundle = fs.readFileSync(bundlePath, 'utf8');
const plateScene = fs.readFileSync(plateScenePath, 'utf8');

const hit = MARKERS.filter((m) => bundle.includes(m));
const legacy = LEGACY.filter((m) => bundle.includes(m));
const importsFigures =
  /from\s+['"]\.\/figures\.js['"]/.test(plateScene) ||
  /from\s+['"]\.\/figures['"]/.test(plateScene);

console.log('--- bundle markers ---');
for (const m of MARKERS) {
  console.log(`  ${bundle.includes(m) ? '✓' : '·'} ${m}`);
}
console.log('--- legacy (pre-integration) ---');
for (const m of LEGACY) {
  console.log(`  ${bundle.includes(m) ? '!' : '·'} ${m}`);
}
console.log(`--- src/plate-scene.js imports figures.js: ${importsFigures ? 'yes' : 'no'} ---`);

if (hit.length === 0) {
  fail(
    `dist/balance-the-table.js has no figures.js markers (need one of: ${MARKERS.slice(0, 4).join(', ')}). ` +
      `Wire src/figures.js into src/plate-scene.js, then rebuild.`,
  );
}

if (legacy.length > 0 && hit.length > 0) {
  console.warn('verify-scene: WARN — bundle contains both new markers and legacy stickFigure markup.');
}

ok(`found ${hit.length} marker(s): ${hit.join(', ')}`);
process.exit(0);
