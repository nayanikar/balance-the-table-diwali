# Balance the Table — Google Sheet backend (API v2)

End-to-end plan: [docs/BACKEND-PLAN.md](../docs/BACKEND-PLAN.md).  
Sheet layout: [sheet-template.md](sheet-template.md).

## 1. Create the spreadsheet

1. New Google Sheet with tabs **`events`**, **`guests`**, **`summary`** (see [sheet-template.md](sheet-template.md) for headers and sample rows).
2. Fill at least one row in **`events`** for your `event-id` (e.g. `diwali-2026`).
3. Optionally add **`is_host`** dish rows in **`guests`** (replaces the old v1 `seed` tab).

## 2. Apps Script

1. **Extensions → Apps Script**
2. Replace project code with [`Code.gs`](Code.gs)
3. Save

### One-time migration from v1

If you have old **`contributions`** and **`seed`** tabs:

1. **Make a copy** of the spreadsheet first.
2. In the Apps Script editor, run **`migrateContributions`** once (select function → Run).
3. Confirm rows appear in **`guests`**, then test GET/POST before deleting legacy tabs.

Migration is idempotent: existing `(event_id, guest_id)` rows in `guests` are not overwritten.

## 3. Deploy web app

1. **Deploy → New deployment → Web app**
2. Execute as: **Me**
3. Who has access: **Anyone**
4. Copy the **Web app URL** (ends in `/exec`).

After code changes: **Deploy → Manage deployments → Edit → New version** (same URL).

## 4. Point the page at the API

```html
<balance-the-table
  event-id="diwali-2026"
  api="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
  step-label="RSVP · step 2 of 3">
</balance-the-table>
```

Demo: open `index.html?api=<your-exec-url>`.

Local dev without Google: `npm run dev:all` (or `npm run dev:mock`) — mock is **API v2** on port **8787**. The demo page defaults to that URL via `src/config.js`; override with `?api=`.

---

## API v2

### GET `{api}?event={eventId}&guestId={uuid}`

Returns:

```json
{
  "event": {
    "id": "diwali-2026",
    "title": "Diwali Potluck",
    "startsAt": "2026-11-07T15:30:00",
    "timezone": "America/New_York",
    "address": "433 Pacific Ave, Jersey City, NJ 07304",
    "hostName": "Nayanika",
    "state": "open"
  },
  "dishes": [{ "side": "savoury", "name": "Biryani", "icon": "bowl" }],
  "people": { "attending": 9 },
  "me": null
}
```

- **`state`:** `open` | `closed` | `full` | `past` (computed server-side; see BACKEND-PLAN §2).
- **Privacy:** public response has **no** other guests’ names, ids, or allergies. Only **`me`** includes `displayName` and `allergies` for the requesting `guestId`.
- **`mine`** (optional): legacy `{ side, name, icon }` derived from `me`; the v2 frontend uses boot `me` + `dishes` directly.

Unknown `event` → `{ "error": "invalid", "dishes": [], "people": { "attending": 0 }, "me": null, "mine": null }`.

### POST `{api}`

Body: **`Content-Type: text/plain`**, JSON.

| `action` | Body fields | Effect |
|----------|-------------|--------|
| `rsvp` | `event`, `guestId`, `status`, `displayName` | Upsert guest row; `declined` clears dish columns |
| `contribution` | `event`, `guestId`, `side`, `name`, `icon` | Requires `attending`; upsert dish |
| `contribution.remove` | `event`, `guestId` | Clear dish columns only |
| `allergies` | `event`, `guestId`, `allergies` | Save allergies note |
| *(v1, no action)* | `{ event, guestId, side, name, icon }` or `{ remove: true }` | Mapped to `contribution` / `contribution.remove` |

Success: `{ "ok": true, "state": "open", "me": { ... } }`  
Error: `{ "ok": false, "error": "invalid"|"closed"|"full"|"past"|"busy"|"not_attending" }`

### Server rules

- **`guestId`:** UUID v4 (except sheet rows with `guest_id` = `host`).
- **Writes blocked** when `state` is `closed` or `past`.
- **New** `attending` RSVPs blocked when `full`; guests already attending may still edit.
- **Lock:** 8s script lock per write; timeout → `busy`.
- **Rate limit:** 60 writes/min per event, 20/min per `guestId` → `busy`.

---

## Host operations

- **Close RSVPs:** set `rsvp_open` to `FALSE` on the `events` row (or wait until `rsvp_deadline`).
- **Watch guests:** use the **`guests`** tab or **`summary`** formulas.
- **Cap size:** set `max_guests` on the event row.

---

## Manual verification checklist

After deploy on a test sheet:

1. GET with valid `event` → `event`, `dishes`, `people`, `me: null`, `mine: null`.
2. POST v1 `{ event, guestId, side, name, icon }` → row in `guests`, `{ ok: true, me }`.
3. POST `{ action: "rsvp", status: "declined", ... }` → dish columns cleared.
4. `rsvp_open` = FALSE → POST returns `closed`; GET still works.
5. Rapid POSTs → eventually `busy`.
6. `migrateContributions()` on a copy with v1 tabs → rows in `guests`.
