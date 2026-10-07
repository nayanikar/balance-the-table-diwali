# Backend Plan — Balance the Table, end to end

Builds on `docs/BUILT-SOFAR.md`. **Goal:** every guest's RSVP, name, dish and allergies are saved to one Google Sheet. Every step reads from it. The flow works for the very first guest, everyone in between, and the last guest after RSVPs close.

**Stack stays the same:** vanilla web components + **Google Apps Script web app + Google Sheet**. `scripts/mock-api.mjs` mirrors it for local dev and tests.

---

## 0. Decisions (made — change here if you disagree)

| Topic | Decision | Why |
|---|---|---|
| Identity | **One client-generated UUID per guest per event**, created at **step 1**, shared by all 3 steps. A private **edit link** (`?g=<guestId>`) restores it on another device. | Low-stakes potluck, no accounts, no emails. It fits the current `guestId` model. |
| Storage shape | **One row per guest** in a `guests` tab (status + name + dish + allergies together). This replaces the separate `contributions` tab. | Simpler to read in the sheet, and there's no step 1 ↔ step 2 linking problem. |
| Event details | Come from an **`events` tab**, not HTML attributes. | The host edits the date or address in the sheet; no code change. |
| API | **One `/exec` URL.** `GET` returns everything for the page; `POST` takes `{ action, ... }`. | One round trip on load; Apps Script only gives one URL anyway. |
| Host tools | **The Google Sheet is the host dashboard** for v1, plus a `summary` tab with formulas. No host UI in the app. | Ship faster; build host screens later. |
| Privacy | The public `GET` returns **dishes and a head count, never names or allergies**. The host sees everything in the sheet. | Matches the "dish, not who" design. |

---

## 1. Sheet schema

### Tab `events` (one row per event)

| column | example | notes |
|---|---|---|
| `event_id` | `diwali-2026` | matches `event-id` in the page |
| `title` | `Diwali Potluck` | |
| `starts_at` | `2026-11-07T15:30:00` | local time |
| `timezone` | `America/New_York` | |
| `address` | `433 Pacific Ave, Jersey City, NJ 07304` | |
| `host_name` | `Nayanika` | shown as the host figure with the party hat |
| `rsvp_open` | `TRUE` | host flips this to `FALSE` to close RSVPs |
| `rsvp_deadline` | `2026-11-05T23:59:00` | optional; after this, treated as closed |
| `max_guests` | `40` | optional cap on attending guests |

### Tab `guests` (one row per guest per event)

| column | notes |
|---|---|
| `event_id` | |
| `guest_id` | UUID v4 from the browser; `host` for seed rows |
| `status` | `attending` · `declined` · `pending` (pending = opened step 1 but hasn't answered; optional) |
| `display_name` | ≤ 40 chars, trimmed |
| `side` | `savoury` · `sweet` · blank |
| `dish_name` | ≤ 40 chars, may be blank |
| `icon` | one of the keys in `src/icons.js` |
| `allergies` | ≤ 200 chars |
| `is_host` | `TRUE` for the host's own seed dishes |
| `created_at` / `updated_at` | ISO timestamps, set by the server |
| `client` | short user-agent tag, for debugging |

### Tab `summary` (formulas only, for the host)

- Attending count, declined count, savoury vs sweet count.
- The list of names with their dishes and allergies, filtered to `attending`.

### Migration

A one-time `migrateContributions()` in `Code.gs` copies existing `contributions` rows into `guests` (as `status = attending`, blank name) and the `seed` tab rows into `guests` (as `is_host = TRUE`). Run it on a **copy** of the sheet first.

---

## 2. API v2 contract

### `GET {api}?event={id}&guestId={uuid}`

```jsonc
{
  "event": {
    "id": "diwali-2026", "title": "Diwali Potluck",
    "startsAt": "2026-11-07T15:30:00", "timezone": "America/New_York",
    "address": "433 Pacific Ave, Jersey City, NJ 07304", "hostName": "Nayanika",
    "state": "open"            // "open" | "closed" | "full" | "past"
  },
  "dishes": [ { "side": "savoury", "name": "Biryani", "icon": "bowl" } ],   // attending guests + host seeds; NO names/ids
  "people": { "attending": 9 },                                            // drives how many stick figures appear
  "me": {                                                                   // null if this guestId has no row
    "status": "attending", "displayName": "Priya",
    "side": "sweet", "dishName": "", "icon": "slice", "allergies": "nuts"
  }
}
```

**Event `state` rules** (server-side, in the event's timezone):
- `past`: the event started more than 24 h ago.
- `closed`: `rsvp_open = FALSE`, or `rsvp_deadline` has passed.
- `full`: attending count ≥ `max_guests`, and this guest isn't already attending.
- otherwise `open`.

### `POST {api}` (body `text/plain` JSON — avoids the CORS preflight)

| `action` | body | effect |
|---|---|---|
| `rsvp` | `{ event, guestId, status, displayName }` | Upsert the row. If `status = declined`: **clear `side`, `dish_name`, `icon`** (their dish leaves the table). |
| `contribution` | `{ event, guestId, side, name, icon }` | Requires `status = attending`. Upserts the dish. |
| `contribution.remove` | `{ event, guestId }` | Clears the dish only. |
| `allergies` | `{ event, guestId, allergies }` | Saves the note. |
| *(no action)* | old v1 upsert/remove body | **Keep working** for backward compatibility, mapped to `contribution` / `contribution.remove`. |

**Every POST returns `{ ok, state, me }`**, so the client can reconcile with the server. Errors are `{ ok:false, error }`, where `error` is one of `invalid` · `closed` · `full` · `past` · `busy` · `not_attending`.

### Server rules (all in `Code.gs`)

- **Validation:** `guestId` must match the UUID v4 regex. `side` and `icon` must be in the allow-lists. Strings are trimmed, length-capped and stripped of control characters.
- **Writes are blocked** when `state` is `closed` or `past`. **New** attending RSVPs are blocked when `full`; guests already attending can still edit.
- **Concurrency:** wrap every write in `LockService.getScriptLock().waitLock(8000)`. On timeout, return `busy`; the client retries.
- **Rate limit:** `CacheService`, at most 60 writes per event per minute and at most 20 per `guestId` per minute. Over the limit returns `busy`.
- **Speed:** read the `guests` tab once per request (`getDataRange().getValues()`), then update a single row with `setValues`.
- **Privacy:** never return another guest's `guest_id`, `display_name` or `allergies`.

---

## 3. Frontend changes

1. **`src/guest.js` (new):** `getGuestId(eventId)` creates or reads `guest:{eventId}:id`. It migrates the old `btt:{eventId}:guestId` if present. It also reads `?g=` from the URL: save it, then strip it with `history.replaceState`.
2. **Boot in `index.html`:** do **one GET** on load and hydrate all three components from it. Then route:

   | `me` | `event.state` | Open at |
   |---|---|---|
   | `null` | open | Step 1 intro |
   | `null` | closed / full / past | Step 1 with the matching message, no buttons |
   | `declined` | open | Step 1 "We'll miss you" + Change my RSVP |
   | `attending`, no `side` | open | Step 2 |
   | `attending`, has `side` | any | Step 3 (read-only if not open) |

3. **Step 1:** on Yes plus name → `POST rsvp attending`. On "Can't make it" → `POST rsvp declined`. **Change my RSVP** pre-fills the name and doesn't wipe the server row until they choose again.
4. **Step 2:** set `guest-id` from `guest.js` and pass the dishes and `people.attending` from the boot GET (no second fetch). The contribution POST works as today. Then `fw.burst()` if the gap between sides narrowed.
5. **Step 3:** render **When / Where** from `event`, **You're bringing** from `me`, and **allergies → `POST allergies`**. Add a **"Copy my edit link"** button (`{page}?g={guestId}`). Show `guest-name` in the sub-line.
6. **"Not you?" link** on step 1 when a stored guest exists: *"Not {name}? RSVP as someone else"*. It creates a new `guestId` in storage, for a partner using the same phone.
7. **Offline / slow network:**
   - Keep the last GET in `localStorage` and render it **immediately**, then refresh.
   - Queue failed POSTs in `localStorage` and retry on `online` and on the next load.
   - **Remove the fake seed fallback when `api` is set.** Show the cached table, or an empty table with *"We couldn't load the table — try again"*.
8. **Closed / past UI:** step buttons are disabled, with one line of copy (below). Step 3 still shows the details.

---

## 4. Scenarios

The IDs map to tests in §6. **Expected** is what the guest sees, plus what ends up in the sheet.

### A. First users (setting up, empty table)

| ID | Scenario | Expected |
|---|---|---|
| A1 | **Host sets up.** New sheet from the template, fills the `events` row, deploys, opens the link. | Step 1 shows the title from the sheet. The GET returns `dishes: []`, `people.attending: 0`. |
| A2 | **Host adds their own dish(es)** as `is_host` rows. | The plate shows the host's dish. The host figure (party hat) holds the plate alone. |
| A3 | **The very first guest**, no host seed. | Step 2 shows an empty, level plate held by the guest's own figure. Sub-copy: *"You're the first dish on the table."* Their pick tips the plate to their side. |
| A4 | **The first guest declines.** | Row saved as `declined`. Nothing changes on the table; no figure is added. |
| A5 | **Two guests open the link at the same moment** and both pick. | Both rows are saved (script lock); neither overwrites the other. The second guest's GET includes the first guest's dish. |
| A6 | **API URL wrong or not deployed** (the host's mistake). | The page loads with a clear *"We couldn't load the table"* message. Nothing pretends to be saved. A console error names the URL. |

### B. Guests in between (the busy middle)

| ID | Scenario | Expected |
|---|---|---|
| B1 | **Happy path:** Yes → name → Sweet → step 3. | One row: `attending`, name, `sweet`, icon. The plate tips; step 3 shows *"You're bringing: Sweet"*. |
| B2 | **Picks the lighter side.** | Same copy as any pick, plus one quiet `fw.burst()`. |
| B3 | **Comes back on the same browser.** | The boot GET finds `me` with a side, so step 3 opens directly. |
| B4 | **Comes back on a new phone** using the edit link. | `?g=` restores identity and lands on step 3 with their data. |
| B5 | **Comes back on a new phone without the link.** | Treated as new. If the name typed in step 1 matches an existing attending name, show a soft hint: *"Already RSVP'd? Use the edit link from your confirmation."* It doesn't block them. |
| B6 | **Switches Sweet → Savoury.** | Same row updated. The plate re-tips, and the old dish disappears for everyone. |
| B7 | **Changes Yes → Can't make it.** | Row becomes `declined` and the dish is cleared server-side. Their figure and dish leave the table on the next load for others. |
| B8 | **Changes No → Yes later.** | Same row back to `attending`. They go to step 2 to pick again. |
| B9 | **Two people share one phone** (a couple). | The second person taps *"Not Priya?"* → new `guestId` → a separate row. Both have figures. |
| B10 | **Two guests with the same name** ("Rahul"). | Separate rows, separate ids. The sheet shows both; no conflict. |
| B11 | **Adds allergies** on step 3. | `allergies` column updated. It never appears in the public GET. |
| B12 | **Edits their name** via Change my RSVP. | `display_name` updated on the same row. |
| B13 | **Slow / offline network** mid-pick. | The animation plays and the pick is queued. A quiet line appears: *"Saving… we'll keep trying."* It syncs on reconnect, and the sheet shows the row afterwards. |
| B14 | **Apps Script busy** (lock timeout). | The client retries once after 1.5 s. If it still fails, the pick goes to the offline queue. |
| B15 | **Very lopsided table** (2 savoury, 12 sweet). | Visuals only: max tilt, back-carrying figure, "+N more". No warning copy. |
| B16 | **Lots of people** (25 attending). | 10 figures plus *"+15 helping"*; the plate dishes cap with "+N more". |
| B17 | **Someone spams the API.** | Rate limit returns `busy`, and the sheet stays clean. Writes still require a valid UUID and allow-listed values. |
| B18 | **Someone tries to read names** via the GET URL. | The response contains no names, ids or allergies. |

### C. The end (last guests, closing, the day of)

| ID | Scenario | Expected |
|---|---|---|
| C1 | **The last guest before the deadline.** | Works like B1. Their pick may be the one that balances the table, so `fw.burst()`. |
| C2 | **Event hits `max_guests`.** | New visitors get state `full`: step 1 shows *"The table's full this time — reach out to {host} if you'd like to come."* Guests already attending can still edit. |
| C3 | **Host closes RSVPs** (`rsvp_open = FALSE`) or the deadline passes. | New visitors see *"RSVPs are closed — ask {host} if you still want to come."* Attending guests open on step 3 **read-only**, with the edit buttons hidden. Any POST returns `closed`. |
| C4 | **A guest tries to change after closing** (a stale tab). | The POST returns `closed`, and the UI switches to the closed state without losing what they see. |
| C5 | **The day of the event.** | Step 3 still works as the "where and when" page; the maps link still works. |
| C6 | **After the event** (> 24 h past). | State `past`: *"This potluck has happened. Hope it was delicious."* The final table and figures show read-only, with no buttons. |
| C7 | **Host's final check.** | The `summary` tab shows attending count, savoury vs sweet, and the list of names, dishes and allergies, ready to print or share. |
| C8 | **Host reuses the setup next year.** | Adds a new `events` row (`diwali-2027`) and changes `event-id` in the page. Old data stays separate. |

---

## 5. Mock API parity

Update `scripts/mock-api.mjs` to implement **the exact v2 contract** (same `state` logic, same errors, in-memory rows). Add debug-only query params so tests can force states:
- `?_state=closed|full|past`
- `?_latency=2000`
- `?_fail=1`

Seed modes `empty`, `host-only`, `sweet-heavy` and `crowd25` cover A1–A3, B15 and B16.

---

## 6. Tests (Playwright, against the mock)

Name each test by its scenario ID:

- **Must pass before shipping:** A3, A4, A5, B1, B3, B4, B6, B7, B9, B11, B13, B17 (unit-level), B18, C2, C3, C4, C6.
- **Manual check against the real Apps Script once:** A1, A2, A6, B14, C7.
- **Concurrency (A5):** fire two contexts at once, then assert the GET returns both dishes.
- **Privacy (B18):** assert the GET JSON has no `displayName`, `guest_id` or `allergies` outside `me`.

---

## 7. Build order

1. **Sheet + `Code.gs` v2:**
   - add the `events`, `guests` and `summary` tabs
   - implement GET / POST with the actions in §2
   - add validation, locking and rate limiting
   - run the migration on a copy of the sheet
2. **Mock v2:** update `scripts/mock-api.mjs` to match, including the debug params from §5.
3. **`src/guest.js`** plus the **single boot GET and routing** in `index.html`.
4. **Wire each step:**
   - step 1 → `rsvp`
   - step 2 → uses the boot data
   - step 3 → event details, allergies and the edit link
5. **Edge features:**
   - "Not you?"
   - the edit link `?g=`
   - the offline queue
   - the closed / full / past states
   - the name-match hint
6. **Tests:** Playwright scenarios from §6, all green against the mock.
7. **Deploy:** publish the Apps Script web app, set the `api` URL, then run the manual checks.

---

## 8. Host runbook (deploying for real)

1. Make a copy of the template sheet. Fill the `events` row, and optionally add `is_host` dish rows to `guests`.
2. **Extensions → Apps Script**, paste `Code.gs`, then **Deploy → New deployment → Web app**. Set *Execute as: Me* and *Who has access: Anyone*. Copy the `/exec` URL.
3. Put the URL in the page config (`api` attribute or `CONFIG.API_URL`). Open the page with `?api=<url>` once to test.
4. Do a test RSVP yourself, check the row appears, then delete it.
5. Share the page link. Watch the `summary` tab.
6. To stop RSVPs, set `rsvp_open` to `FALSE`. After an update to `Code.gs`, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.
