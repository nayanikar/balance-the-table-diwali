/* RSVP Step 1 embed bundle */

// src/figures.js
var BODY = {
  R: 6,
  // head radius
  NECK: 2,
  TORSO: 20,
  // hip → shoulder
  UA: 11,
  // upper arm
  FA: 11,
  // forearm
  TH: 12,
  // thigh
  SH: 12
  // shin
};
var { R, NECK, TORSO, UA, FA, TH, SH } = BODY;
var POSES = [
  { name: "stool", min: 72, note: "Plate too high to reach: climbs onto a little crate." },
  { name: "tiptoe", min: 64, note: "Up on tiptoes, both arms straight." },
  { name: "relaxed", min: 57, note: "One palm up like a waiter. Free hand has a personality." },
  { name: "both", min: 50, note: "Both hands, elbows bent, knees softening." },
  { name: "squat", min: 36, note: "Wide squat, leaning in, head tucked. One sweat drop." },
  { name: "back", min: 22, note: "Heavy corner: bent over, plate on the upper back, hands on knees. Sweat + shake." },
  { name: "crawl", min: 0, note: "On hands and knees like a little table. Maximum drama." }
];
var poseFor = (h) => (POSES.find((p) => h >= p.min) || POSES[POSES.length - 1]).name;
var KINDS = ["hip", "wave", "sparkler", "flamingo"];
function kindFor(id) {
  let h = 0;
  for (const c of String(id)) h = h * 31 + c.charCodeAt(0) | 0;
  return KINDS[Math.abs(h) % KINDS.length];
}
function ik(a, b, l1, l2, bend) {
  let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-3;
  if (d >= l1 + l2) {
    const k = (l1 + l2) / d;
    return { mid: { x: a.x + dx * l1 / d, y: a.y + dy * l1 / d }, end: { x: a.x + dx * k, y: a.y + dy * k } };
  }
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const off = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const mx = a.x + dx * along / d, my = a.y + dy * along / d, px = -dy / d, py = dx / d;
  let mid = { x: mx + px * off, y: my + py * off };
  if ((mid.x - mx) * bend < 0 || Math.abs(mid.x - mx) < 1e-6 && bend < 0) mid = { x: mx - px * off, y: my - py * off };
  return { mid, end: b };
}
var clamp = (v, a, b) => Math.max(a, Math.min(b, v));
var add = (p, v, k = 1) => ({ x: p.x + v.x * k, y: p.y + v.y * k });
function skeleton(pose, h, dir, kind, t) {
  const S = { feet: [], legs: [], arms: [], extras: [], sweat: 0, shake: false, tip: 0 };
  const torso = (hip, lean) => {
    const u = { x: dir * Math.sin(lean), y: Math.cos(lean) };
    return { hip, shoulder: add(hip, u, TORSO), u, lean };
  };
  const head = (sh, tilt) => add(sh, { x: dir * Math.sin(tilt), y: Math.cos(tilt) }, NECK + R);
  const legsTo = (hip, stance, kneeBend) => {
    for (const s of [-1, 1]) {
      const foot = { x: s * stance, y: S.tip };
      const bend = kneeBend === "out" ? s : dir;
      S.legs.push(ik({ x: hip.x + s * 2, y: hip.y }, foot, TH, SH, bend));
      S.feet.push({ x: foot.x, y: 0, out: kneeBend === "fwd" ? dir : s });
    }
  };
  const armTo = (sh, hand, bend) => S.arms.push(ik(sh, hand, UA, FA, bend));
  if (pose === "tiptoe") {
    S.tip = clamp(h - 63, 0, 7);
    const T = torso({ x: 0, y: 23 + S.tip }, 0);
    Object.assign(S, T, { head: head(T.shoulder, 0) });
    legsTo(T.hip, 4, "out");
    armTo(T.shoulder, { x: -6, y: h }, -1);
    armTo(T.shoulder, { x: 6, y: h }, 1);
  } else if (pose === "relaxed") {
    const T = torso({ x: 0, y: 23 }, 0);
    Object.assign(S, T, { head: head(T.shoulder, 0) });
    const hs = dir;
    armTo(T.shoulder, { x: hs * 8, y: h }, hs);
    if (kind === "flamingo") {
      S.legs.push(ik({ x: -hs * 2, y: 23 }, { x: -hs * 5, y: 0 }, TH, SH, -hs));
      S.feet.push({ x: -hs * 5, y: 0, out: -hs });
      S.legs.push(ik({ x: hs * 2, y: 23 }, { x: -hs * 1, y: 11 }, TH, SH, hs));
      armTo(T.shoulder, { x: -hs * 18, y: 45 }, -hs);
    } else {
      legsTo(T.hip, 5, "out");
      if (kind === "hip") armTo(T.shoulder, { x: -hs * 6, y: 24 }, -hs);
      if (kind === "wave") {
        const hand = { x: -hs * 15, y: 53 + 2 * Math.sin(t * 9) };
        armTo(T.shoulder, hand, -hs);
        S.extras.push({ type: "wave", at: hand, dir: -hs });
      }
      if (kind === "sparkler") {
        const hand = { x: -hs * 13, y: 36 };
        armTo(T.shoulder, hand, -hs);
        S.extras.push({ type: "sparkler", at: hand, dir: -hs });
      }
    }
  } else if (pose === "both") {
    const drop = Math.max(0, 58 - h);
    const T = torso({ x: 0, y: 23 - drop }, 0);
    Object.assign(S, T, { head: head(T.shoulder, 0) });
    legsTo(T.hip, 6, "out");
    armTo(T.shoulder, { x: -7, y: h }, -1);
    armTo(T.shoulder, { x: 7, y: h }, 1);
  } else if (pose === "squat") {
    const k = clamp((50 - h) / 14, 0, 1);
    const lean = 0.15 + 0.35 * k, tilt = lean + 0.6;
    const top = TORSO * Math.cos(lean) + (NECK + R) * Math.cos(tilt) + R;
    const T = torso({ x: 0, y: h - top - 1 }, lean);
    Object.assign(S, T, { head: head(T.shoulder, tilt) });
    legsTo(T.hip, 11, "out");
    armTo(T.shoulder, { x: dir * 3 - 9, y: h }, -1);
    armTo(T.shoulder, { x: dir * 3 + 9, y: h }, 1);
    S.sweat = 1;
  } else if (pose === "back") {
    const k = clamp((36 - h) / 14, 0, 1);
    const lean = 1 + 0.4 * k;
    const hipY = h - (TORSO * Math.cos(lean) + 4 * Math.sin(lean));
    const T = torso({ x: -dir * 4, y: hipY }, lean);
    Object.assign(S, T, { head: head(T.shoulder, lean + 0.9) });
    legsTo(T.hip, 10, "fwd");
    const knees = S.legs.map((l) => l.mid);
    armTo(T.shoulder, add(knees[0], { x: dir * 2, y: 2 }), -dir);
    armTo(T.shoulder, add(knees[1], { x: dir * 2, y: 2 }), -dir);
    S.sweat = 2;
    S.shake = true;
    S.extras.push({ type: "effort", at: add(T.shoulder, { x: -dir * 6, y: 10 }) });
  } else if (pose === "cheer") {
    const T = torso({ x: 0, y: 23 }, 0);
    Object.assign(S, T, { head: head(T.shoulder, 0) });
    legsTo(T.hip, 5, "out");
    armTo(T.shoulder, { x: -13, y: 63 }, -1);
    if (kind === "sparkler") {
      const hand = { x: 13, y: 63 };
      armTo(T.shoulder, hand, 1);
      S.extras.push({ type: "sparkler", at: hand, dir: 1 });
    } else if (kind === "wave") {
      const hand = { x: 15, y: 61 + 2 * Math.sin(t * 9) };
      armTo(T.shoulder, hand, 1);
      S.extras.push({ type: "wave", at: hand, dir: 1 });
    } else armTo(T.shoulder, { x: 13, y: 63 }, 1);
  } else {
    const y = Math.max(10, h - 4);
    const hip = { x: -dir * 10, y }, shoulder = { x: dir * 10, y };
    Object.assign(S, { hip, shoulder, lean: Math.PI / 2, head: { x: dir * 18, y: y - 3 } });
    for (const s of [-1, 1]) {
      const knee = { x: hip.x + s * 2, y: Math.max(0, y - TH) };
      S.legs.push({ mid: knee, end: { x: knee.x - dir * SH, y: 0 }, start: hip });
      S.feet.push({ x: knee.x - dir * SH, y: 0, out: -dir });
      S.arms.push(ik(shoulder, { x: shoulder.x + s * 3 + dir * 2, y: 0 }, UA, FA, -dir));
    }
    S.sweat = 2;
    S.shake = true;
  }
  return S;
}
function figure(o) {
  const t = o.t || 0, dir = o.dir || 1;
  let ground = o.ground, h = o.ground - (o.plate ?? o.ground - 60), stool = 0;
  if (!o.pose && h >= 72) {
    stool = Math.min(36, Math.ceil((h - 64) / 12) * 12);
    ground -= stool;
    h -= stool;
  }
  const pose = o.pose || poseFor(h);
  if (pose === "cheer") {
    h = 60;
    ground -= Math.max(0, Math.sin(t * 5 + (o.phase || 0))) * 5;
  }
  const S = skeleton(pose, h, dir, o.kind || "hip", t);
  const jx = S.shake ? Math.sin(t * 45) * 0.6 : 0;
  const X = (p) => (o.x + p.x + jx).toFixed(1), Y = (p) => (ground - p.y).toFixed(1);
  const P = (p) => `${X(p)} ${Y(p)}`;
  let out = "";
  if (stool) {
    const x0 = o.x - 10, y0 = o.ground - stool;
    out += `<g class="fg-stool"><rect x="${x0}" y="${y0}" width="20" height="${stool}" rx="1.5"/><path d="M${x0} ${y0} L${x0 + 20} ${o.ground} M${x0 + 20} ${y0} L${x0} ${o.ground}"/></g>`;
  }
  S.legs.forEach((l, i) => {
    const start = l.start || { x: S.hip.x + (i ? 2 : -2), y: S.hip.y };
    out += `<path class="fg-limb" d="M${P(start)} L${P(l.mid)} L${P(l.end)}"/>`;
  });
  S.feet.forEach((f) => {
    const fx = o.x + f.x + jx + f.out * 2.2, fy = ground - (S.tip ? S.tip * 0.4 : 0) - 1;
    out += `<ellipse class="fg-foot" cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" rx="${S.tip ? 2.6 : 3.8}" ry="2.2" transform="rotate(${S.tip ? f.out * 55 : 0} ${fx.toFixed(1)} ${fy.toFixed(1)})"/>`;
  });
  const mid = { x: (S.hip.x + S.shoulder.x) / 2, y: (S.hip.y + S.shoulder.y) / 2 };
  const rot = (dir * S.lean * 180 / Math.PI).toFixed(1);
  out += `<g transform="translate(${X(mid)} ${Y(mid)}) rotate(${rot})"><ellipse class="fg-body" rx="4.6" ry="${TORSO / 2 + 1}"/><path class="fg-scribble" d="M-2 -6 L2 -3 L-2 0 L2 3 L-1 6"/></g>`;
  S.arms.forEach((a) => {
    out += `<path class="fg-limb" d="M${P(S.shoulder)} L${P(a.mid)} L${P(a.end)}"/><circle class="fg-hand" cx="${X(a.end)}" cy="${Y(a.end)}" r="1.6"/>`;
  });
  out += `<circle class="fg-head" cx="${X(S.head)}" cy="${Y(S.head)}" r="${R}"/>`;
  if (o.host) {
    const ang = (dir * (pose === "back" ? S.lean + 0.9 : pose === "squat" ? S.lean + 0.6 : 0) * 180 / Math.PI).toFixed(1);
    out += `<g transform="translate(${X(S.head)} ${Y(S.head)}) rotate(${ang})"><path class="fg-hat" d="M-4.5 -4.5 L0 -15 L4.5 -4.5 Z"/><circle class="fg-pom" cx="0" cy="-15.5" r="1.8"/></g>`;
  }
  for (let i = 0; i < S.sweat; i++) {
    const sx = o.x + S.head.x - dir * (9 + i * 4) + jx, sy = ground - S.head.y - 2 + i * 5;
    out += `<path class="fg-sweat" d="M${sx} ${sy - 3} q2.4 3.4 0 4.6 q-2.4 -1.2 0 -4.6z"/>`;
  }
  S.extras.forEach((e) => {
    const ex = o.x + e.at.x + jx, ey = ground - e.at.y;
    if (e.type === "wave") out += `<path class="fg-motion" d="M${ex + e.dir * 4} ${ey - 5} q${e.dir * 3} 5 0 10 M${ex + e.dir * 7} ${ey - 7} q${e.dir * 4} 7 0 14"/>`;
    if (e.type === "sparkler") {
      const tx = ex + e.dir * 5, ty = ey - 16;
      out += `<path class="fg-limb thin" d="M${ex} ${ey} L${tx} ${ty}"/>`;
      let rays = "";
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + t * 3, r1 = 2, r2 = 4.5 + i % 2 * 2;
        rays += `M${(tx + Math.cos(a) * r1).toFixed(1)} ${(ty + Math.sin(a) * r1).toFixed(1)} L${(tx + Math.cos(a) * r2).toFixed(1)} ${(ty + Math.sin(a) * r2).toFixed(1)} `;
      }
      out += `<path class="fg-spark" d="${rays}"/>`;
    }
    if (e.type === "effort") out += `<path class="fg-motion" d="M${ex - 3} ${ey - 2} q3 -3 6 0 M${ex - 1} ${ey - 6} q3 -3 6 0"/>`;
  });
  const s = o.scale ?? 1;
  return `<g class="fg${o.mine ? " fg-mine" : ""}" data-pose="${pose}" transform="translate(${o.x} ${o.ground}) scale(${s}) translate(${-o.x} ${-o.ground})">${out}</g>`;
}

// src/rsvp-hero-lights.js
function cubicAt(t, p0, p1, p2, p3) {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
    y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y
  };
}
var WIRE_SEGMENTS = [
  {
    p0: { x: 26, y: 138 },
    p1: { x: 38, y: 62 },
    p2: { x: 92, y: 26 },
    p3: { x: 112, y: 72 }
  },
  {
    p0: { x: 112, y: 72 },
    p1: { x: 132, y: 112 },
    p2: { x: 172, y: 128 },
    p3: { x: 162, y: 52 }
  },
  {
    p0: { x: 162, y: 52 },
    p1: { x: 152, y: 22 },
    p2: { x: 238, y: 12 },
    p3: { x: 294, y: 34 }
  }
];
var HERO_VIEW_W = 320;
var HERO_VIEW_H = 180;
var HERO_G = 152;
var WIRE_PATH_D = "M 26 138 C 38 62 92 26 112 72 C 132 112 172 128 162 52 C 152 22 238 12 294 34";
var SEG_SAMPLES = 24;
function wirePolyline() {
  const pts = [];
  for (const seg of WIRE_SEGMENTS) {
    for (let i = 0; i < SEG_SAMPLES; i++) {
      if (seg !== WIRE_SEGMENTS[0] && i === 0) continue;
      pts.push(cubicAt(i / SEG_SAMPLES, seg.p0, seg.p1, seg.p2, seg.p3));
    }
  }
  pts.push(WIRE_SEGMENTS[WIRE_SEGMENTS.length - 1].p3);
  return pts;
}
function cumulativeLengths(pts) {
  const len = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    len.push(len[i - 1] + Math.hypot(dx, dy));
  }
  return len;
}
function pointAtLength(pts, cum, d) {
  const total = cum[cum.length - 1];
  if (d <= 0) return { ...pts[0] };
  if (d >= total) return { ...pts[pts.length - 1] };
  let i = 1;
  while (i < cum.length && cum[i] < d) i++;
  const segLen = cum[i] - cum[i - 1] || 1;
  const t = (d - cum[i - 1]) / segLen;
  return {
    x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
    y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t
  };
}
function sampleBulbs(count = 16) {
  const pts = wirePolyline();
  const cum = cumulativeLengths(pts);
  const total = cum[cum.length - 1];
  const cols = ["a", "b", "c", "d", "e"];
  const bulbs = [];
  for (let i = 0; i < count; i++) {
    const d = (i + 0.5) / count * total;
    const p = pointAtLength(pts, cum, d);
    bulbs.push({ x: p.x, y: p.y, c: cols[i % cols.length] });
  }
  return bulbs;
}
function wireYAt(x) {
  const pts = wirePolyline();
  let best = pts[0];
  let bestD = Math.abs(pts[0].x - x);
  for (const p of pts) {
    const d = Math.abs(p.x - x);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best.y;
}
function buildBulbMarkup(bulbs) {
  return bulbs.map(
    ({ x, y, c }) => `<line class="ln thin" x1="${x.toFixed(1)}" y1="${(y - 7).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y - 11).toFixed(1)}"/><circle class="bulb bulb-${c}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5"/>`
  ).join("");
}

// src/step-nav.js
function stepNavHtml(labelEsc) {
  return `<nav class="step-nav" aria-label="Progress">
    <button type="button" class="step-arrow" data-step-prev aria-label="Previous step" disabled>
      <svg class="step-arrow-icon" viewBox="0 0 8 10" aria-hidden="true"><path d="M8 0 0 5l8 5V0z"/></svg>
    </button>
    <span class="step-label">${labelEsc}</span>
    <button type="button" class="step-arrow" data-step-next aria-label="Next step" disabled>
      <svg class="step-arrow-icon" viewBox="0 0 8 10" aria-hidden="true"><path d="M0 0l8 5-8 5V0z"/></svg>
    </button>
  </nav>`;
}
function setStepNavState(root, { prev, next }) {
  const prevBtn = root.querySelector("[data-step-prev]");
  const nextBtn = root.querySelector("[data-step-next]");
  if (prevBtn && prev !== void 0) prevBtn.disabled = !prev;
  if (nextBtn && next !== void 0) nextBtn.disabled = !next;
}

// src/rsvp-attendance.js
var STYLE_URL = new URL("./rsvp-attendance.css", import.meta.url).href;
var FONT_URL = "https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Patrick+Hand&display=swap";
var INLINE_CSS = true ? ':host {\n  display: flex;\n  flex: 1;\n  flex-direction: column;\n  width: 100%;\n  min-height: 0;\n  --bg: #c9890a;\n  --card: #fff8eb;\n  --ink: #3d1212;\n  --muted: #8f5c4a;\n  --hl: #e8b923;\n  --step-scene-h: 260px;\n  color: var(--ink);\n  font-family: "Patrick Hand", ui-rounded, system-ui, sans-serif;\n  font-size: 18px;\n}\n\n*,\n*::before,\n*::after {\n  box-sizing: border-box;\n}\n\n.rsvp-step {\n  position: relative;\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  text-align: center;\n  width: 100%;\n  min-height: 100%;\n  padding: 0;\n  margin: 0;\n  background: transparent;\n  box-shadow: none;\n  overflow: visible;\n}\n\n.step-nav {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 12px;\n  margin: 0 0 10px;\n  font-family: ui-sans-serif, system-ui, sans-serif;\n  font-size: 12px;\n  font-weight: 600;\n  letter-spacing: 0.16em;\n  text-transform: uppercase;\n}\n\n.step-nav[hidden] {\n  display: none !important;\n}\n\n.step-label {\n  font: inherit;\n  color: var(--muted);\n  text-align: center;\n}\n\n.step-arrow {\n  flex: 0 0 auto;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 24px;\n  height: 24px;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  cursor: pointer;\n  color: var(--ink);\n}\n\n.step-arrow:focus-visible {\n  outline: 3px solid var(--hl);\n  outline-offset: 2px;\n  border-radius: 2px;\n}\n\n.step-arrow:disabled {\n  opacity: 0.2;\n  cursor: default;\n  pointer-events: none;\n}\n\n.step-arrow-icon {\n  display: block;\n  width: 8px;\n  height: 10px;\n  fill: currentColor;\n}\n\n.step-title {\n  font-family: "Caveat", cursive;\n  font-weight: 700;\n  font-size: 48px;\n  line-height: 1.05;\n  margin: 0 0 12px;\n  letter-spacing: 0.02em;\n  max-width: 100%;\n}\n\n.step-body {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  width: 100%;\n  min-height: 0;\n}\n\n.step-scene {\n  width: 100%;\n  max-width: 560px;\n  height: var(--step-scene-h);\n  margin: 8px auto 16px;\n  display: flex;\n  align-items: flex-end;\n  justify-content: center;\n  overflow: hidden;\n  flex-shrink: 0;\n}\n\n.step-scene svg {\n  width: 100%;\n  height: 100%;\n  display: block;\n  overflow: visible;\n}\n\n.step-content {\n  width: 100%;\n  max-width: 560px;\n  flex: 1 1 auto;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  min-height: 0;\n}\n\n.panel {\n  width: 100%;\n  text-align: center;\n  position: relative;\n}\n\n.label {\n  font-family: "Caveat", cursive;\n  font-weight: 700;\n  font-size: 30px;\n  margin: 2px 0 10px;\n}\n\n.sub {\n  text-align: center;\n  margin: 0 auto;\n  max-width: 300px;\n  color: var(--muted);\n  line-height: 1.3;\n}\n\n.step-actions {\n  display: flex;\n  gap: 16px;\n  justify-content: center;\n  flex-wrap: wrap;\n  margin-top: auto;\n  padding-top: 16px;\n  width: 100%;\n  max-width: 560px;\n}\n\n.step-actions .ink-btn,\n.step-actions .btn {\n  flex: 0 1 260px;\n  min-height: 52px;\n}\n\n.ln {\n  fill: none;\n  stroke: var(--ink);\n  stroke-width: 2.2;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n}\n\n.thin {\n  stroke-width: 1.4;\n}\n\n.solid {\n  fill: var(--card);\n  stroke: var(--ink);\n  stroke-width: 2.2;\n  stroke-linejoin: round;\n}\n\n.inkfill {\n  fill: var(--ink);\n}\n\n.choices {\n  display: contents;\n}\n\n.choices-col {\n  display: flex;\n  flex-direction: row;\n  align-items: stretch;\n  justify-content: center;\n  flex-wrap: nowrap;\n  gap: 16px;\n  width: 100%;\n}\n\n.choices-col .ink-btn,\n.choices-col .btn {\n  flex: 1 1 260px;\n  min-width: 0;\n}\n\n@media (max-width: 560px) {\n  .step-title {\n    font-size: 40px;\n  }\n\n  .step-scene {\n    height: 200px;\n  }\n\n  .step-actions .ink-btn,\n  .step-actions .btn,\n  .choices-col {\n    flex-direction: column;\n    align-items: stretch;\n  }\n\n  .choices-col .ink-btn,\n  .choices-col .btn {\n    flex: none;\n    width: 100%;\n  }\n}\n\n.btn,\n.ink-btn {\n  font-family: "Patrick Hand", ui-rounded, system-ui, sans-serif;\n  font-size: 19px;\n  font-weight: 400;\n  font-style: normal;\n  line-height: 1.1;\n  color: var(--ink);\n  background: var(--card);\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n  padding: 9px 22px;\n  min-height: 52px;\n  border: 2.2px solid var(--ink);\n  border-radius: 255px 18px 225px 18px / 18px 225px 18px 255px;\n  box-shadow: 3px 3px 0 var(--ink);\n  transition: transform 0.08s, box-shadow 0.08s;\n  letter-spacing: 0.06em;\n  text-transform: uppercase;\n}\n\n.btn.primary,\n.ink-btn {\n  background: var(--ink);\n  color: var(--card);\n}\n\n.btn:hover,\n.ink-btn:hover {\n  transform: translate(-1px, -1px) rotate(-1deg);\n  box-shadow: 4px 4px 0 var(--ink);\n}\n\n.btn.primary:hover,\n.btn.primary:active,\n.ink-btn:hover,\n.ink-btn:active {\n  color: var(--card);\n}\n\n.btn:active,\n.ink-btn:active {\n  transform: translate(2px, 2px);\n  box-shadow: 1px 1px 0 var(--ink);\n}\n\n.btn:focus-visible,\n.ink-btn:focus-visible,\n.link:focus-visible {\n  outline: 3px solid var(--hl);\n  outline-offset: 3px;\n}\n\n.btn[disabled] {\n  opacity: 0.5;\n  pointer-events: none;\n}\n\n.name-input,\n.allergies-input {\n  flex: 1 1 auto;\n  width: 100%;\n  min-height: 52px;\n  margin: 0;\n  padding: 9px 22px;\n  font-family: "Patrick Hand", ui-rounded, system-ui, sans-serif;\n  font-size: 19px;\n  font-weight: 400;\n  line-height: 1.1;\n  color: var(--card);\n  background: var(--ink);\n  border: 2.2px solid var(--ink);\n  border-radius: 255px 18px 225px 18px / 18px 225px 18px 255px;\n  box-shadow: 3px 3px 0 var(--ink);\n  text-transform: none;\n  letter-spacing: 0.02em;\n}\n\n.name-input::placeholder,\n.allergies-input::placeholder {\n  color: color-mix(in srgb, var(--card) 55%, transparent);\n}\n\n.name-input:focus,\n.allergies-input:focus {\n  outline: 3px solid var(--hl);\n  outline-offset: 3px;\n}\n\n.link {\n  font: inherit;\n  background: none;\n  border: 0;\n  color: var(--muted);\n  cursor: pointer;\n  margin-top: 12px;\n  text-decoration: none;\n}\n\n.link:hover {\n  color: var(--ink);\n}\n\n.done .step-title {\n  font-size: 40px;\n  margin-bottom: 8px;\n}\n\n.done p {\n  margin: 0 auto;\n  max-width: 290px;\n  line-height: 1.3;\n}\n\n.fade {\n  animation: fade 0.35s ease both;\n}\n\n@keyframes fade {\n  from {\n    opacity: 0;\n    transform: translateY(6px);\n  }\n}\n\n.sr {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  overflow: hidden;\n  clip: rect(0 0 0 0);\n}\n\n@media (prefers-reduced-motion: reduce) {\n  :host *,\n  :host *::before,\n  :host *::after {\n    animation: none !important;\n    transition: none !important;\n  }\n}\n\n@media (max-width: 420px) {\n  .btn,\n  .ink-btn {\n    font-size: 17px;\n    padding: 8px 16px;\n  }\n}\n\n.fg-limb {\n  fill: none;\n  stroke: var(--ink);\n  stroke-width: 2.2;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n}\n\n.fg-limb.thin {\n  stroke-width: 1.4;\n}\n\n.fg-body,\n.fg-head {\n  fill: var(--card);\n  stroke: var(--ink);\n  stroke-width: 2.2;\n}\n\n.fg-scribble {\n  fill: none;\n  stroke: var(--ink);\n  stroke-width: 1.1;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n  opacity: 0.7;\n}\n\n.fg-foot,\n.fg-hand {\n  fill: var(--ink);\n}\n\n.fg-mine .fg-body,\n.fg-mine .fg-head {\n  fill: var(--hl);\n}\n\n.fg-hat {\n  fill: var(--sav);\n  stroke: var(--ink);\n  stroke-width: 1.4;\n  stroke-linejoin: round;\n}\n\n.fg-pom {\n  fill: var(--swt);\n  stroke: var(--ink);\n  stroke-width: 1;\n}\n\n.fg-sweat {\n  fill: #8fc6e8;\n  stroke: var(--ink);\n  stroke-width: 0.9;\n}\n\n.fg-motion {\n  fill: none;\n  stroke: var(--ink);\n  stroke-width: 1.2;\n  stroke-linecap: round;\n  opacity: 0.6;\n}\n\n.fg-spark {\n  fill: none;\n  stroke: var(--hl);\n  stroke-width: 1.6;\n  stroke-linecap: round;\n}\n\n.fg-stool rect {\n  fill: #e9c993;\n  stroke: var(--ink);\n  stroke-width: 1.8;\n}\n\n.fg-stool path {\n  fill: none;\n  stroke: var(--ink);\n  stroke-width: 1.2;\n  opacity: 0.6;\n}\n\n\n.hero .wire {\n  fill: none;\n  stroke-width: 2.2;\n}\n\n.hero .bulb {\n  stroke: var(--ink);\n  stroke-width: 1.4;\n}\n\n.hero .bulb-a {\n  fill: #ffd54f;\n}\n\n.hero .bulb-b {\n  fill: #c62828;\n}\n\n.hero .bulb-c {\n  fill: #c9941a;\n}\n\n.hero .bulb-d {\n  fill: #6b1a1a;\n}\n\n.hero .bulb-e {\n  fill: #ff8f00;\n}\n\n.hero .spark {\n  opacity: 0.55;\n}\n' : void 0;
var instanceCounter = 0;
function esc(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );
}
var LEFT_X = 84;
var RIGHT_X = 252;
function buildHeroFigures(reduceMotion, t) {
  const animT = reduceMotion ? 0 : t;
  const leftPlate = wireYAt(LEFT_X) + 2;
  const rightPlate = wireYAt(RIGHT_X) + 1;
  return figure({
    x: LEFT_X,
    ground: HERO_G,
    plate: leftPlate,
    dir: 1,
    kind: kindFor("rsvp-hero-left"),
    host: true,
    t: animT
  }) + figure({
    x: RIGHT_X,
    ground: HERO_G,
    plate: rightPlate,
    dir: -1,
    kind: "sparkler",
    t: animT
  });
}
function buildRsvpHeroSvg(roughId, turbId, reduceMotion, t) {
  const figs = buildHeroFigures(reduceMotion, t);
  const bulbMarkup = buildBulbMarkup(sampleBulbs(16));
  return `<svg class="hero" viewBox="0 0 ${HERO_VIEW_W} ${HERO_VIEW_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Two friends decorating big Diwali fairy lights">
          <defs>
            <filter id="${roughId}" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence id="${turbId}" type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="2"/>
              <feDisplacementMap in="SourceGraphic" scale="2.4"/>
            </filter>
          </defs>
          <g filter="url(#${roughId})">
            <path class="ln thin" d="M16 ${HERO_G} H304"/>
            <g class="figures" id="heroFigures">${figs}</g>
            <path class="wire ln" d="${WIRE_PATH_D}"/>
            ${bulbMarkup}
            <path class="ln thin spark" d="M98 18 l3 -5 M104 20 l5 2 M100 24 l-4 1"/>
          </g>
        </svg>`;
}
var RsvpAttendance = class extends HTMLElement {
  static observedAttributes = ["event-id", "step-label"];
  /** @type {'intro'|'name'|'declined'|'attending'} */
  #phase = "intro";
  /** @type {string} */
  #uid = "";
  /** @type {ReturnType<typeof setInterval>|null} */
  #boilTimer = null;
  /** @type {number} */
  #boilSeed = 2;
  /** @type {boolean} */
  #reduceMotion = false;
  /** @type {number|null} */
  #heroRaf = null;
  constructor() {
    super();
    this.#uid = `rsvp${++instanceCounter}`;
    this.attachShadow({ mode: "open" });
  }
  connectedCallback() {
    this.#reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.#renderShell();
    this.#bindEvents();
    const saved = this.#readStatus();
    if (saved === "attending") {
      this.#phase = this.#readGuestName() ? "attending" : "name";
      this.#syncFormFields();
    } else if (saved === "declined") {
      this.#phase = "declined";
      this.#syncFormFields();
    } else {
      this.#phase = "intro";
    }
    this.#renderPanel();
    this.#syncStepNav();
    this.#startBoil();
    this.#startHeroAnim();
  }
  disconnectedCallback() {
    if (this.#boilTimer) clearInterval(this.#boilTimer);
    if (this.#heroRaf) cancelAnimationFrame(this.#heroRaf);
  }
  /** @returns {'attending'|'declined'|null} */
  getStatus() {
    if (this.#phase === "intro" || this.#phase === "name") return null;
    return this.#phase === "declined" ? "declined" : "attending";
  }
  getGuestName() {
    return this.#readGuestName();
  }
  refreshPanel() {
    this.#renderPanel();
    this.#syncStepNav();
  }
  /** Return to the RSVP question (e.g. from step 2 back). */
  resetToIntro() {
    this.#phase = "intro";
    try {
      localStorage.removeItem(this.#storageKey());
      localStorage.removeItem(this.#guestNameStorageKey());
    } catch {
    }
    this.#syncFormFields();
    this.#renderPanel();
    this.#syncStepNav();
    this.#emit("rsvp:status", { status: null });
    this.shadowRoot.querySelectorAll("[data-status]").forEach((b) => {
      b.disabled = false;
    });
  }
  attributeChangedCallback(name, _old, value) {
    if (!this.shadowRoot?.querySelector(".rsvp-step")) return;
    if (name === "step-label") {
      const el = this.shadowRoot.querySelector(".step-label");
      if (el) el.textContent = value || "";
    }
  }
  #syncStepNav() {
    const status = this.getStatus();
    const nav = this.shadowRoot.querySelector(".step-nav");
    if (nav instanceof HTMLElement) nav.hidden = this.#phase === "declined";
    setStepNavState(this.shadowRoot, {
      prev: this.#phase === "name" || status !== null && this.#phase !== "declined",
      next: status === "attending"
    });
  }
  #eventId() {
    return this.getAttribute("event-id") || "default";
  }
  #storageKey() {
    return `rsvp:${this.#eventId()}:status`;
  }
  #guestNameStorageKey() {
    return `rsvp:${this.#eventId()}:guestName`;
  }
  #readGuestName() {
    try {
      return localStorage.getItem(this.#guestNameStorageKey())?.trim() || "";
    } catch {
      return "";
    }
  }
  /** @param {string} name */
  #writeGuestName(name) {
    try {
      if (name) localStorage.setItem(this.#guestNameStorageKey(), name);
      else localStorage.removeItem(this.#guestNameStorageKey());
    } catch {
    }
  }
  /** @returns {'attending'|'declined'|null} */
  #readStatus() {
    try {
      const v = localStorage.getItem(this.#storageKey());
      if (v === "attending" || v === "declined") return v;
    } catch {
    }
    return null;
  }
  /** @param {'attending'|'declined'} status */
  #writeStatus(status) {
    try {
      localStorage.setItem(this.#storageKey(), status);
    } catch {
    }
  }
  #renderShell() {
    const step = this.getAttribute("step-label") || "RSVP \xB7 step 1 of 3";
    const roughId = `rough-${this.#uid}`;
    const turbId = `turb-${this.#uid}`;
    const styleBlock = INLINE_CSS ? `<style>${INLINE_CSS}</style>` : `<link rel="stylesheet" href="${STYLE_URL}">`;
    this.shadowRoot.innerHTML = `
      ${styleBlock}
      <link rel="stylesheet" href="${FONT_URL}">
      <main class="rsvp-step">
        ${stepNavHtml(esc(step))}
        <h1 class="step-title">Celebrate Diwali with us!</h1>
        <div class="step-body">
          <div class="step-scene">${buildRsvpHeroSvg(roughId, turbId, this.#reduceMotion, 0)}</div>
          <p class="sr" aria-live="polite" id="live"></p>
          <div class="step-content">
            <section class="panel panel-intro" id="panel"></section>
          </div>
          <div class="step-actions" id="actions"></div>
        </div>
      </main>
    `;
  }
  #startBoil() {
    this.#boilTimer = setInterval(() => {
      if (!this.#reduceMotion) {
        this.#boilSeed = this.#boilSeed % 4 + 1;
        this.shadowRoot.querySelector(`#turb-${this.#uid}`)?.setAttribute("seed", String(this.#boilSeed));
      }
    }, 160);
  }
  #startHeroAnim() {
    if (this.#reduceMotion) return;
    const tick = (now) => {
      const el = this.shadowRoot.querySelector("#heroFigures");
      if (el) el.innerHTML = buildHeroFigures(false, now / 1e3);
      this.#heroRaf = requestAnimationFrame(tick);
    };
    this.#heroRaf = requestAnimationFrame(tick);
  }
  #bindEvents() {
    this.shadowRoot.addEventListener("click", (e) => {
      if (e.target.closest("[data-change-rsvp]")) {
        this.resetToIntro();
        return;
      }
      if (e.target.closest("[data-step-prev]:not(:disabled)")) {
        if (this.#phase === "name") this.resetToIntro();
        else this.resetToIntro();
        return;
      }
      if (e.target.closest("[data-step-next]:not(:disabled)")) {
        this.#emit("rsvp:step-next", {});
        return;
      }
      const btn = e.target.closest("[data-status]");
      if (!btn || this.#phase !== "intro") return;
      const status = btn.dataset.status;
      if (status === "attending") this.#pickAttending();
      else if (status === "declined") this.#pickDeclined();
    });
    this.shadowRoot.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || !input.matches("[data-guest-name-input]")) return;
      e.preventDefault();
      this.#finishGuestName(input.value);
    });
    this.shadowRoot.addEventListener("focusout", (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || !input.matches("[data-guest-name-input]")) return;
      this.#finishGuestName(input.value);
    });
  }
  #pickAttending() {
    this.#phase = "name";
    this.#renderPanel();
    this.#syncStepNav();
    const live = this.shadowRoot.querySelector("#live");
    if (live) live.textContent = "What should we call you?";
  }
  /** @param {string} raw */
  #finishGuestName(raw) {
    if (this.#phase !== "name") return;
    const name = raw.trim().slice(0, 40);
    if (!name) return;
    this.#writeGuestName(name);
    this.#writeStatus("attending");
    this.#phase = "attending";
    this.#syncFormFields();
    this.#syncStepNav();
    this.#emit("rsvp:status", { status: "attending", guestName: name });
    const live = this.shadowRoot.querySelector("#live");
    if (live) live.textContent = `Thanks, ${name} \u2014 we cannot wait to see you!`;
  }
  #pickDeclined() {
    this.#phase = "declined";
    this.#writeStatus("declined");
    this.#syncFormFields();
    this.#renderPanel();
    this.#emit("rsvp:status", { status: "declined" });
    this.#syncStepNav();
    const live = this.shadowRoot.querySelector("#live");
    if (live) live.textContent = "We'll miss you this time!";
  }
  #renderPanel() {
    const panel = this.shadowRoot.querySelector("#panel");
    const actions = this.shadowRoot.querySelector("#actions");
    if (!panel || !actions) return;
    if (this.#phase === "intro") {
      panel.innerHTML = `<div class="fade"><div class="label">Let us know.</div></div>`;
      actions.innerHTML = `<div class="choices choices-col">
          <button type="button" class="ink-btn" data-status="attending">Joyfully, yes!</button>
          <button type="button" class="ink-btn" data-status="declined">Can't make it</button>
        </div>`;
      actions.hidden = false;
      return;
    }
    if (this.#phase === "name") {
      const saved = esc(this.#readGuestName());
      panel.innerHTML = `<div class="fade"><div class="label">What should we call you?</div></div>`;
      actions.innerHTML = `<input type="text" class="name-input" data-guest-name-input placeholder="Your name" maxlength="40" value="${saved}" autocomplete="name" aria-label="Your name">`;
      actions.hidden = false;
      const input = actions.querySelector("[data-guest-name-input]");
      if (input instanceof HTMLInputElement) {
        requestAnimationFrame(() => input.focus());
      }
      return;
    }
    if (this.#phase === "declined") {
      panel.innerHTML = `<div class="fade done">
        <h2 class="step-title">We'll miss you this time!</h2>
      </div>`;
      actions.innerHTML = `<button type="button" class="ink-btn" data-change-rsvp>Change my RSVP</button>`;
      actions.hidden = false;
      return;
    }
    if (this.#phase === "attending") {
      panel.innerHTML = `<div class="fade done">
        <h2 class="step-title">You're on the list!</h2>
        <p>We can't wait to celebrate with you.</p>
      </div>`;
      actions.innerHTML = `<button type="button" class="ink-btn" data-change-rsvp>Change my RSVP</button>`;
      actions.hidden = false;
    }
  }
  #syncFormFields() {
    const form = this.closest("form");
    if (!form) return;
    let el = form.querySelector('input[name="rsvp_status"]');
    if (!el) {
      el = document.createElement("input");
      el.type = "hidden";
      el.name = "rsvp_status";
      form.appendChild(el);
    }
    let nameEl = form.querySelector('input[name="rsvp_guest_name"]');
    if (!nameEl) {
      nameEl = document.createElement("input");
      nameEl.type = "hidden";
      nameEl.name = "rsvp_guest_name";
      form.appendChild(nameEl);
    }
    if (this.#phase === "intro" || this.#phase === "name") {
      el.value = "";
      nameEl.value = this.#phase === "name" ? this.#readGuestName() : "";
    } else if (this.#phase === "declined") {
      el.value = "declined";
      nameEl.value = "";
    } else {
      el.value = "attending";
      nameEl.value = this.#readGuestName();
    }
  }
  /** @param {string} type @param {object} detail */
  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
  }
};
customElements.define("rsvp-attendance", RsvpAttendance);
export {
  RsvpAttendance
};
