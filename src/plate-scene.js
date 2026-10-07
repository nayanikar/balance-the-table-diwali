import { ICONS } from './icons.js';
import {
  PLATTER,
  platterSVG,
  platterUnderside,
  platterUndersideLocal,
  dishSlot,
  figure,
  layoutX,
  kindFor,
} from './figures.js';

export { layoutX };

export const G = 232;
export const HALF = PLATTER.HALF;
export const CY = G - 60 - platterUndersideLocal(0);
export const MAXT = 12;

const SCALLOP = `<path class="scallop" d="M-228 ${G}${' q 12 10 24 0'.repeat(19)}"/>`;
const PLATE_MARKUP = platterSVG();

/** @param {string} icon @param {number} i */
function dishRotDeg(icon, i) {
  let h = 0;
  for (const c of String(icon) + i) h = (h * 37 + c.charCodeAt(0)) | 0;
  return (Math.abs(h) % 9) - 4;
}

/**
 * @param {import('./icons.js').SideCode} side
 * @param {number} index
 * @param {number} ang
 */
export function dishWorldCoords(side, index, ang) {
  const slot = dishSlot(side, index);
  const rad = (ang * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: slot.x * cos - slot.y * sin,
    y: CY + slot.x * sin + slot.y * cos,
  };
}

/**
 * @param {object} opts
 * @param {string} opts.roughId
 * @param {string} opts.turbId
 * @param {number} [opts.boilSeed]
 */
export function buildPlateSceneShell({ roughId, turbId, boilSeed = 2 }) {
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

/**
 * @param {object[]} dishes
 * @param {'loading'|'intro'|'dropping'|'naming'|'done'} phase
 */
function buildDishesMarkup(dishes, phase) {
  /** @type {{ y: number; html: string }[]} */
  const items = [];

  for (const side of /** @type {const} */ (['sav', 'swt'])) {
    const list = dishes.filter(
      (d) =>
        d.side === side && (d.landed !== false || (d.mine && !d.landed)),
    );
    list.forEach((d, i) => {
      if (i >= 12) return;
      const slot = dishSlot(side, i);
      const r = dishRotDeg(d.icon, i);
      const yOff = d.mine && !d.landed && d.fy ? d.fy * 0.55 : 0;
      const y = slot.y + yOff;
      const settled = d.mine && phase === 'done';
      items.push({
        y,
        html: `<g class="dish-slot" data-y="${y}">
          <ellipse class="dish-shadow" cx="${slot.x}" cy="${y + 0.5}" rx="13" ry="2.6"/>
          <g class="dish${d.mine ? ' mine' : ''}${settled ? ' settled' : ''}" style="--c:var(--${side})" transform="translate(${slot.x} ${y}) rotate(${r}) scale(0.78)">
            ${d.mine ? '<ellipse class="halo" cx="0" cy="-12" rx="18" ry="14"/>' : ''}
            <g class="${d.pop ? 'pop' : ''}" transform="translate(-20 -35)">${ICONS[d.icon] || ICONS.cloche}</g>
          </g>
        </g>`,
      });
    });
  }

  items.sort((a, b) => a.y - b.y);
  let html = items.map((it) => it.html).join('');

  for (const side of /** @type {const} */ (['sav', 'swt'])) {
    const n = dishes.filter(
      (d) =>
        d.side === side && (d.landed !== false || (d.mine && !d.landed)),
    ).length;
    const more = Math.max(0, n - 12);
    if (more > 0) {
      html += `<text class="more" x="${side === 'sav' ? -150 : 150}" y="-36">+${more} more</text>`;
    }
  }
  return html;
}

/**
 * @param {number} age 0–1+
 */
export function popScaleForAge(age, reduceMotion) {
  if (reduceMotion || age >= 1) return 1;
  if (age <= 0) return 0;
  return Math.max(0, 1 + 2.2 * (age - 1) ** 3 + 1.2 * (age - 1) ** 2);
}

/**
 * @param {ParentNode} mount
 * @param {object} opts
 * @param {number} opts.ang
 * @param {number} opts.nowMs
 * @param {object[]} opts.dishes
 * @param {object[]} opts.people
 * @param {Record<string, number>} opts.displayX
 * @param {boolean} opts.reduceMotion
 * @param {'loading'|'intro'|'dropping'|'naming'|'done'} opts.phase
 * @param {number} opts.extraHelpers
 * @param {number} [opts.minePopStart]
 */
export function updatePlateScene(mount, opts) {
  const {
    ang,
    nowMs,
    dishes,
    people,
    displayX,
    reduceMotion,
    phase,
    extraHelpers,
    minePopStart = 0,
  } = opts;

  const t = reduceMotion ? 0 : nowMs / 1000;
  const figEl = mount.querySelector('#sceneFigures');
  const rotEl = mount.querySelector('#plateRot');
  const foodEl = mount.querySelector('#plateFood');
  const helpEl = mount.querySelector('#sceneHelping');
  if (!figEl || !rotEl || !foodEl) return;

  rotEl.setAttribute('transform', `translate(0 ${CY}) rotate(${ang.toFixed(2)})`);

  const xs = layoutX(people.length, HALF);
  let figs = '';
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
      kind: p.mine ? 'wave' : kindFor(p.id),
      mine: !!p.mine,
      host: !!p.host,
      t,
      scale,
    });
  });
  figEl.innerHTML = figs;
  foodEl.innerHTML = buildDishesMarkup(dishes, phase);

  if (helpEl) {
    if (extraHelpers > 0) {
      helpEl.textContent = `+${extraHelpers} helping`;
      helpEl.setAttribute('visibility', 'visible');
    } else {
      helpEl.setAttribute('visibility', 'hidden');
      helpEl.textContent = '';
    }
  }
}
