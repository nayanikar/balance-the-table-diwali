import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });

/** @param {string} filePath */
function readCssFlat(filePath) {
  const dir = path.dirname(filePath);
  let css = fs.readFileSync(filePath, 'utf8');
  css = css.replace(/@import\s+["']([^"']+)["']\s*;/g, (_match, rel) => {
    return readCssFlat(path.resolve(dir, rel));
  });
  return css;
}

const bttCss = readCssFlat(path.join(root, 'src/styles.css'));
const rsvpCss = readCssFlat(path.join(root, 'src/rsvp-attendance.css'));

await esbuild.build({
  entryPoints: [path.join(root, 'src/balance-the-table.js')],
  bundle: true,
  format: 'esm',
  outfile: path.join(distDir, 'balance-the-table.js'),
  define: {
    BTT_INLINE_CSS: JSON.stringify(bttCss),
  },
  banner: {
    js: '/* Balance the Table embed bundle */',
  },
});

await esbuild.build({
  entryPoints: [path.join(root, 'src/rsvp-attendance.js')],
  bundle: true,
  format: 'esm',
  outfile: path.join(distDir, 'rsvp-attendance.js'),
  define: {
    RSVP_INLINE_CSS: JSON.stringify(rsvpCss),
  },
  banner: {
    js: '/* RSVP Step 1 embed bundle */',
  },
});

const embedHtml = `<!doctype html>
<!-- Paste into your RSVP page (adjust event-id and api). Host fonts load from Google. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Patrick+Hand&display=swap" rel="stylesheet">
<balance-the-table
  event-id="diwali-2026"
  api="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
  step-label="RSVP · step 2 of 3">
</balance-the-table>
<script type="module" src="./balance-the-table.js"></script>
`;

const embedStep1Html = `<!doctype html>
<!-- RSVP Step 1 — paste before step 2 embed. Toggle step 2 visibility on rsvp:status. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Patrick+Hand&display=swap" rel="stylesheet">
<form id="rsvp">
  <rsvp-attendance
    event-id="diwali-2026"
    step-label="RSVP · step 1 of 3">
  </rsvp-attendance>
  <!-- Add balance-the-table here; hide until attending -->
</form>
<script type="module" src="./rsvp-attendance.js"></script>
`;

fs.writeFileSync(path.join(distDir, 'embed.html'), embedHtml);
fs.writeFileSync(path.join(distDir, 'embed-step1.html'), embedStep1Html);
console.log('Built dist/balance-the-table.js, dist/rsvp-attendance.js, embed.html, embed-step1.html');
