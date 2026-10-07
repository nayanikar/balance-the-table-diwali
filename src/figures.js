// figures.js — hand-drawn stick figures that hold up the shared potluck plate.
// Pure functions, no dependencies. Returns SVG strings.
// Coordinates: pose maths is done in "y-up" units relative to the figure's feet,
// then converted to SVG (y-down) at the end.

/* ---------------------------------------------------------------
   1. Body proportions (px at scale 1). Keep these — the poses depend on them.
   --------------------------------------------------------------- */
export const BODY = {
  R: 6,       // head radius
  NECK: 2,
  TORSO: 20,  // hip → shoulder
  UA: 11,     // upper arm
  FA: 11,     // forearm
  TH: 12,     // thigh
  SH: 12,     // shin
};
const { R, NECK, TORSO, UA, FA, TH, SH } = BODY;

/* ---------------------------------------------------------------
   2. The pose ladder. `h` = clearance in px from the figure's ground
   (or stool top) up to the underside of the plate directly above it.
   --------------------------------------------------------------- */
export const POSES = [
  { name: 'stool',   min: 72, note: 'Plate too high to reach: climbs onto a little crate.' },
  { name: 'tiptoe',  min: 64, note: 'Up on tiptoes, both arms straight.' },
  { name: 'relaxed', min: 57, note: 'One palm up like a waiter. Free hand has a personality.' },
  { name: 'both',    min: 50, note: 'Both hands, elbows bent, knees softening.' },
  { name: 'squat',   min: 36, note: 'Wide squat, leaning in, head tucked. One sweat drop.' },
  { name: 'back',    min: 22, note: 'Heavy corner: bent over, plate on the upper back, hands on knees. Sweat + shake.' },
  { name: 'crawl',   min: 0,  note: 'On hands and knees like a little table. Maximum drama.' },
];
export const poseFor = h => (POSES.find(p => h >= p.min) || POSES[POSES.length - 1]).name;

// Personality for the free hand (only shows in the relaxed pose).
export const KINDS = ['hip', 'wave', 'sparkler', 'flamingo'];
export function kindFor(id) {
  let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return KINDS[Math.abs(h) % KINDS.length];
}

/* ---------------------------------------------------------------
   3. Two-bone IK. bend = +1 puts the elbow/knee on the +x side, -1 on -x.
   --------------------------------------------------------------- */
function ik(a, b, l1, l2, bend) {
  let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-3;
  if (d >= l1 + l2) {               // out of reach: straight limb pointing at target
    const k = (l1 + l2) / d;
    return { mid: { x: a.x + dx * l1 / d, y: a.y + dy * l1 / d }, end: { x: a.x + dx * k, y: a.y + dy * k } };
  }
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const off = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const mx = a.x + dx * along / d, my = a.y + dy * along / d, px = -dy / d, py = dx / d;
  let mid = { x: mx + px * off, y: my + py * off };
  if ((mid.x - mx) * bend < 0 || (Math.abs(mid.x - mx) < 1e-6 && bend < 0)) mid = { x: mx - px * off, y: my - py * off };
  return { mid, end: b };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const add = (p, v, k = 1) => ({ x: p.x + v.x * k, y: p.y + v.y * k });

/* ---------------------------------------------------------------
   4. Build a skeleton for a pose. Returns joints in y-up local coords.
   dir = which way the figure faces/leans (+1 right, -1 left) — face the plate's centre.
   --------------------------------------------------------------- */
function skeleton(pose, h, dir, kind, t) {
  const S = { feet: [], legs: [], arms: [], extras: [], sweat: 0, shake: false, tip: 0 };
  const torso = (hip, lean) => {           // lean in radians, toward dir
    const u = { x: dir * Math.sin(lean), y: Math.cos(lean) };
    return { hip, shoulder: add(hip, u, TORSO), u, lean };
  };
  const head = (sh, tilt) => add(sh, { x: dir * Math.sin(tilt), y: Math.cos(tilt) }, NECK + R);
  const legsTo = (hip, stance, kneeBend) => {    // kneeBend: 'out' (squat) or 'fwd'
    for (const s of [-1, 1]) {
      const foot = { x: s * stance, y: S.tip };
      const bend = kneeBend === 'out' ? s : dir;
      S.legs.push(ik({ x: hip.x + s * 2, y: hip.y }, foot, TH, SH, bend));
      S.feet.push({ x: foot.x, y: 0, out: kneeBend === 'fwd' ? dir : s });
    }
  };
  const armTo = (sh, hand, bend) => S.arms.push(ik(sh, hand, UA, FA, bend));

  if (pose === 'tiptoe') {
    S.tip = clamp(h - 63, 0, 7);
    const T = torso({ x: 0, y: 23 + S.tip }, 0);
    Object.assign(S, T, { head: head(T.shoulder, 0) });
    legsTo(T.hip, 4, 'out');
    armTo(T.shoulder, { x: -6, y: h }, -1); armTo(T.shoulder, { x: 6, y: h }, 1);
  }
  else if (pose === 'relaxed') {
    const T = torso({ x: 0, y: 23 }, 0);
    Object.assign(S, T, { head: head(T.shoulder, 0) });
    const hs = dir;                                       // holding hand toward the plate centre
    armTo(T.shoulder, { x: hs * 8, y: h }, hs);
    if (kind === 'flamingo') {
      S.legs.push(ik({ x: -hs * 2, y: 23 }, { x: -hs * 5, y: 0 }, TH, SH, -hs));
      S.feet.push({ x: -hs * 5, y: 0, out: -hs });
      S.legs.push(ik({ x: hs * 2, y: 23 }, { x: -hs * 1, y: 11 }, TH, SH, hs));   // knee up
      armTo(T.shoulder, { x: -hs * 18, y: 45 }, -hs);                            // balancing arm
    } else {
      legsTo(T.hip, 5, 'out');
      if (kind === 'hip')      armTo(T.shoulder, { x: -hs * 6, y: 24 }, -hs);
      if (kind === 'wave') {
        const hand = { x: -hs * 15, y: 53 + 2 * Math.sin(t * 9) };
        armTo(T.shoulder, hand, -hs);
        S.extras.push({ type: 'wave', at: hand, dir: -hs });
      }
      if (kind === 'sparkler') {
        const hand = { x: -hs * 13, y: 36 };
        armTo(T.shoulder, hand, -hs);
        S.extras.push({ type: 'sparkler', at: hand, dir: -hs });
      }
    }
  }
  else if (pose === 'both') {
    const drop = Math.max(0, 58 - h);                     // keep head top 1px under the plate
    const T = torso({ x: 0, y: 23 - drop }, 0);
    Object.assign(S, T, { head: head(T.shoulder, 0) });
    legsTo(T.hip, 6, 'out');
    armTo(T.shoulder, { x: -7, y: h }, -1); armTo(T.shoulder, { x: 7, y: h }, 1);
  }
  else if (pose === 'squat') {
    const k = clamp((50 - h) / 14, 0, 1);
    const lean = 0.15 + 0.35 * k, tilt = lean + 0.6;
    const top = TORSO * Math.cos(lean) + (NECK + R) * Math.cos(tilt) + R;   // hip → head top
    const T = torso({ x: 0, y: h - top - 1 }, lean);
    Object.assign(S, T, { head: head(T.shoulder, tilt) });
    legsTo(T.hip, 11, 'out');
    armTo(T.shoulder, { x: dir * 3 - 9, y: h }, -1); armTo(T.shoulder, { x: dir * 3 + 9, y: h }, 1);
    S.sweat = 1;
  }
  else if (pose === 'back') {
    const k = clamp((36 - h) / 14, 0, 1);
    const lean = 1.0 + 0.4 * k;                            // 57° → 80°
    const hipY = h - (TORSO * Math.cos(lean) + 4 * Math.sin(lean));   // upper back touches plate
    const T = torso({ x: -dir * 4, y: hipY }, lean);
    Object.assign(S, T, { head: head(T.shoulder, lean + 0.9) });       // head tucked forward/down
    legsTo(T.hip, 10, 'fwd');
    const knees = S.legs.map(l => l.mid);
    armTo(T.shoulder, add(knees[0], { x: dir * 2, y: 2 }), -dir);      // hands on knees
    armTo(T.shoulder, add(knees[1], { x: dir * 2, y: 2 }), -dir);
    S.sweat = 2; S.shake = true;
    S.extras.push({ type: 'effort', at: add(T.shoulder, { x: -dir * 6, y: 10 }) });
  }
  else if (pose === 'cheer') {
    const T = torso({ x: 0, y: 23 }, 0);
    Object.assign(S, T, { head: head(T.shoulder, 0) });
    legsTo(T.hip, 5, 'out');
    armTo(T.shoulder, { x: -13, y: 63 }, -1);
    if (kind === 'sparkler') {
      const hand = { x: 13, y: 63 };
      armTo(T.shoulder, hand, 1);
      S.extras.push({ type: 'sparkler', at: hand, dir: 1 });
    } else if (kind === 'wave') {
      const hand = { x: 15, y: 61 + 2 * Math.sin(t * 9) };
      armTo(T.shoulder, hand, 1);
      S.extras.push({ type: 'wave', at: hand, dir: 1 });
    } else armTo(T.shoulder, { x: 13, y: 63 }, 1);
  }
  else { // crawl
    const y = Math.max(10, h - 4);
    const hip = { x: -dir * 10, y }, shoulder = { x: dir * 10, y };
    Object.assign(S, { hip, shoulder, lean: Math.PI / 2, head: { x: dir * 18, y: y - 3 } });
    for (const s of [-1, 1]) {                      // knees on the ground, shins trailing
      const knee = { x: hip.x + s * 2, y: Math.max(0, y - TH) };
      S.legs.push({ mid: knee, end: { x: knee.x - dir * SH, y: 0 }, start: hip });
      S.feet.push({ x: knee.x - dir * SH, y: 0, out: -dir });
      S.arms.push(ik(shoulder, { x: shoulder.x + s * 3 + dir * 2, y: 0 }, UA, FA, -dir));
    }
    S.sweat = 2; S.shake = true;
  }
  return S;
}

/* ---------------------------------------------------------------
   5. Render one figure.
   o = { x, ground, plate, dir, kind, mine, host, t, scale }
     x      – feet centre (SVG x)
     ground – SVG y of the floor under this figure
     plate  – SVG y of the plate UNDERSIDE directly above x
     dir    – +1/-1, face the plate centre (x<0 → +1)
     kind   – 'hip' | 'wave' | 'sparkler' | 'flamingo' (relaxed pose only)
     mine   – the current guest (gold body + head)
     host   – wears a little party hat
     t      – seconds, for wave/sparkler/shake animation (0 for static)
   --------------------------------------------------------------- */
export function figure(o) {
  const t = o.t || 0, dir = o.dir || 1;
  let ground = o.ground, h = o.ground - (o.plate ?? o.ground - 60), stool = 0;
  if (!o.pose && h >= 72) { stool = Math.min(36, Math.ceil((h - 64) / 12) * 12); ground -= stool; h -= stool; }
  const pose = o.pose || poseFor(h);
  if (pose === 'cheer') {
    h = 60;
    ground -= Math.max(0, Math.sin(t * 5 + (o.phase || 0))) * 5;
  }
  const S = skeleton(pose, h, dir, o.kind || 'hip', t);

  const jx = S.shake ? Math.sin(t * 45) * 0.6 : 0;
  const X = p => (o.x + p.x + jx).toFixed(1), Y = p => (ground - p.y).toFixed(1);
  const P = p => `${X(p)} ${Y(p)}`;
  let out = '';

  if (stool) {                                           // little wooden crate
    const x0 = o.x - 10, y0 = o.ground - stool;
    out += `<g class="fg-stool"><rect x="${x0}" y="${y0}" width="20" height="${stool}" rx="1.5"/>`
      + `<path d="M${x0} ${y0} L${x0 + 20} ${o.ground} M${x0 + 20} ${y0} L${x0} ${o.ground}"/></g>`;
  }

  // legs (drawn first, behind the body)
  S.legs.forEach((l, i) => {
    const start = l.start || { x: S.hip.x + (i ? 2 : -2), y: S.hip.y };
    out += `<path class="fg-limb" d="M${P(start)} L${P(l.mid)} L${P(l.end)}"/>`;
  });
  // feet: small ink ovals pointing outward (tiptoe = tilted up)
  S.feet.forEach(f => {
    const fx = o.x + f.x + jx + f.out * 2.2, fy = ground - (S.tip ? S.tip * 0.4 : 0) - 1;
    out += `<ellipse class="fg-foot" cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" rx="${S.tip ? 2.6 : 3.8}" ry="2.2" transform="rotate(${S.tip ? f.out * 55 : 0} ${fx.toFixed(1)} ${fy.toFixed(1)})"/>`;
  });
  // torso: narrow oval with a scribble, rotated to the lean
  const mid = { x: (S.hip.x + S.shoulder.x) / 2, y: (S.hip.y + S.shoulder.y) / 2 };
  const rot = (dir * S.lean * 180 / Math.PI).toFixed(1);
  out += `<g transform="translate(${X(mid)} ${Y(mid)}) rotate(${rot})">`
    + `<ellipse class="fg-body" rx="4.6" ry="${TORSO / 2 + 1}"/>`
    + `<path class="fg-scribble" d="M-2 -6 L2 -3 L-2 0 L2 3 L-1 6"/></g>`;
  // arms (in front of the body)
  S.arms.forEach(a => {
    out += `<path class="fg-limb" d="M${P(S.shoulder)} L${P(a.mid)} L${P(a.end)}"/>`
      + `<circle class="fg-hand" cx="${X(a.end)}" cy="${Y(a.end)}" r="1.6"/>`;
  });
  // head
  out += `<circle class="fg-head" cx="${X(S.head)}" cy="${Y(S.head)}" r="${R}"/>`;
  if (o.host) {                                           // party hat, tilted with the head
    const ang = (dir * (pose === 'back' ? S.lean + 0.9 : pose === 'squat' ? S.lean + 0.6 : 0) * 180 / Math.PI).toFixed(1);
    out += `<g transform="translate(${X(S.head)} ${Y(S.head)}) rotate(${ang})"><path class="fg-hat" d="M-4.5 -4.5 L0 -15 L4.5 -4.5 Z"/><circle class="fg-pom" cx="0" cy="-15.5" r="1.8"/></g>`;
  }
  // sweat drops beside the head (away from the facing direction)
  for (let i = 0; i < S.sweat; i++) {
    const sx = o.x + S.head.x - dir * (9 + i * 4) + jx, sy = ground - S.head.y - 2 + i * 5;
    out += `<path class="fg-sweat" d="M${sx} ${sy - 3} q2.4 3.4 0 4.6 q-2.4 -1.2 0 -4.6z"/>`;
  }
  // extras
  S.extras.forEach(e => {
    const ex = o.x + e.at.x + jx, ey = ground - e.at.y;
    if (e.type === 'wave') out += `<path class="fg-motion" d="M${ex + e.dir * 4} ${ey - 5} q${e.dir * 3} 5 0 10 M${ex + e.dir * 7} ${ey - 7} q${e.dir * 4} 7 0 14"/>`;
    if (e.type === 'sparkler') {
      const tx = ex + e.dir * 5, ty = ey - 16;
      out += `<path class="fg-limb thin" d="M${ex} ${ey} L${tx} ${ty}"/>`;
      let rays = '';
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + t * 3, r1 = 2, r2 = 4.5 + (i % 2) * 2;
        rays += `M${(tx + Math.cos(a) * r1).toFixed(1)} ${(ty + Math.sin(a) * r1).toFixed(1)} L${(tx + Math.cos(a) * r2).toFixed(1)} ${(ty + Math.sin(a) * r2).toFixed(1)} `; }
      out += `<path class="fg-spark" d="${rays}"/>`;
    }
    if (e.type === 'effort') out += `<path class="fg-motion" d="M${ex - 3} ${ey - 2} q3 -3 6 0 M${ex - 1} ${ey - 6} q3 -3 6 0"/>`;
  });

  const s = o.scale ?? 1;
  return `<g class="fg${o.mine ? ' fg-mine' : ''}" data-pose="${pose}" transform="translate(${o.x} ${o.ground}) scale(${s}) translate(${-o.x} ${-o.ground})">${out}</g>`;
}

/* ---------------------------------------------------------------
   6. Placement helpers for the plate scene.
   --------------------------------------------------------------- */
// Even spacing under the middle 75% of the plate. One person stands just left of centre.
export function layoutX(n, plateHalf) {
  if (n <= 0) return [];
  if (n === 1) return [-plateHalf * 0.12];
  const span = plateHalf * 1.5;
  return Array.from({ length: n }, (_, i) => -span / 2 + span * i / (n - 1));
}
// SVG y of the plate underside above world x. cy = plate centre y, thick = plate thickness, deg = tilt.
export function plateUnderside(x, cy, thick, deg) {
  const a = deg * Math.PI / 180;
  return cy + x * Math.tan(a) + (thick / 2) / Math.cos(a);
}

/* ---------------------------------------------------------------
   6b. The shared platter — same hand-drawn language as the original scale:
   paper fill, 2.2 ink outline, a visible rim edge with hatching, an inner well
   line and a ring of tiny festive dots. Drawn in LOCAL coords (centre 0,0);
   rotate the group by the tilt around the plate centre.
   --------------------------------------------------------------- */
export const PLATTER = { HALF: 210, RY: 10, EDGE: 6 };
// Distance from the platter centre line down to its underside at local x = u.
export function platterUndersideLocal(u) {
  const { HALF, RY, EDGE } = PLATTER, k = Math.min(1, Math.abs(u) / HALF);
  return RY * Math.sqrt(1 - k * k) + EDGE;
}
// SVG y of the platter underside above world x. cy = platter centre y, deg = tilt.
export function platterUnderside(x, cy, deg) {
  const a = deg * Math.PI / 180, u = x / Math.cos(a);
  return cy + u * Math.sin(a) + platterUndersideLocal(u) * Math.cos(a);
}
export function platterSVG() {
  const { HALF: H, RY, EDGE } = PLATTER;
  let hatch = '';
  for (let x = -H + 18; x <= H - 18; x += 13) {
    const yb = RY * Math.sqrt(1 - (x / H) ** 2);
    hatch += `M${x} ${(yb + 1.2).toFixed(1)} L${x - 4} ${(yb + EDGE - 0.8).toFixed(1)} `;
  }
  const cols = ['var(--hl)', 'var(--swt)', 'var(--sav)'];
  let dots = '';
  for (let i = 0; i < 24; i++) {
    const th = (i + 0.5) / 24 * Math.PI * 2;
    dots += `<circle cx="${((H - 11) * Math.cos(th)).toFixed(1)}" cy="${((RY - 2.6) * Math.sin(th)).toFixed(1)}" r="1.7" fill="${cols[i % 3]}"/>`;
  }
  return `<path class="pl-edge" d="M${-H} 0 A${H} ${RY} 0 0 0 ${H} 0 L${H} ${EDGE} A${H} ${RY} 0 0 1 ${-H} ${EDGE} Z"/>`
    + `<path class="pl-hatch" d="${hatch}"/>`
    + `<ellipse class="pl-top" cx="0" cy="0" rx="${H}" ry="${RY}"/>`
    + `<ellipse class="pl-well" cx="0" cy="0.6" rx="${H - 22}" ry="${RY - 5}"/>`
    + `<g class="pl-dots">${dots}</g>`;
}
// Where dish i (0-based) of a side sits on the platter, in local coords.
// Alternates back/front rows outward from the centre; 12 max per side.
export function dishSlot(side, i) {
  const sg = side === 'sav' ? -1 : 1, row = i % 2, col = Math.floor(i / 2);
  return { x: sg * (24 + col * 30 + (row ? 15 : 0)), y: row ? 3.2 : -3.2, back: !row };
}

/* ---------------------------------------------------------------
   7. Styles these classes expect (put in your CSS):
   .fg-limb{fill:none;stroke:var(--ink);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
   .fg-limb.thin{stroke-width:1.4}
   .fg-body,.fg-head{fill:var(--card);stroke:var(--ink);stroke-width:2.2}
   .fg-scribble{fill:none;stroke:var(--ink);stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round;opacity:.7}
   .fg-foot,.fg-hand{fill:var(--ink)}
   .fg-mine .fg-body,.fg-mine .fg-head{fill:var(--hl)}
   .fg-hat{fill:var(--sav);stroke:var(--ink);stroke-width:1.4;stroke-linejoin:round}
   .fg-pom{fill:var(--swt);stroke:var(--ink);stroke-width:1}
   .fg-sweat{fill:#8fc6e8;stroke:var(--ink);stroke-width:.9}
   .fg-motion{fill:none;stroke:var(--ink);stroke-width:1.2;stroke-linecap:round;opacity:.6}
   .fg-spark{fill:none;stroke:var(--hl);stroke-width:1.6;stroke-linecap:round}
   .fg-stool rect{fill:#e9c993;stroke:var(--ink);stroke-width:1.8}
   .fg-stool path{fill:none;stroke:var(--ink);stroke-width:1.2;opacity:.6}
   .pl-top{fill:var(--card);stroke:var(--ink);stroke-width:2.2}
   .pl-edge{fill:color-mix(in srgb,var(--ink) 9%,var(--card));stroke:var(--ink);stroke-width:2.2;stroke-linejoin:round}
   .pl-hatch{fill:none;stroke:var(--ink);stroke-width:1;stroke-linecap:round;opacity:.45}
   .pl-well{fill:none;stroke:var(--ink);stroke-width:1.2;opacity:.5}
   .pl-dots circle{stroke:var(--ink);stroke-width:.6}
   .dish-shadow{fill:var(--ink);opacity:.12}
   --------------------------------------------------------------- */
