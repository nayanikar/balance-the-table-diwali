/* Balance the Table embed bundle */

// src/icons.js
var ICONS = {
  bowl: `<path class="f" d="M5 20H35C35 30 28 35 20 35S5 30 5 20Z"/><path class="l" d="M14 15q-3-4 0-8M20 16q-3-4 0-8M26 15q-3-4 0-8"/><path class="l" d="M10 25q10 4 20 0"/>`,
  pot: `<path class="f" d="M7 19H33V30Q33 35 28 35H12Q7 35 7 30Z"/><path class="l" d="M3 22H7M33 22H37M10 19Q20 12 30 19"/><circle class="l" cx="20" cy="12" r="2"/>`,
  dumpling: `<path class="f" d="M4 33C6 16 34 16 36 33Z"/><path class="l" d="M12 26l2-4M20 23v-4M28 26l-2-4"/>`,
  samosa: `<path class="f" d="M5 34L20 9L35 34Z"/><path class="l" d="M20 10L18 33M11 25l6 1"/>`,
  skewer: `<path class="l" d="M4 33L36 9"/><rect class="f" x="9" y="22" width="7" height="7" rx="1.5" transform="rotate(-37 12.5 25.5)"/><rect class="f" x="16.5" y="16.5" width="7" height="7" rx="1.5" transform="rotate(-37 20 20)"/><rect class="f" x="24" y="11" width="7" height="7" rx="1.5" transform="rotate(-37 27.5 14.5)"/>`,
  pizza: `<path class="f" d="M6 13Q20 7 34 13L20 36Z"/><path class="l" d="M7 16Q20 10 33 16"/><circle class="f2" cx="17" cy="20" r="2.2"/><circle class="f2" cx="23" cy="25" r="2"/>`,
  slice: `<path class="f" d="M5 34H35V19L5 27Z"/><path class="l" d="M5 31L35 26"/><circle class="f2" cx="29" cy="15" r="3.4"/>`,
  cookie: `<circle class="f" cx="20" cy="25" r="11"/><path class="l dots" d="M16 21h.1M24 22h.1M17 29h.1M25 29h.1M21 25h.1"/>`,
  donut: `<ellipse class="f" cx="20" cy="26" rx="13" ry="9"/><ellipse class="hole" cx="20" cy="25" rx="4" ry="2.4"/><path class="l" d="M11 23l2-1M27 22l2 1M14 30l2 1M25 30l2-1M19 20h2"/>`,
  pudding: `<path class="f" d="M9 34L12 19H28L31 34Z"/><path class="f2" d="M12 19H28L27.4 23Q25.5 26 23.6 23Q21.8 26 20 23Q18.2 26 16.4 23Q14.5 26 12.6 23Z"/>`,
  icecream: `<path class="f" d="M12 20L20 36L28 20Z"/><path class="l" d="M14 24l8 4M16 28l6 3"/><circle class="f" cx="20" cy="15" r="7.5"/>`,
  cupcake: `<path class="f" d="M10 24H30L27 35H13Z"/><path class="f" d="M9 24C8 15 32 15 31 24Z"/><circle class="f2" cx="20" cy="13" r="2.6"/><path class="l" d="M16 27l1 6M20 27v6M24 27l-1 6"/>`,
  cloche: `<path class="f" d="M7 31C7 17 33 17 33 31Z"/><path class="l" d="M4 33H36M12 26q2-4 6-5"/><circle class="f" cx="20" cy="15.5" r="2.2"/>`
};
var RULES = {
  sav: [
    [/momo|dumpling|gyoza|dim ?sum|bao|wonton/i, "dumpling"],
    [/samosa|pakor|empanada|spring roll|kachori|puff/i, "samosa"],
    [/tikka|kebab|kabab|satay|skewer/i, "skewer"],
    [/pizza|flatbread|focaccia/i, "pizza"],
    [/curry|stew|chil+i|korma|masala|dal|chole|rajma|butter chicken/i, "pot"],
    [/noodle|ramen|soup|pho|biryani|rice|pulao|salad|pasta|bowl|khichdi/i, "bowl"]
  ],
  swt: [
    [/ice ?cream|kulfi|gelato|sorbet/i, "icecream"],
    [/cupcake|muffin/i, "cupcake"],
    [/cake|tiramisu|pie|tart|pastry|cheesecake/i, "slice"],
    [/cookie|biscuit|brownie|lad+o+|barfi|fudge/i, "cookie"],
    [/donut|doughnut|jalebi|gulab|churro/i, "donut"],
    [/pudding|flan|kheer|rasmalai|custard|mousse|halwa|trifle|panna/i, "pudding"]
  ]
};
var HASH_DEFAULTS = {
  sav: ["bowl", "dumpling", "pot", "samosa"],
  swt: ["slice", "cookie", "pudding", "donut"]
};
function iconFor(side, name, index = 0) {
  if (!name) return "cloche";
  for (const [re, ic] of RULES[side]) {
    if (re.test(name)) return ic;
  }
  let h = index;
  for (const c of name) h = h * 31 + c.charCodeAt(0) | 0;
  return HASH_DEFAULTS[side][Math.abs(h) % 4];
}
function toSideCode(side) {
  return side === "savoury" ? "sav" : "swt";
}
function toPublicSide(code) {
  return code === "sav" ? "savoury" : "sweet";
}
var SEEDS = {
  sweet: {
    sav: ["Biryani", "Momos"],
    swt: ["Tiramisu", "Cookies", "Rasmalai", null, "Gulab jamun", "Brownies"]
  },
  even: {
    sav: ["Biryani", "Momos", "Paneer tikka", "Hakka noodles"],
    swt: ["Tiramisu", "Cookies", "Rasmalai", null]
  },
  sav: {
    sav: ["Biryani", "Momos", "Paneer tikka", "Hakka noodles", "Samosas"],
    swt: ["Tiramisu", null]
  },
  empty: { sav: [], swt: [] }
};

// src/api.js
var RETRY_MS = 400;
async function postWithRetry(fn) {
  try {
    const res = await fn();
    if (res.ok) return res;
  } catch (err) {
    console.warn("[balance-the-table] request failed, retrying", err);
  }
  await new Promise((r) => setTimeout(r, RETRY_MS));
  try {
    const res = await fn();
    if (!res.ok) console.warn("[balance-the-table] request failed after retry", res.status);
    return res;
  } catch (err) {
    console.warn("[balance-the-table] request failed after retry", err);
    return null;
  }
}
async function getTable(apiBase, eventId, guestId, signal) {
  const url = new URL(apiBase);
  url.searchParams.set("event", eventId);
  if (guestId) url.searchParams.set("guestId", guestId);
  const res = await fetch(url.toString(), { signal, method: "GET" });
  if (!res.ok) throw new Error(`GET ${res.status}`);
  return (
    /** @type {TableResponse} */
    await res.json()
  );
}
async function upsertContribution(apiBase, payload) {
  const body = JSON.stringify({
    event: payload.event,
    guestId: payload.guestId,
    side: payload.side,
    name: payload.name ?? "",
    icon: payload.icon
  });
  await postWithRetry(
    () => fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body
    })
  );
}
async function removeContribution(apiBase, eventId, guestId) {
  const body = JSON.stringify({ event: eventId, guestId, remove: true });
  await postWithRetry(
    () => fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body
    })
  );
}

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
function layoutX(n, plateHalf) {
  if (n <= 0) return [];
  if (n === 1) return [-plateHalf * 0.12];
  const span = plateHalf * 1.5;
  return Array.from({ length: n }, (_, i) => -span / 2 + span * i / (n - 1));
}
var PLATTER = { HALF: 210, RY: 10, EDGE: 6 };
function platterUndersideLocal(u) {
  const { HALF: HALF2, RY, EDGE } = PLATTER, k = Math.min(1, Math.abs(u) / HALF2);
  return RY * Math.sqrt(1 - k * k) + EDGE;
}
function platterUnderside(x, cy, deg) {
  const a = deg * Math.PI / 180, u = x / Math.cos(a);
  return cy + u * Math.sin(a) + platterUndersideLocal(u) * Math.cos(a);
}
function platterSVG() {
  const { HALF: H, RY, EDGE } = PLATTER;
  let hatch = "";
  for (let x = -H + 18; x <= H - 18; x += 13) {
    const yb = RY * Math.sqrt(1 - (x / H) ** 2);
    hatch += `M${x} ${(yb + 1.2).toFixed(1)} L${x - 4} ${(yb + EDGE - 0.8).toFixed(1)} `;
  }
  const cols = ["var(--hl)", "var(--swt)", "var(--sav)"];
  let dots = "";
  for (let i = 0; i < 24; i++) {
    const th = (i + 0.5) / 24 * Math.PI * 2;
    dots += `<circle cx="${((H - 11) * Math.cos(th)).toFixed(1)}" cy="${((RY - 2.6) * Math.sin(th)).toFixed(1)}" r="1.7" fill="${cols[i % 3]}"/>`;
  }
  return `<path class="pl-edge" d="M${-H} 0 A${H} ${RY} 0 0 0 ${H} 0 L${H} ${EDGE} A${H} ${RY} 0 0 1 ${-H} ${EDGE} Z"/><path class="pl-hatch" d="${hatch}"/><ellipse class="pl-top" cx="0" cy="0" rx="${H}" ry="${RY}"/><ellipse class="pl-well" cx="0" cy="0.6" rx="${H - 22}" ry="${RY - 5}"/><g class="pl-dots">${dots}</g>`;
}
function dishSlot(side, i) {
  const sg = side === "sav" ? -1 : 1, row = i % 2, col = Math.floor(i / 2);
  return { x: sg * (24 + col * 30 + (row ? 15 : 0)), y: row ? 3.2 : -3.2, back: !row };
}

// src/plate-scene.js
var G = 232;
var HALF = PLATTER.HALF;
var CY = G - 60 - platterUndersideLocal(0);
var MAXT = 12;
var SCALLOP = `<path class="scallop" d="M-228 ${G}${" q 12 10 24 0".repeat(19)}"/>`;
var PLATE_MARKUP = platterSVG();
function dishRotDeg(icon, i) {
  let h = 0;
  for (const c of String(icon) + i) h = h * 37 + c.charCodeAt(0) | 0;
  return Math.abs(h) % 9 - 4;
}
function dishWorldCoords(side, index, ang) {
  const slot = dishSlot(side, index);
  const rad = ang * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: slot.x * cos - slot.y * sin,
    y: CY + slot.x * sin + slot.y * cos
  };
}
function buildPlateSceneShell({ roughId, turbId, boilSeed = 2 }) {
  return `
    <defs>
      <filter id="${roughId}" x="-10%" y="-20%" width="120%" height="140%">
        <feTurbulence id="${turbId}" type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${boilSeed}"/>
        <feDisplacementMap in="SourceGraphic" scale="2.6"/>
      </filter>
    </defs>
    <g filter="url(#${roughId})">
      <g id="sceneFloor">
        <path class="ground" d="M-235 ${G} H235"/>
        ${SCALLOP}
      </g>
      <g id="sceneFigures" class="figures"></g>
      <g id="plateRot" transform="translate(0 ${CY}) rotate(0)">
        <g id="platterArt">${PLATE_MARKUP}</g>
        <g id="plateFood"></g>
      </g>
    </g>
    <text class="side-label" x="-150" y="${G + 36}">SAVOURY</text>
    <text class="side-label" x="150" y="${G + 36}">SWEET</text>
    <text id="sceneHelping" class="more helping" x="200" y="${G + 8}" visibility="hidden"></text>`;
}
function buildDishesMarkup(dishes, phase) {
  const items = [];
  for (
    const side of
    /** @type {const} */
    ["sav", "swt"]
  ) {
    const list = dishes.filter(
      (d) => d.side === side && (d.landed !== false || d.mine && !d.landed)
    );
    list.forEach((d, i) => {
      if (i >= 12) return;
      const slot = dishSlot(side, i);
      const r = dishRotDeg(d.icon, i);
      const yOff = d.mine && !d.landed && d.fy ? d.fy * 0.55 : 0;
      const y = slot.y + yOff;
      const settled = d.mine && phase === "done";
      items.push({
        y,
        html: `<g class="dish-slot" data-y="${y}">
          <ellipse class="dish-shadow" cx="${slot.x}" cy="${y + 0.5}" rx="13" ry="2.6"/>
          <g class="dish${d.mine ? " mine" : ""}${settled ? " settled" : ""}" style="--c:var(--${side})" transform="translate(${slot.x} ${y}) rotate(${r}) scale(0.78)">
            ${d.mine ? '<ellipse class="halo" cx="0" cy="-12" rx="18" ry="14"/>' : ""}
            <g class="${d.pop ? "pop" : ""}" transform="translate(-20 -35)">${ICONS[d.icon] || ICONS.cloche}</g>
          </g>
        </g>`
      });
    });
  }
  items.sort((a, b) => a.y - b.y);
  let html = items.map((it) => it.html).join("");
  for (
    const side of
    /** @type {const} */
    ["sav", "swt"]
  ) {
    const n = dishes.filter(
      (d) => d.side === side && (d.landed !== false || d.mine && !d.landed)
    ).length;
    const more = Math.max(0, n - 12);
    if (more > 0) {
      html += `<text class="more" x="${side === "sav" ? -150 : 150}" y="-36">+${more} more</text>`;
    }
  }
  return html;
}
function popScaleForAge(age, reduceMotion) {
  if (reduceMotion || age >= 1) return 1;
  if (age <= 0) return 0;
  return Math.max(0, 1 + 2.2 * (age - 1) ** 3 + 1.2 * (age - 1) ** 2);
}
function updatePlateScene(mount, opts) {
  const {
    ang,
    nowMs,
    dishes,
    people,
    displayX,
    reduceMotion,
    phase,
    extraHelpers,
    minePopStart = 0
  } = opts;
  const t = reduceMotion ? 0 : nowMs / 1e3;
  const figEl = mount.querySelector("#sceneFigures");
  const rotEl = mount.querySelector("#plateRot");
  const foodEl = mount.querySelector("#plateFood");
  const helpEl = mount.querySelector("#sceneHelping");
  if (!figEl || !rotEl || !foodEl) return;
  rotEl.setAttribute("transform", `translate(0 ${CY}) rotate(${ang.toFixed(2)})`);
  const xs = layoutX(people.length, HALF);
  let figs = "";
  people.forEach((p, i) => {
    const targetX = xs[i] ?? 0;
    const x = displayX[p.id] ?? targetX;
    let scale = 1;
    if (p.mine && minePopStart > 0) {
      const age = (nowMs - minePopStart) / 400;
      scale = popScaleForAge(age, reduceMotion);
    }
    figs += figure({
      x,
      ground: G,
      plate: platterUnderside(x, CY, ang),
      dir: x < 0 ? 1 : -1,
      kind: p.mine ? "wave" : kindFor(p.id),
      mine: !!p.mine,
      host: !!p.host,
      t,
      scale
    });
  });
  figEl.innerHTML = figs;
  foodEl.innerHTML = buildDishesMarkup(dishes, phase);
  if (helpEl) {
    if (extraHelpers > 0) {
      helpEl.textContent = `+${extraHelpers} helping`;
      helpEl.setAttribute("visibility", "visible");
    } else {
      helpEl.setAttribute("visibility", "hidden");
      helpEl.textContent = "";
    }
  }
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

// src/balance-the-table.js
var STYLE_URL = new URL("./styles.css", import.meta.url).href;
var INLINE_CSS = true ? ':host {\n  display: flex;\n  flex: 1;\n  flex-direction: column;\n  width: 100%;\n  min-height: 0;\n  --bg: #c9890a;\n  --card: #fff8eb;\n  --ink: #3d1212;\n  --muted: #8f5c4a;\n  --hl: #e8b923;\n  --step-scene-h: 260px;\n  color: var(--ink);\n  font-family: "Patrick Hand", ui-rounded, system-ui, sans-serif;\n  font-size: 18px;\n}\n\n*,\n*::before,\n*::after {\n  box-sizing: border-box;\n}\n\n.rsvp-step {\n  position: relative;\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  text-align: center;\n  width: 100%;\n  min-height: 100%;\n  padding: 0;\n  margin: 0;\n  background: transparent;\n  box-shadow: none;\n  overflow: visible;\n}\n\n.step-nav {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 12px;\n  margin: 0 0 10px;\n  font-family: ui-sans-serif, system-ui, sans-serif;\n  font-size: 12px;\n  font-weight: 600;\n  letter-spacing: 0.16em;\n  text-transform: uppercase;\n}\n\n.step-nav[hidden] {\n  display: none !important;\n}\n\n.step-label {\n  font: inherit;\n  color: var(--muted);\n  text-align: center;\n}\n\n.step-arrow {\n  flex: 0 0 auto;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 24px;\n  height: 24px;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  cursor: pointer;\n  color: var(--ink);\n}\n\n.step-arrow:focus-visible {\n  outline: 3px solid var(--hl);\n  outline-offset: 2px;\n  border-radius: 2px;\n}\n\n.step-arrow:disabled {\n  opacity: 0.2;\n  cursor: default;\n  pointer-events: none;\n}\n\n.step-arrow-icon {\n  display: block;\n  width: 8px;\n  height: 10px;\n  fill: currentColor;\n}\n\n.step-title {\n  font-family: "Caveat", cursive;\n  font-weight: 700;\n  font-size: 48px;\n  line-height: 1.05;\n  margin: 0 0 12px;\n  letter-spacing: 0.02em;\n  max-width: 100%;\n}\n\n.step-body {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  width: 100%;\n  min-height: 0;\n}\n\n.step-scene {\n  width: 100%;\n  max-width: 560px;\n  height: var(--step-scene-h);\n  margin: 8px auto 16px;\n  display: flex;\n  align-items: flex-end;\n  justify-content: center;\n  overflow: hidden;\n  flex-shrink: 0;\n}\n\n.step-scene svg {\n  width: 100%;\n  height: 100%;\n  display: block;\n  overflow: visible;\n}\n\n.step-content {\n  width: 100%;\n  max-width: 560px;\n  flex: 1 1 auto;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  min-height: 0;\n}\n\n.panel {\n  width: 100%;\n  text-align: center;\n  position: relative;\n}\n\n.label {\n  font-family: "Caveat", cursive;\n  font-weight: 700;\n  font-size: 30px;\n  margin: 2px 0 10px;\n}\n\n.sub {\n  text-align: center;\n  margin: 0 auto;\n  max-width: 300px;\n  color: var(--muted);\n  line-height: 1.3;\n}\n\n.step-actions {\n  display: flex;\n  gap: 16px;\n  justify-content: center;\n  flex-wrap: wrap;\n  margin-top: auto;\n  padding-top: 16px;\n  width: 100%;\n  max-width: 560px;\n}\n\n.step-actions .ink-btn,\n.step-actions .btn {\n  flex: 0 1 260px;\n  min-height: 52px;\n}\n\n.ln {\n  fill: none;\n  stroke: var(--ink);\n  stroke-width: 2.2;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n}\n\n.thin {\n  stroke-width: 1.4;\n}\n\n.solid {\n  fill: var(--card);\n  stroke: var(--ink);\n  stroke-width: 2.2;\n  stroke-linejoin: round;\n}\n\n.inkfill {\n  fill: var(--ink);\n}\n\n.choices {\n  display: contents;\n}\n\n.choices-col {\n  display: flex;\n  flex-direction: row;\n  align-items: stretch;\n  justify-content: center;\n  flex-wrap: nowrap;\n  gap: 16px;\n  width: 100%;\n}\n\n.choices-col .ink-btn,\n.choices-col .btn {\n  flex: 1 1 260px;\n  min-width: 0;\n}\n\n@media (max-width: 560px) {\n  .step-title {\n    font-size: 40px;\n  }\n\n  .step-scene {\n    height: 200px;\n  }\n\n  .step-actions .ink-btn,\n  .step-actions .btn,\n  .choices-col {\n    flex-direction: column;\n    align-items: stretch;\n  }\n\n  .choices-col .ink-btn,\n  .choices-col .btn {\n    flex: none;\n    width: 100%;\n  }\n}\n\n.btn,\n.ink-btn {\n  font-family: "Patrick Hand", ui-rounded, system-ui, sans-serif;\n  font-size: 19px;\n  font-weight: 400;\n  font-style: normal;\n  line-height: 1.1;\n  color: var(--ink);\n  background: var(--card);\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n  padding: 9px 22px;\n  min-height: 52px;\n  border: 2.2px solid var(--ink);\n  border-radius: 255px 18px 225px 18px / 18px 225px 18px 255px;\n  box-shadow: 3px 3px 0 var(--ink);\n  transition: transform 0.08s, box-shadow 0.08s;\n  letter-spacing: 0.06em;\n  text-transform: uppercase;\n}\n\n.btn.primary,\n.ink-btn {\n  background: var(--ink);\n  color: var(--card);\n}\n\n.btn:hover,\n.ink-btn:hover {\n  transform: translate(-1px, -1px) rotate(-1deg);\n  box-shadow: 4px 4px 0 var(--ink);\n}\n\n.btn.primary:hover,\n.btn.primary:active,\n.ink-btn:hover,\n.ink-btn:active {\n  color: var(--card);\n}\n\n.btn:active,\n.ink-btn:active {\n  transform: translate(2px, 2px);\n  box-shadow: 1px 1px 0 var(--ink);\n}\n\n.btn:focus-visible,\n.ink-btn:focus-visible,\n.link:focus-visible {\n  outline: 3px solid var(--hl);\n  outline-offset: 3px;\n}\n\n.btn[disabled] {\n  opacity: 0.5;\n  pointer-events: none;\n}\n\n.name-input,\n.allergies-input {\n  flex: 1 1 auto;\n  width: 100%;\n  min-height: 52px;\n  margin: 0;\n  padding: 9px 22px;\n  font-family: "Patrick Hand", ui-rounded, system-ui, sans-serif;\n  font-size: 19px;\n  font-weight: 400;\n  line-height: 1.1;\n  color: var(--card);\n  background: var(--ink);\n  border: 2.2px solid var(--ink);\n  border-radius: 255px 18px 225px 18px / 18px 225px 18px 255px;\n  box-shadow: 3px 3px 0 var(--ink);\n  text-transform: none;\n  letter-spacing: 0.02em;\n}\n\n.name-input::placeholder,\n.allergies-input::placeholder {\n  color: color-mix(in srgb, var(--card) 55%, transparent);\n}\n\n.name-input:focus,\n.allergies-input:focus {\n  outline: 3px solid var(--hl);\n  outline-offset: 3px;\n}\n\n.link {\n  font: inherit;\n  background: none;\n  border: 0;\n  color: var(--muted);\n  cursor: pointer;\n  margin-top: 12px;\n  text-decoration: none;\n}\n\n.link:hover {\n  color: var(--ink);\n}\n\n.done .step-title {\n  font-size: 40px;\n  margin-bottom: 8px;\n}\n\n.done p {\n  margin: 0 auto;\n  max-width: 290px;\n  line-height: 1.3;\n}\n\n.fade {\n  animation: fade 0.35s ease both;\n}\n\n@keyframes fade {\n  from {\n    opacity: 0;\n    transform: translateY(6px);\n  }\n}\n\n.sr {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  overflow: hidden;\n  clip: rect(0 0 0 0);\n}\n\n@media (prefers-reduced-motion: reduce) {\n  :host *,\n  :host *::before,\n  :host *::after {\n    animation: none !important;\n    transition: none !important;\n  }\n}\n\n@media (max-width: 420px) {\n  .btn,\n  .ink-btn {\n    font-size: 17px;\n    padding: 8px 16px;\n  }\n}\n\n.fg-limb {\n  fill: none;\n  stroke: var(--ink);\n  stroke-width: 2.2;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n}\n\n.fg-limb.thin {\n  stroke-width: 1.4;\n}\n\n.fg-body,\n.fg-head {\n  fill: var(--card);\n  stroke: var(--ink);\n  stroke-width: 2.2;\n}\n\n.fg-scribble {\n  fill: none;\n  stroke: var(--ink);\n  stroke-width: 1.1;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n  opacity: 0.7;\n}\n\n.fg-foot,\n.fg-hand {\n  fill: var(--ink);\n}\n\n.fg-mine .fg-body,\n.fg-mine .fg-head {\n  fill: var(--hl);\n}\n\n.fg-hat {\n  fill: var(--sav);\n  stroke: var(--ink);\n  stroke-width: 1.4;\n  stroke-linejoin: round;\n}\n\n.fg-pom {\n  fill: var(--swt);\n  stroke: var(--ink);\n  stroke-width: 1;\n}\n\n.fg-sweat {\n  fill: #8fc6e8;\n  stroke: var(--ink);\n  stroke-width: 0.9;\n}\n\n.fg-motion {\n  fill: none;\n  stroke: var(--ink);\n  stroke-width: 1.2;\n  stroke-linecap: round;\n  opacity: 0.6;\n}\n\n.fg-spark {\n  fill: none;\n  stroke: var(--hl);\n  stroke-width: 1.6;\n  stroke-linecap: round;\n}\n\n.fg-stool rect {\n  fill: #e9c993;\n  stroke: var(--ink);\n  stroke-width: 1.8;\n}\n\n.fg-stool path {\n  fill: none;\n  stroke: var(--ink);\n  stroke-width: 1.2;\n  opacity: 0.6;\n}\n\n\n:host {\n  --sav: #e58a5c;\n  --swt: #f2a7bd;\n  --acc2: #b8433f;\n}\n\nsvg.balance {\n  display: block;\n  width: 100%;\n  height: auto;\n  max-height: 200px;\n  overflow: visible;\n  margin: 0;\n}\n\n.ground {\n  fill: none;\n  stroke: var(--ink);\n  stroke-width: 2.2;\n  stroke-linecap: round;\n}\n\n.scallop {\n  fill: none;\n  stroke: var(--ink);\n  stroke-width: 1.4;\n  opacity: 0.55;\n}\n\n.pl-top {\n  fill: var(--card);\n  stroke: var(--ink);\n  stroke-width: 2.2;\n}\n\n.pl-edge {\n  fill: color-mix(in srgb, var(--ink) 9%, var(--card));\n  stroke: var(--ink);\n  stroke-width: 2.2;\n  stroke-linejoin: round;\n}\n\n.pl-hatch {\n  fill: none;\n  stroke: var(--ink);\n  stroke-width: 1;\n  stroke-linecap: round;\n  opacity: 0.45;\n}\n\n.pl-well {\n  fill: none;\n  stroke: var(--ink);\n  stroke-width: 1.2;\n  opacity: 0.5;\n}\n\n.pl-dots circle {\n  stroke: var(--ink);\n  stroke-width: 0.6;\n}\n\n.dish-shadow {\n  fill: var(--ink);\n  opacity: 0.12;\n}\n\n.more.helping {\n  text-anchor: start;\n  font-size: 16px;\n}\n\n.side-label {\n  font-family: "Caveat", cursive;\n  font-weight: 700;\n  font-size: 22px;\n  fill: var(--ink);\n  text-anchor: middle;\n  letter-spacing: 0.08em;\n}\n\n.dish .f {\n  fill: var(--c);\n  stroke: var(--ink);\n  stroke-width: 1.8;\n  stroke-linejoin: round;\n}\n\n.dish .f2 {\n  fill: var(--acc2);\n  stroke: var(--ink);\n  stroke-width: 1.4;\n}\n\n.dish .l {\n  fill: none;\n  stroke: var(--ink);\n  stroke-width: 1.8;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n}\n\n.dish .dots {\n  stroke-width: 3.4;\n}\n\n.dish .hole {\n  fill: var(--card);\n  stroke: var(--ink);\n  stroke-width: 1.6;\n}\n\n.halo {\n  fill: var(--hl);\n  opacity: 0;\n  transform-box: fill-box;\n  transform-origin: center;\n}\n\n.mine .halo {\n  opacity: 0.85;\n  animation: pulse 1.2s ease-in-out infinite;\n}\n\n.mine.settled .halo {\n  animation: none;\n  opacity: 0.45;\n}\n\n@keyframes pulse {\n  50% {\n    opacity: 0.35;\n    transform: scale(1.15);\n  }\n}\n\n.pop {\n  animation: pop 0.35s cubic-bezier(0.3, 1.8, 0.5, 1);\n}\n\n@keyframes pop {\n  0% {\n    transform: scale(0.4);\n  }\n  100% {\n    transform: scale(1);\n  }\n}\n\n.burst line {\n  stroke: var(--ink);\n  stroke-width: 2;\n  stroke-linecap: round;\n}\n\n.burst {\n  animation: burst 0.8s ease-out forwards;\n}\n\n@keyframes burst {\n  0% {\n    opacity: 1;\n    transform: scale(0.5);\n  }\n  100% {\n    opacity: 0;\n    transform: scale(1.5);\n  }\n}\n\n.more {\n  font-family: "Caveat", cursive;\n  font-size: 18px;\n  fill: var(--muted);\n  text-anchor: middle;\n}\n\n.btt-shell {\n  max-width: min(1040px, calc(100vw - 56px));\n  margin: 0 auto;\n}\n\n.btn svg {\n  width: 34px;\n  height: 34px;\n}\n\n.btn:focus-visible,\n.link:focus-visible,\ninput:focus-visible {\n  outline: 3px solid var(--hl);\n  outline-offset: 3px;\n}\n\n.pick {\n  margin: 14px auto 0;\n  max-width: 340px;\n}\n\n.pk-l {\n  display: block;\n  font-size: 15px;\n  color: var(--muted);\n  margin-bottom: 6px;\n}\n\n.pk {\n  display: flex;\n  justify-content: center;\n  gap: 6px;\n  flex-wrap: wrap;\n}\n\n.pk button {\n  width: 46px;\n  height: 46px;\n  padding: 4px;\n  background: transparent;\n  cursor: pointer;\n  border: 2px solid transparent;\n  border-radius: 50% 45% 50% 42% / 45% 50% 42% 50%;\n  transition: transform 0.1s;\n}\n\n.pk button:hover {\n  transform: rotate(-6deg) scale(1.08);\n}\n\n.pk button[aria-checked="true"] {\n  border-color: var(--ink);\n  background: color-mix(in srgb, var(--hl) 60%, transparent);\n}\n\n.pk button:focus-visible {\n  outline: 3px solid var(--hl);\n  outline-offset: 2px;\n}\n\n.pk svg {\n  width: 100%;\n  height: 100%;\n}\n\n.cheer {\n  font-family: "Caveat", cursive;\n  font-size: 26px;\n  margin: 0 0 6px;\n}\n\n.q {\n  display: block;\n  margin: 0 0 8px;\n  font-size: 19px;\n}\n\n.field {\n  display: flex;\n  gap: 8px;\n  max-width: 330px;\n  margin: 0 auto;\n}\n\ninput {\n  flex: 1;\n  min-width: 0;\n  font: inherit;\n  font-size: 19px;\n  color: var(--ink);\n  background: transparent;\n  border: 0;\n  border-bottom: 2.2px dashed var(--ink);\n  padding: 6px 4px;\n}\n\ninput::placeholder {\n  color: var(--muted);\n  opacity: 0.8;\n}\n\n.btn.small {\n  font-size: 17px;\n  padding: 6px 14px;\n}\n' : void 0;
var FONT_URL = "https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Patrick+Hand&display=swap";
var LOADING_MS = 1500;
var instanceCounter = 0;
function esc(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );
}
function easeOutBounce(t) {
  const n = 7.5625;
  const k = 2.75;
  if (t < 1 / k) return n * t * t;
  if (t < 2 / k) return n * (t -= 1.5 / k) * t + 0.75;
  if (t < 2.5 / k) return n * (t -= 2.25 / k) * t + 0.9375;
  return n * (t -= 2.625 / k) * t + 0.984375;
}
function randomGuestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
var BalanceTheTable = class _BalanceTheTable extends HTMLElement {
  static observedAttributes = ["event-id", "api", "guest-id", "step-label"];
  /** @type {import('./icons.js').SideCode[]} */
  #sides = ["sav", "swt"];
  /** @type {{ sav: object[]; swt: object[] }} */
  #dishes = { sav: [], swt: [] };
  /** @type {'loading'|'intro'|'dropping'|'settled'|'naming'|'done'} */
  #phase = "loading";
  static #DROP_MS = 920;
  static #PLATE_HOLD_MS = 2e3;
  /** @type {object|null} */
  #mine = null;
  /** @type {boolean} */
  #manualIcon = false;
  /** @type {string} */
  #devSeed = "sweet";
  /** @type {number} */
  #ang = 0;
  /** @type {number} */
  #vel = 0;
  /** @type {number|null} */
  #raf = null;
  /** @type {ReturnType<typeof setInterval>|null} */
  #boilTimer = null;
  /** @type {number} */
  #boilSeed = 2;
  /** @type {boolean} */
  #boilOn = true;
  /** @type {string} */
  #uid = "";
  /** @type {string} */
  #guestId = "";
  /** @type {AbortController|null} */
  #loadAbort = null;
  /** @type {boolean} */
  #apiBypass = false;
  /** @type {boolean} */
  #reduceMotion = false;
  /** @type {Record<string, number>} */
  #displayX = {};
  /** @type {number} */
  #minePopStart = 0;
  /** @type {number} */
  #lastPeopleKey = "";
  constructor() {
    super();
    this.#uid = `btt${++instanceCounter}`;
    this.attachShadow({ mode: "open" });
  }
  connectedCallback() {
    this.#reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.#renderShell();
    this.#bindEvents();
    setStepNavState(this.shadowRoot, { prev: true, next: false });
    this.#guestId = this.#resolveGuestId();
    this.#phase = "loading";
    this.#renderAll();
    void this.#loadInitial();
    this.#raf = requestAnimationFrame(() => this.#tick());
    this.#startBoil();
  }
  disconnectedCallback() {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    if (this.#boilTimer) clearInterval(this.#boilTimer);
    this.#loadAbort?.abort();
  }
  /** @param {'sweet'|'even'|'sav'|'empty'} seed */
  setDevSeed(seed) {
    this.#apiBypass = true;
    this.#loadAbort?.abort();
    this.#devSeed = seed;
    this.#mine = null;
    this.#manualIcon = false;
    this.#minePopStart = 0;
    this.#displayX = {};
    this.#lastPeopleKey = "";
    this.#clearSavedContribution();
    this.#loadTableFromSeed(seed);
    this.#phase = "intro";
    this.#ang = this.#targetAngle();
    this.#vel = 0;
    this.#renderAll();
  }
  attributeChangedCallback(name, _old, value) {
    if (!this.shadowRoot?.querySelector(".rsvp-step")) return;
    if (name === "step-label") {
      const el = this.#$(".step-label");
      if (el) el.textContent = value || "";
    }
  }
  #$(sel) {
    return this.shadowRoot.querySelector(sel);
  }
  #eventId() {
    return this.getAttribute("event-id") || "default";
  }
  #apiBase() {
    return this.getAttribute("api")?.trim() || "";
  }
  #storageKeyGuest() {
    return `btt:${this.#eventId()}:guestId`;
  }
  #storageKeyContribution() {
    return `btt:${this.#eventId()}:${this.#guestId}`;
  }
  #resolveGuestId() {
    const attr = this.getAttribute("guest-id");
    if (attr) return attr;
    try {
      const key = this.#storageKeyGuest();
      let id = localStorage.getItem(key);
      if (!id) {
        id = randomGuestId();
        localStorage.setItem(key, id);
      }
      return id;
    } catch {
      return randomGuestId();
    }
  }
  /** @returns {{ side: string; dishName: string|null; icon: string }|null} */
  #readSavedContribution() {
    try {
      const raw = localStorage.getItem(this.#storageKeyContribution());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  /** @param {{ side: string; dishName: string|null; icon: string }|null} data */
  #writeSavedContribution(data) {
    try {
      const key = this.#storageKeyContribution();
      if (!data) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(data));
    } catch {
    }
  }
  #clearSavedContribution() {
    this.#writeSavedContribution(null);
  }
  async #loadInitial() {
    if (this.#apiBypass) return;
    const api = this.#apiBase();
    this.#loadAbort = new AbortController();
    const { signal } = this.#loadAbort;
    const timeout = new Promise((_, reject) => {
      setTimeout(() => {
        signal.abort();
        reject(new Error("timeout"));
      }, LOADING_MS);
    });
    try {
      if (!api) throw new Error("no api");
      const data = await Promise.race([
        getTable(api, this.#eventId(), this.#guestId, signal),
        timeout
      ]);
      if (!data) throw new Error("empty");
      this.#setDishesFromApi(data.dishes);
      const mineSource = data.mine ?? (() => {
        const saved = this.#readSavedContribution();
        if (!saved) return null;
        return {
          side: (
            /** @type {'savoury'|'sweet'} */
            saved.side
          ),
          name: saved.dishName,
          icon: saved.icon || "cloche"
        };
      })();
      this.#attachMine(mineSource);
      this.#phase = this.#mine ? "done" : "intro";
    } catch {
      if (!signal.aborted && !this.#apiBypass) {
        this.#loadTableFromSeed(this.#devSeed);
        this.#attachMineFromStorage();
        this.#phase = this.#mine ? "done" : "intro";
      }
    }
    this.#ang = this.#targetAngle();
    this.#vel = 0;
    this.#renderAll();
    this.#syncFormFields();
    this.#emit("btt:loaded", { complete: this.#phase === "done" });
  }
  /** @param {{ side: string; name: string|null; icon: string }[]} dishes */
  #setDishesFromApi(dishes) {
    this.#dishes = { sav: [], swt: [] };
    dishes.forEach((row, i) => {
      const side = toSideCode(
        /** @type {'savoury'|'sweet'} */
        row.side
      );
      const name = row.name;
      this.#dishes[side].push({
        name,
        side,
        icon: row.icon || iconFor(side, name, i),
        mine: false,
        landed: true
      });
    });
  }
  /** @param {{ side: string; name: string|null; icon: string }|null} mine */
  #attachMine(mine) {
    this.#mine = null;
    if (!mine) return;
    const side = toSideCode(
      /** @type {'savoury'|'sweet'} */
      mine.side
    );
    const icon = mine.icon || "cloche";
    const name = mine.name;
    const existing = this.#dishes[side].find(
      (d2) => d2.name === name && d2.icon === icon && !d2.mine
    );
    if (existing) {
      existing.mine = true;
      this.#mine = existing;
      return;
    }
    const d = { name, side, icon, mine: true, landed: true };
    this.#dishes[side].push(d);
    this.#mine = d;
  }
  #attachMineFromStorage() {
    const saved = this.#readSavedContribution();
    if (!saved) return;
    this.#attachMine({
      side: saved.side,
      name: saved.dishName,
      icon: saved.icon || "cloche"
    });
  }
  /** @param {'sweet'|'even'|'sav'|'empty'} seedKey */
  #loadTableFromSeed(seedKey) {
    const seed = SEEDS[seedKey] || SEEDS.sweet;
    for (const side of this.#sides) {
      this.#dishes[side] = seed[side].map((n, i) => ({
        name: n,
        side,
        icon: iconFor(side, n, i),
        mine: false,
        landed: true
      }));
    }
  }
  #counted(side) {
    return this.#dishes[side].filter((d) => !(d.mine && !d.landed)).length;
  }
  #targetAngle() {
    const d = this.#counted("swt") - this.#counted("sav");
    return MAXT * Math.tanh(d / 3);
  }
  #tick() {
    if (document.hidden) {
      this.#raf = requestAnimationFrame(() => this.#tick());
      return;
    }
    const t = this.#targetAngle();
    if (this.#reduceMotion) {
      this.#ang = t;
      this.#vel = 0;
    } else {
      this.#vel += (t - this.#ang) * 0.045;
      this.#vel *= 0.9;
      this.#ang += this.#vel;
    }
    this.#lerpFigureX();
    this.#updateSceneNow();
    if (this.#needsAnimationFrame()) {
      this.#raf = requestAnimationFrame(() => this.#tick());
    } else {
      this.#raf = null;
    }
  }
  #ensureAnimLoop() {
    if (this.#raf == null) {
      this.#raf = requestAnimationFrame(() => this.#tick());
    }
  }
  #needsAnimationFrame() {
    if (Math.abs(this.#vel) >= 1e-3) return true;
    if (this.#phase === "dropping" || this.#phase === "settled") return true;
    if (this.#minePopStart > 0) {
      const age = (performance.now() - this.#minePopStart) / 400;
      if (age < 1 && !this.#reduceMotion) return true;
    }
    const { people } = this.#buildPeople();
    const xs = this.#layoutTargets(people.length);
    for (let i = 0; i < people.length; i++) {
      const id = people[i].id;
      const target = xs[i];
      const cur = this.#displayX[id] ?? target;
      if (Math.abs(cur - target) > 0.4) return true;
    }
    const dropping = this.#dishes.sav.concat(this.#dishes.swt).some(
      (d) => d.mine && !d.landed && d.fy
    );
    if (dropping) return true;
    return false;
  }
  /** @param {number} n */
  #layoutTargets(n) {
    return layoutX(n, HALF);
  }
  #lerpFigureX() {
    const { people } = this.#buildPeople();
    const xs = this.#layoutTargets(people.length);
    const key = people.map((p) => p.id).join("|");
    if (key !== this.#lastPeopleKey) {
      this.#lastPeopleKey = key;
      for (let i = 0; i < people.length; i++) {
        const id = people[i].id;
        if (!(id in this.#displayX)) {
          this.#displayX[id] = xs[i];
        }
      }
    }
    for (let i = 0; i < people.length; i++) {
      const id = people[i].id;
      const target = xs[i];
      const cur = this.#displayX[id] ?? target;
      this.#displayX[id] = cur + (target - cur) * 0.15;
    }
    for (const id of Object.keys(this.#displayX)) {
      if (!people.some((p) => p.id === id)) delete this.#displayX[id];
    }
  }
  #buildPeople() {
    const list = [];
    for (const side of this.#sides) {
      this.#dishes[side].forEach((d, i) => {
        if (d.mine || !d.landed) return;
        list.push({
          id: `guest-${side}-${i}-${d.name || "dish"}`,
          mine: false,
          host: false
        });
      });
    }
    const showMine = this.#mine && this.#phase !== "intro";
    if (showMine) {
      const p = { id: this.#guestId, mine: true, host: false };
      if (this.#mine.side === "sav") list.unshift(p);
      else list.push(p);
    }
    const total = list.length;
    const people = list.slice(0, 10);
    if (this.#apiBypass && people.length) people[0].host = true;
    else if (people.length === 1) people[0].host = true;
    return { people, extra: Math.max(0, total - 10) };
  }
  #startBoil() {
    this.#boilTimer = setInterval(() => {
      if (this.#boilOn && !this.#reduceMotion) {
        this.#boilSeed = this.#boilSeed % 4 + 1;
        this.shadowRoot.querySelector(`#turb-${this.#uid}`)?.setAttribute("seed", String(this.#boilSeed));
      }
    }, 160);
  }
  #renderShell() {
    const step = this.getAttribute("step-label") || "";
    const styleBlock = INLINE_CSS ? `<style>${INLINE_CSS}</style>` : `<link rel="stylesheet" href="${STYLE_URL}">`;
    this.shadowRoot.innerHTML = `
      ${styleBlock}
      <link rel="stylesheet" href="${FONT_URL}">
        <main class="rsvp-step">
          ${stepNavHtml(esc(step))}
          <h1 class="step-title" id="headline">Add to the spread</h1>
          <div class="step-body">
            <div class="step-scene">
              <svg class="plate-scene" id="bal" viewBox="-240 40 480 270" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="balDesc">
                <title id="balDesc">The potluck table</title>
                <g id="fx"></g>
                <g id="sceneMount"></g>
              </svg>
            </div>
            <p class="sr" aria-live="polite" id="live"></p>
            <div class="step-content">
              <section class="panel" id="panel" aria-live="polite"></section>
            </div>
            <div class="step-actions" id="actions"></div>
          </div>
        </main>
    `;
  }
  #bindEvents() {
    this.shadowRoot.addEventListener("click", (e) => this.#onClick(e));
  }
  /** @param {MouseEvent} e */
  #onClick(e) {
    if (e.target.closest("[data-step-prev]:not(:disabled)")) {
      this.#emit("btt:back", {});
      return;
    }
    const pick = e.target.closest("[data-pick]");
    if (pick && (this.#phase === "intro" || this.#phase === "done")) {
      if (this.#phase === "done") this.#changeDish();
      if (this.#phase !== "intro") return;
      const side = pick.dataset.pick;
      const d = {
        name: null,
        side,
        icon: side === "sav" ? "pot" : "slice",
        mine: true,
        landed: false,
        fy: -90
      };
      this.#dishes[side].push(d);
      this.#mine = d;
      this.#manualIcon = false;
      this.#phase = "dropping";
      this.#minePopStart = performance.now();
      this.#ensureAnimLoop();
      this.shadowRoot.querySelectorAll("[data-pick]").forEach((b) => {
        b.disabled = true;
      });
      this.#emit("btt:pick", { side: toPublicSide(
        /** @type {import('./icons.js').SideCode} */
        side
      ) });
      this.#renderPanel();
      this.#drop(d);
      const delay = this.#reduceMotion ? 0 : _BalanceTheTable.#DROP_MS;
      setTimeout(() => {
        if (this.#phase === "dropping") this.#settleOnPlate(null);
      }, delay);
      return;
    }
  }
  #changeDish() {
    const d = this.#mine;
    if (!d) return;
    this.#dishes[d.side] = this.#dishes[d.side].filter((x) => x !== d);
    this.#mine = null;
    this.#manualIcon = false;
    this.#minePopStart = 0;
    this.#clearSavedContribution();
    this.#phase = "intro";
    this.#emit("btt:change", {});
    this.#syncFormFields();
    this.#drawScene();
    this.#renderPanel();
    const api = this.#apiBase();
    if (api && !this.#apiBypass) {
      void removeContribution(api, this.#eventId(), this.#guestId);
    }
  }
  /** @param {object} d */
  #drop(d) {
    if (this.#reduceMotion) {
      d.landed = true;
      d.fy = 0;
      this.#updateSceneNow();
      this.#ensureAnimLoop();
      this.#afterLand(d);
      return;
    }
    const start = performance.now();
    const dur = _BalanceTheTable.#DROP_MS;
    const from = -90;
    let landed = false;
    this.#ensureAnimLoop();
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      d.fy = from * (1 - easeOutBounce(t));
      if (!landed && t > 0.36) {
        landed = true;
        d.landed = true;
        this.#vel += (d.side === "swt" ? 1 : -1) * 1.6;
        this.#afterLand(d);
      }
      if (landed) d.fy = from * (1 - easeOutBounce(t));
      this.#updateSceneNow();
      if (t < 1) requestAnimationFrame(step);
      else {
        d.fy = 0;
        this.#updateSceneNow();
      }
    };
    requestAnimationFrame(step);
  }
  /** @param {object} d */
  #afterLand(d) {
    const side = d.side;
    const before = Math.abs(
      this.#counted("swt") - (side === "swt" ? 1 : 0) - (this.#counted("sav") - (side === "sav" ? 1 : 0))
    );
    const after = Math.abs(this.#counted("swt") - this.#counted("sav"));
    if (after < before) this.#burst(side);
    const live = this.#$("#live");
    if (live) {
      live.textContent = `Your dish joined the ${side === "sav" ? "savoury" : "sweet"} side.`;
    }
    this.#updateBalanceDescription();
  }
  /** @param {import('./icons.js').SideCode} side */
  #burst(side) {
    const d = this.#mine;
    let x = 0;
    let y = 0;
    if (d) {
      const list = this.#dishes[side].filter(
        (row) => row.landed !== false || row.mine && !row.landed
      );
      const idx = list.indexOf(d);
      const coords = idx >= 0 ? dishWorldCoords(side, idx, this.#ang) : dishWorldCoords(side, 0, this.#ang);
      x = coords.x;
      y = coords.y;
    } else {
      const coords = dishWorldCoords(side, 0, this.#ang);
      x = coords.x;
      y = coords.y;
    }
    let lines = "";
    for (let i = 0; i < 8; i++) {
      const th = i * Math.PI / 4;
      lines += `<line x1="${Math.cos(th) * 52}" y1="${Math.sin(th) * 44}" x2="${Math.cos(th) * 64}" y2="${Math.sin(th) * 54}"/>`;
    }
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${x} ${y})`);
    g.innerHTML = `<g class="burst" style="transform-box:fill-box;transform-origin:center">${lines}</g>`;
    this.#$("#fx")?.appendChild(g);
    setTimeout(() => g.remove(), 900);
  }
  #updateSceneNow() {
    const mount = this.#$("#sceneMount");
    if (!mount?.querySelector("#plateRot")) return;
    const dishes = this.#dishes.sav.concat(this.#dishes.swt);
    const { people, extra } = this.#buildPeople();
    updatePlateScene(mount, {
      ang: this.#ang,
      nowMs: performance.now(),
      dishes,
      people,
      displayX: this.#displayX,
      reduceMotion: this.#reduceMotion,
      phase: this.#phase,
      extraHelpers: extra,
      minePopStart: this.#minePopStart
    });
  }
  #drawScene() {
    const mount = this.#$("#sceneMount");
    if (!mount) return;
    const roughId = `rough-${this.#uid}`;
    const turbId = `turb-${this.#uid}`;
    if (!mount.querySelector("#plateRot")) {
      mount.innerHTML = buildPlateSceneShell({
        roughId,
        turbId,
        boilSeed: this.#boilSeed
      });
    }
    const dishes = this.#dishes.sav.concat(this.#dishes.swt);
    for (const d of dishes) d.pop = false;
    this.#updateSceneNow();
    this.#updateBalanceDescription();
    this.#ensureAnimLoop();
  }
  #btnIcon(ic, side) {
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><g class="dish" style="--c:var(--${side})">${ICONS[ic]}</g></svg>`;
  }
  /** @param {boolean} [disabled] */
  /** @param {boolean} [disabled] */
  #pickActionsMarkup(disabled = false) {
    const dis = disabled ? " disabled" : "";
    return `<div class="choices choices-col">
        <button type="button" class="ink-btn" data-pick="sav"${dis}>SAVOURY</button>
        <button type="button" class="ink-btn" data-pick="swt"${dis}>SWEET</button>
      </div>`;
  }
  #renderPanel() {
    const p = this.#$("#panel");
    const actions = this.#$("#actions");
    const headline = this.#$("#headline");
    if (!p || !headline || !actions) return;
    const helpCopy = "Add to the spread";
    const firstCopy = "Add to the spread";
    const tableEmpty = !this.#dishes.sav.length && !this.#dishes.swt.length;
    if (this.#phase === "loading") {
      headline.textContent = helpCopy;
      p.innerHTML = `<div class="fade"><div class="label">Your move.</div></div>`;
      actions.innerHTML = this.#pickActionsMarkup(true);
      return;
    }
    headline.textContent = tableEmpty && !this.#mine ? firstCopy : helpCopy;
    if (this.#phase === "settled") {
      p.innerHTML = "";
      actions.innerHTML = "";
      return;
    }
    if (this.#phase === "intro" || this.#phase === "dropping" || this.#phase === "done") {
      p.innerHTML = `<div class="fade"><div class="label">Your move.</div></div>`;
      actions.innerHTML = this.#pickActionsMarkup(this.#phase === "dropping");
      return;
    }
  }
  #updateBalanceDescription() {
    const title = this.#$("#balDesc");
    if (!title) return;
    const s = this.#counted("sav");
    const w = this.#counted("swt");
    const { people, extra } = this.#buildPeople();
    const n = people.length + extra;
    title.textContent = `${n} ${n === 1 ? "person is" : "people are"} holding up the table: ${s} savoury and ${w} sweet dishes.`;
  }
  /** @param {string|null} name */
  #settleOnPlate(name) {
    const d = this.#mine;
    if (!d) return;
    d.name = name;
    d.icon = d.side === "sav" ? "pot" : "slice";
    this.#manualIcon = false;
    d.pop = true;
    d.landed = true;
    this.#phase = "settled";
    this.#minePopStart = performance.now();
    this.#drawScene();
    this.#renderPanel();
    const publicSide = toPublicSide(d.side);
    this.#writeSavedContribution({
      side: publicSide,
      dishName: d.name,
      icon: d.icon
    });
    this.#syncFormFields();
    const api = this.#apiBase();
    if (api && !this.#apiBypass) {
      const trimmed = d.name ? String(d.name).trim().slice(0, 40) : null;
      void upsertContribution(api, {
        event: this.#eventId(),
        guestId: this.#guestId,
        side: publicSide,
        name: trimmed,
        icon: d.icon
      });
    }
    const hold = this.#reduceMotion ? 420 : _BalanceTheTable.#PLATE_HOLD_MS;
    setTimeout(() => {
      if (this.#phase !== "settled" || this.#mine !== d) return;
      this.#phase = "done";
      this.#drawScene();
      this.#emit("btt:complete", {
        side: publicSide,
        dishName: d.name,
        icon: d.icon,
        guestId: this.#guestId
      });
    }, hold);
    setTimeout(() => {
      if (this.#mine === d) this.#drawScene();
    }, 2600);
  }
  #syncFormFields() {
    const form = this.closest("form");
    if (!form) return;
    const ensure = (name) => {
      let el = form.querySelector(`input[name="${name}"]`);
      if (!el) {
        el = document.createElement("input");
        el.type = "hidden";
        el.name = name;
        form.appendChild(el);
      }
      return el;
    };
    const sideEl = ensure("btt_side");
    const dishEl = ensure("btt_dish");
    const iconEl = ensure("btt_icon");
    if (this.#mine && this.#phase === "done") {
      sideEl.value = toPublicSide(this.#mine.side);
      dishEl.value = this.#mine.name ?? "";
      iconEl.value = this.#mine.icon;
    } else {
      sideEl.value = "";
      dishEl.value = "";
      iconEl.value = "";
    }
  }
  getGuestId() {
    return this.#guestId;
  }
  /** Re-draw panel + scene (e.g. after step 1 → 2 transition). */
  refreshUi() {
    this.#drawScene();
    this.#renderPanel();
    this.#syncFormFields();
  }
  /** @returns {{ side: 'savoury'|'sweet'; dishName: string|null; icon: string; guestId: string }|null} */
  getCompletion() {
    if (this.#mine?.landed) {
      return {
        side: toPublicSide(this.#mine.side),
        dishName: this.#mine.name,
        icon: this.#mine.icon,
        guestId: this.#guestId
      };
    }
    const saved = this.#readSavedContribution();
    if (!saved) return null;
    return {
      side: (
        /** @type {'savoury'|'sweet'} */
        saved.side
      ),
      dishName: saved.dishName,
      icon: saved.icon,
      guestId: this.#guestId
    };
  }
  /** @param {string} type @param {object} detail */
  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
  }
  #renderAll() {
    this.#drawScene();
    this.#renderPanel();
    this.#syncFormFields();
  }
};
customElements.define("balance-the-table", BalanceTheTable);
export {
  BalanceTheTable
};
