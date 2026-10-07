# Manual verification — Apps Script v2

Run on a **test** Google Sheet after deploy. Check each item and note the date when passing.

- [ ] **GET** `?event=diwali-2026` → `event`, `dishes`, `people`, `me: null`, `mine: null`
- [ ] **GET** unknown event → `error: invalid`, empty dishes
- [ ] **POST v1** `{ "event","guestId","side","name","icon" }` → row in `guests`, `{ ok: true, state, me }`
- [ ] **POST** `{ "action":"rsvp","status":"declined",... }` → dish columns cleared on that row
- [ ] **POST** `{ "action":"allergies",... }` → `allergies` column set; not visible on other guests’ GET
- [ ] Set `rsvp_open` FALSE → POST returns `closed`; GET still returns data
- [ ] Set `max_guests` to current count → new guest POST `rsvp` attending returns `full`
- [ ] Rapid POSTs → eventually `{ ok: false, error: "busy" }`
- [ ] **`migrateContributions()`** on sheet copy with v1 `contributions` + `seed` → rows in `guests`

Example `guestId` for curl (replace URL):

```bash
GUEST=$(uuidgen | tr '[:upper:]' '[:lower:]')
curl -s "https://script.google.com/macros/s/DEPLOY/exec?event=diwali-2026&guestId=$GUEST"
curl -s -X POST "https://script.google.com/macros/s/DEPLOY/exec" \
  -H 'Content-Type: text/plain' \
  -d "{\"action\":\"rsvp\",\"event\":\"diwali-2026\",\"guestId\":\"$GUEST\",\"status\":\"attending\",\"displayName\":\"Test Guest\"}"
```
