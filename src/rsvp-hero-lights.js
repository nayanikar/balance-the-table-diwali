/** @typedef {{ x: number; y: number }} Pt */

/** @param {number} t @param {Pt} p0 @param {Pt} p1 @param {Pt} p2 @param {Pt} p3 */
function cubicAt(t, p0, p1, p2, p3) {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
    y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y,
  };
}

/** Smooth cubic chain: M p0, C c1 c2 p3, S s2 p5, S s4 p7 */
const WIRE_SEGMENTS = [
  {
    p0: { x: 26, y: 138 },
    p1: { x: 38, y: 62 },
    p2: { x: 92, y: 26 },
    p3: { x: 112, y: 72 },
  },
  {
    p0: { x: 112, y: 72 },
    p1: { x: 132, y: 112 },
    p2: { x: 172, y: 128 },
    p3: { x: 162, y: 52 },
  },
  {
    p0: { x: 162, y: 52 },
    p1: { x: 152, y: 22 },
    p2: { x: 238, y: 12 },
    p3: { x: 294, y: 34 },
  },
];

export const HERO_VIEW_W = 320;
export const HERO_VIEW_H = 180;
export const HERO_G = 152;

export const WIRE_PATH_D =
  'M 26 138 C 38 62 92 26 112 72 C 132 112 172 128 162 52 C 152 22 238 12 294 34';

const SEG_SAMPLES = 24;

/** @returns {Pt[]} */
function wirePolyline() {
  /** @type {Pt[]} */
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

/** @param {Pt[]} pts */
function cumulativeLengths(pts) {
  const len = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    len.push(len[i - 1] + Math.hypot(dx, dy));
  }
  return len;
}

/** @param {Pt[]} pts @param {number[]} cum @param {number} d */
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
    y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
  };
}

/** @param {number} count */
export function sampleBulbs(count = 16) {
  const pts = wirePolyline();
  const cum = cumulativeLengths(pts);
  const total = cum[cum.length - 1];
  const cols = ['a', 'b', 'c', 'd', 'e'];
  /** @type {{ x: number; y: number; c: string }[]} */
  const bulbs = [];
  for (let i = 0; i < count; i++) {
    const d = ((i + 0.5) / count) * total;
    const p = pointAtLength(pts, cum, d);
    bulbs.push({ x: p.x, y: p.y, c: cols[i % cols.length] });
  }
  return bulbs;
}

/** Approximate wire y directly above figure feet at x */
export function wireYAt(x) {
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

export function buildBulbMarkup(bulbs) {
  return bulbs
    .map(
      ({ x, y, c }) =>
        `<line class="ln thin" x1="${x.toFixed(1)}" y1="${(y - 7).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y - 11).toFixed(1)}"/>`
        + `<circle class="bulb bulb-${c}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5"/>`,
    )
    .join('');
}
