# Stick Figures Holding the Table — Guide for Cursor

This replaces the **balance scale** with **one big shared plate held up by tiny stick figures**, one per guest who's coming. The plate tilts toward the heavier side (savoury on the left, sweet on the right). The figures underneath **re-pose every frame** to match the room they have: relaxed under a level plate, straining at the heavy end, climbing onto crates at the light end.

**Files in this folder:**

| File | Use |
|---|---|
| `figures.js` | **Drop-in module.** Body proportions, the pose ladder, IK, and SVG rendering. Use it as-is; don't redraw figures by hand. |
| `stick-figure-guide.html` | Visual reference: live demo with sliders, all 7 poses, personalities, anatomy, rules. Open it in a browser. |
| `STICK-FIGURES-GUIDE.md` | This file. |

> **Cursor:** copy `figures.js` into `src/` and import it into the game component. Match `stick-figure-guide.html` for look and behaviour. Don't change the numbers in `BODY` or `POSES`; the poses are tuned to them.

---

## 1. What's wrong in the current build (fix these)

1. **Figures float.** There's no floor and the legs dangle. → Add a floor line and keep every foot on it (or on a crate).
2. **Heads go through the plate.** The figures were moved up until their hands touched. → Pose comes from headroom (§3), which keeps heads under the plate.
3. **Every figure has the same pose.** → Each figure picks its pose from its own headroom, and its free-hand quirk from its guest id.
4. **Figures don't react to the tilt.** → Re-pose on every animation frame using the plate's *current* animated angle.
5. **Figures are randomly sized and overlap.** → Use fixed proportions and even spacing (§4).

---

## 2. The scene

```
         dishes sit on the plate (rotate with it)
   ┌──────────────────────────────────────────────┐  ← plate, tilts around its centre
    🧍   🧍   🧍   🧍   🧍                       ← figures BEHIND the plate, re-posed each frame
───────────────────────────────────────────────── ← floor line (G)
  SAVOURY                                 SWEET
```

Constants (SVG units; the viewBox is about `-240 40 480 250`):

```js
import { PLATTER, platterSVG, platterUnderside, platterUndersideLocal, dishSlot } from './figures.js';
const G = 232;                                   // floor y
const HALF = PLATTER.HALF;                       // 210
const CY = G - 60 - platterUndersideLocal(0);    // platter centre → 60px headroom when level
const MAXT = 12;                                 // max tilt in degrees
```

- **Tilt:** `target = MAXT * Math.tanh((sweet - savoury) / 3)`. Positive tilts the right (sweet) end down. Keep the existing spring (`vel += (target-ang)*0.045; vel *= 0.9; ang += vel`) and the landing impulse.

### The platter (same drawing language as the original scale)

Use `platterSVG()`; don't draw your own. It's a big oval serving platter seen slightly from above, built from four layers:

1. **Rim edge band:** the visible thickness under the front lip (6px). It has a paper fill with 9% ink and a 2.2 ink outline, plus short diagonal **hatch strokes** like the shading in your sketches.
2. **Top face:** an ellipse (rx 210, ry 10) with a `--card` fill and a 2.2 ink outline. This matches the original beam and pans.
3. **Inner well:** a thin ink ellipse (1.2 stroke, 50% opacity) marking where the food sits.
4. **Festive dots:** a ring of 24 tiny dots between the rim and the well, cycling lamp-gold → rani pink → marigold. It echoes the string of lights; keep it this subtle.

Put it in `<g transform="translate(0 CY) rotate(ang)">` with the dishes in the same group, so they tilt together.

**Hand-drawn wobble:** wrap the **floor, figures and platter** in the same `feTurbulence` + `feDisplacementMap` filter as the original scale (`baseFrequency .035`, `scale 2.6`). "Boil" it by cycling `seed` 1–4 every 160 ms. **Keep text outside the filter** (SAVOURY/SWEET, "+N more"), so it stays crisp.

**Floor:** the original table line plus the **scalloped tablecloth line** under it (`q 12 10 24 0` repeated, 1.4 stroke, 55% opacity).

**Dishes on the platter:**
- `dishSlot(side, i)` gives each dish's local position: savoury to the left of centre, sweet to the right. They alternate between a back row (y −3.2) and a front row (y +3.2), working outward. Show at most 12 per side, then "+N more" (Caveat, muted) above that end.
- **Draw back-row dishes first** so front ones overlap them.
- Icons at scale `.78`, random rotation ±4°, each with a soft **contact shadow**: an ink ellipse rx 13, ry 2.6, 12% opacity, just under the dish.
- The current guest's dish keeps the gold halo, the drop-in bounce and the starburst from the original game.

**Draw order:** floor + scallops → figures → platter → dishes → effects/text. **Figures go behind the platter** so hands tuck under the rim.

**Labels:** SAVOURY / SWEET in Caveat 700, 22–24px, letter-spacing .08em, under the floor at x = ∓150.

**Mini scenes** (invite, confirmation, landing): reuse the same scene at `size="sm"` (about 70% scale). Don't swap in a simpler plate.

---

## 3. The pose ladder (the core rule)

For each figure: `h = floorY − plateUndersideY(x)`. That's the headroom straight above its feet:

```js
const plateY = platterUnderside(x, CY, ang);   // from figures.js
```

| h (px) | Pose | Looks like |
|---|---|---|
| ≥ 72 | **stool** | Climbs onto a wooden crate (12/24/36 tall), then re-checks h |
| 64–72 | **tiptoe** | Heels up, both arms straight |
| 57–64 | **relaxed** | One palm up like a waiter; the free hand shows a quirk |
| 50–57 | **both** | Both hands, elbows out, knees softening |
| 36–50 | **squat** | Wide sumo squat, leaning in, head tucked, 1 sweat drop |
| 22–36 | **back** | **The heavy corner:** bent over 57°–80°, plate on the upper back, hands on knees, 2 sweat drops, trembling, effort marks |
| < 22 | **crawl** | Hands and knees, flat back, like a little table |

Inside each band, `figures.js` bends the knees or leans further so the hands (or the back) **touch the plate exactly**. The head top always stays under the plate.

**How this plays out:**
- **Level plate (h ≈ 60):** everyone is relaxed.
- **Heavy end:** the figure nearest the low corner goes squat → back → crawl as dishes pile up.
- **Light end:** figures go tiptoe → crate.

---

## 4. Who's under the plate

- **One figure per guest who's coming** (`attending = true`), **including the host**, who wears a little party hat (`host: true`).
- **Positions:** `layoutX(n, HALF)` spreads them evenly across the middle 75% of the plate; a single figure stands just left of centre. Show at most **10**; beyond that, write "+N helping" in muted Caveat on the floor near the right edge.
- **Facing:** `dir = x < 0 ? 1 : -1`, so everyone faces the centre.
- **Quirk:** `kind = kindFor(guestId)`, one of `hip`, `wave`, `sparkler` (a phuljhadi) or `flamingo`. It's stable per guest and only shows in the relaxed pose. Under strain everyone uses two hands; the quirk comes back when things level out.
- **The current guest:** `mine: true` paints the body and head lamp-gold, with `kind: 'wave'`.
  - Their figure **isn't shown until they tap Sweet or Savoury.** Then it **pops in** at the end nearest their side (savoury → leftmost, sweet → rightmost) while their dish drops onto the plate.
  - Pop-in: scale 0 → 1 over 400 ms with an easeOutBack overshoot.
  - The other figures slide to their new spacing (lerp `x` toward the target, 0.15 per frame) instead of jumping.
- **Host dashboard:** same scene, with `mine` off for everyone.

---

## 5. Using `figures.js`

```js
import { figure, layoutX, platterUnderside, kindFor } from './figures.js';

function renderFigures(people, ang, nowMs) {
  const xs = layoutX(Math.min(people.length, 10), HALF);
  return xs.map((x, i) => {
    const p = people[i];
    return figure({
      x,
      ground: G,
      plate: platterUnderside(x, CY, ang),
      dir: x < 0 ? 1 : -1,
      kind: p.mine ? 'wave' : kindFor(p.id),
      mine: !!p.mine,
      host: !!p.host,
      t: reducedMotion ? 0 : nowMs / 1000,   // drives wave / sparkler / shake
      scale: p.popScale ?? 1,
    });
  }).join('');
}
```

- **Call this inside the same `requestAnimationFrame` loop as the plate spring**, so poses track the swing.
- Put the result in a `<g class="figures">` that comes **before** the plate group in the SVG.
- **Copy the `.fg-*` CSS** from the bottom of `figures.js` (also in the guide page).
- **Keep it fast:** rebuilding about 10 figures' `innerHTML` per frame is fine. Pause the loop when the tab is hidden, and when the plate has settled (|vel| < 0.001) and no figure is animating. Keep it running if anyone is in the relaxed pose with `wave` or `sparkler`, or anyone is in back/crawl (they shake).
- **The wobbly hand-drawn filter** applies to the figures group too, the same as the plate.

---

## 6. Style rules

- **Ink:** `--ink` lines at 2.2. **Paper:** `--card` fill for head and body. **No faces.** The body has a tiny zigzag scribble, a nod to the hand-drawn sketches.
- **Feet** are small filled ovals pointing outward. On tiptoe they tilt 55°.
- **Strain is shown, never written:**
  - sweat drops (light blue, ink outline)
  - a 0.6px shake
  - two small effort arcs over the bent back
- **Diwali touches only where they make sense:** the sparkler quirk (gold rays, slowly spinning) and the host's party hat (marigold with a pink pom-pom). Nothing else.
- **Reduced motion:** pass `t: 0` and `scale: 1`, and skip the spring. Poses still change with the data.

---

## 7. Accessibility

- **The SVG keeps `role="img"`,** with a label that now mentions the helpers: *"5 people are holding up the table: 2 savoury and 6 sweet dishes."*
- **Figures are decorative.** Don't put them in the accessibility tree separately.

---

## 8. Acceptance checklist

- [ ] The platter has the same ink weight, paper fill and wobble as the rest of the page: rim band with hatching, inner well and a subtle dot ring.
- [ ] With an even table, everyone is in the relaxed pose and no head touches the plate.
- [ ] Sweet-heavy (1 savoury vs 7 sweet): the rightmost figure is in **back** (bent over, plate on back), the next one squats, and the leftmost figures are on tiptoe or crates.
- [ ] Savoury-heavy mirrors it.
- [ ] Feet always on the floor or on a crate; nothing floats.
- [ ] Picking a side makes the guest's gold figure pop in at that end while the dish drops, and the others shuffle over smoothly.
- [ ] A guest's quirk stays the same across reloads (it's hashed from their id).
- [ ] The host wears the hat on every screen, including the dashboard.
- [ ] More than 10 guests: 10 figures plus "+N helping".
- [ ] Reduced motion: no shaking, waving or popping; poses still update.
- [ ] Looks right at 320px wide, with figures still distinct and not overlapping (spacing ≥ 28 units with 10 people).
