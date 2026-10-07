# Go live — Balance the Table

Checklist to run a real potluck on Google Sheets + Apps Script, with this frontend.

**Before you start:** [BACKEND-PLAN.md](BACKEND-PLAN.md) · [BUILT-SOFAR.md](BUILT-SOFAR.md) · [backend/README.md](../backend/README.md)

---

## 1. Sheet and script

1. Create a Google Sheet with tabs **`events`**, **`guests`**, **`summary`** ([sheet-template.md](../backend/sheet-template.md)).
2. Fill an **`events`** row (match `event-id` on your HTML page, e.g. `diwali-2026`).
3. Paste **`backend/Code.gs`** into Apps Script; save.
4. Optional: add **`is_host`** dish rows in **`guests`** for a pre-set table.
5. If migrating from v1 tabs, **copy the sheet** and run **`migrateContributions()`** once.

---

## 2. Deploy web app

1. **Deploy → New deployment → Web app**
2. Execute as: **Me**
3. Who has access: **Anyone**
4. Copy the URL ending in **`/exec`**.

After code changes: **Manage deployments → Edit → New version** (same URL).

---

## 3. Host the frontend

Options:

| Option | Notes |
|--------|--------|
| **Static host** (GitHub Pages, Netlify, S3, etc.) | Upload repo root or `dist/`; ensure `/src/` modules resolve (full app uses `index.html` + `src/`) |
| **Same origin as today** | Open `index.html` from any static server |

Point the app at your API:

- **Query param:** `index.html?api=https://script.google.com/macros/s/…/exec`
- **Or** set `DEFAULT_API_URL` in `src/config.js` before build/host.

Ensure **`event-id`** on `#rsvp1`, `#btt`, `#details3` matches your sheet `event_id`.

---

## 4. Manual verification (required once per deploy)

Run through [backend/MANUAL-VERIFY.md](../backend/MANUAL-VERIFY.md) against the live `/exec` URL.

From [BACKEND-PLAN.md](BACKEND-PLAN.md) §6, also spot-check in the browser:

- A1 — title and empty table from sheet  
- A2 — host seed dishes on the plate  
- B1 — yes → name → sweet → step 3  
- B4 — edit link `?g=` on a second device  
- C3 — close RSVPs (`rsvp_open` FALSE); attending guests read-only on step 3  

---

## 5. Local rehearsal (recommended)

```bash
npm run dev:all
```

Open `http://127.0.0.1:3456/index.html?_seed=empty` — uses mock v2 on port **8787** (same contract as GAS).

---

## 6. Automated tests (optional before ship)

```bash
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium
npm run test:e2e   # smoke
npm test           # scenario suite vs mock
```

See [BUILT-SOFAR.md](BUILT-SOFAR.md) §8 for current test status.

---

## 7. Day-of operations

- **Close RSVPs:** `rsvp_open` = FALSE or past `rsvp_deadline` on the event row.
- **Guest list / allergies:** **`guests`** tab or **`summary`** in the sheet.
- **Share link:** event page URL; guests get **Copy edit link** on step 3 after RSVP.

---

## 8. Troubleshooting

| Symptom | Check |
|---------|--------|
| “We couldn't load the table” | `/exec` URL, deployment access **Anyone**, CORS (GAS allows browser GET/POST) |
| Step 2 empty but sheet has rows | `event` query param, `event-id` attribute, guest rows not `is_host`-only if you expect attending count |
| POST fails `closed` | Event state; stale tab after host closed RSVPs |
| POST fails `busy` | Rate limit; retry or wait 1 minute |

---

*Ship when manual verify passes on the real `/exec` URL and you’re happy with a browser walkthrough of steps 1–3.*
