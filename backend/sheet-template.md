# Google Sheet template — Balance the Table v2

Create a new spreadsheet with **three tabs** named exactly: `events`, `guests`, `summary`.

Legacy tabs `contributions` and `seed` (v1) are optional; use `migrateContributions()` once to copy them into `guests` (see [README.md](README.md)).

---

## Tab `events`

**Row 1 headers** (paste into A1:I1):

```
event_id	title	starts_at	timezone	address	host_name	rsvp_open	rsvp_deadline	max_guests
```

**Example row** for `diwali-2026` (row 2):

| event_id | title | starts_at | timezone | address | host_name | rsvp_open | rsvp_deadline | max_guests |
|----------|-------|-----------|----------|---------|-----------|-----------|---------------|------------|
| diwali-2026 | Diwali Potluck | 2026-11-07T15:30:00 | America/New_York | 433 Pacific Ave, Jersey City, NJ 07304 | Nayanika | TRUE | 2026-11-05T23:59:00 | 40 |

- `starts_at` / `rsvp_deadline`: local date-time in the event’s timezone (no `Z` suffix).
- `rsvp_open`: `TRUE` or `FALSE` (boolean or text).
- `max_guests`: number or blank for no cap.

---

## Tab `guests`

**Row 1 headers** (paste into A1:L1):

```
event_id	guest_id	status	display_name	side	dish_name	icon	allergies	is_host	created_at	updated_at	client
```

### Host seed dishes (optional)

One **row per dish** on the table before guests arrive. Use `guest_id` = `host` and `is_host` = `TRUE`. Leave `status` and `display_name` blank.

| event_id | guest_id | status | display_name | side | dish_name | icon | allergies | is_host |
|----------|----------|--------|--------------|------|-----------|------|-----------|---------|
| diwali-2026 | host | | | savoury | Biryani | bowl | | TRUE |
| diwali-2026 | host | | | savoury | Momos | dumpling | | TRUE |
| diwali-2026 | host | | | sweet | Tiramisu | slice | | TRUE |
| diwali-2026 | host | | | sweet | Cookies | cookie | | TRUE |
| diwali-2026 | host | | | sweet | Rasmalai | pudding | | TRUE |
| diwali-2026 | host | | | sweet | | cloche | | TRUE |
| diwali-2026 | host | | | sweet | Gulab jamun | donut | | TRUE |
| diwali-2026 | host | | | sweet | Brownies | cookie | | TRUE |

### Guest rows (written by the API)

One row per guest UUID: `status`, `display_name`, `side`, `dish_name`, `icon`, `allergies` on the same row. `is_host` blank or `FALSE`. Timestamps are set by Apps Script.

---

## Tab `summary` (formulas for the host)

This tab is **not** read by the API. Add labels in column A and formulas in column B (adjust ranges if your sheet grows).

**Counts** (assuming `guests` data in rows 2–500):

| Label (A) | Formula (B) |
|-----------|-------------|
| Attending | `=COUNTIFS(guests!C2:C500,"attending",guests!I2:I500,"<>TRUE")` |
| Declined | `=COUNTIF(guests!C2:C500,"declined")` |
| Savoury picks | `=COUNTIFS(guests!C2:C500,"attending",guests!E2:E500,"savoury")` |
| Sweet picks | `=COUNTIFS(guests!C2:C500,"attending",guests!E2:E500,"sweet")` |

**Guest list** (row 6+): use **Data → Filter** on the `guests` tab, or add a second table with `FILTER`:

Example in `summary!A8` (dynamic list of attending guests with dish + allergies):

```
=FILTER(
  { guests!D2:D500, guests!E2:E500, guests!F2:F500, guests!H2:H500 },
  (guests!C2:C500="attending") * (guests!I2:I500<>TRUE)
)
```

Column headers above the spill: `Name`, `Side`, `Dish`, `Allergies`.

---

## Icon allow-list

Must match `src/icons.js`: `bowl`, `pot`, `dumpling`, `samosa`, `skewer`, `pizza`, `slice`, `cookie`, `donut`, `pudding`, `icecream`, `cupcake`, `cloche`.
