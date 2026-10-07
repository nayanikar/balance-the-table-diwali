import { figure, platterSVG } from './figures.js';
import { ICONS, PALETTE } from './icons.js';

const G = 226;
const TX = 350;
const PLATE_Y = 128;
const PS = 0.82;

const PEOPLE = [
  { x: 34, kind: 'hip', host: true },
  { x: 80, kind: 'sparkler' },
  { x: 126, kind: 'cheer' },
  { x: 168, kind: 'wave', mine: true },
  { x: 532, kind: 'cheer' },
  { x: 576, kind: 'sparkler' },
  { x: 620, kind: 'hip' },
  { x: 666, kind: 'wave' },
];

/** @param {import('./icons.js').SideCode} side @param {number} i */
function slot(side, i) {
  return { x: (side === 'sav' ? -1 : 1) * (34 + i * 40), y: i % 2 ? 3 : -3 };
}

function lights() {
  const c = ['#f8c94e', '#ef8fb3', '#f2a145', '#c8442f'];
  let b = '';
  for (let i = 1; i < 22; i++) {
    const t = i / 22;
    const x = 10 + t * 680;
    const y = 10 + 2 * t * (1 - t) * 36;
    b += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 5}" stroke="var(--ink)" stroke-width="1.2"/><circle cx="${x}" cy="${y + 10}" r="5.5" fill="${c[i % 4]}" stroke="var(--ink)" stroke-width="1.6"/>`;
  }
  return `<path class="ln thin" d="M10 10 Q350 46 690 10"/>${b}`;
}

/**
 * @param {{ side: import('./icons.js').SideCode; index: number }} mine
 */
function tableMarkup(mine) {
  const HW = 210 * PS;
  const a = HW - 34;
  const legs = `<path class="solid" d="M${TX - a - 6} ${PLATE_Y + 8} L${TX - a - 22} ${G} L${TX - a - 9} ${G} L${TX - a + 7} ${PLATE_Y + 8}Z"/>
    <path class="solid" d="M${TX + a - 7} ${PLATE_Y + 8} L${TX + a + 9} ${G} L${TX + a + 22} ${G} L${TX + a + 6} ${PLATE_Y + 8}Z"/>
    <path class="ln thin" d="M${TX - a - 14} ${G - 30} H${TX + a + 14}"/>`;

  const dishes = [];
  for (let i = 0; i < 4; i++) {
    for (const side of /** @type {const} */ (['sav', 'swt'])) {
      const s = slot(side, i);
      const ic = PALETTE[side][i % PALETTE[side].length];
      const isMine = side === mine.side && i === mine.index;
      dishes.push({
        y: s.y,
        h: `${isMine ? `<ellipse class="halo" cx="${s.x}" cy="${s.y - 14}" rx="22" ry="19"/>` : ''}<ellipse class="dish-shadow" cx="${s.x}" cy="${s.y + 0.5}" rx="13" ry="2.6"/><g class="dish" style="--c:var(--${side})" transform="translate(${s.x} ${s.y}) rotate(${(i * 7) % 9 - 4}) scale(1) translate(-20 -35)">${ICONS[ic] || ICONS.cloche}</g>`,
      });
    }
  }
  const dishHtml = dishes.sort((x, y) => x.y - y.y).map((d) => d.h).join('');
  const mineX = slot(mine.side, mine.index).x;
  const mx = TX + mineX * PS;
  const my = PLATE_Y - 30;
  return `${legs}<g transform="translate(${TX} ${PLATE_Y}) scale(${PS})">${platterSVG()}${dishHtml}</g>
    <path class="ln thin" d="M${mx - 16} ${my - 4} q-14 -4 -20 -18" opacity=".7"/><path class="ln thin" d="M${mx - 16} ${my - 4} l-6 -1 m6 1 l-2 -6" opacity=".7"/><text class="yours" x="${mx - 78}" y="${my - 24}">yours!</text>`;
}

/**
 * @param {SVGSVGElement} svg
 * @param {{ side?: import('./icons.js').SideCode; slotIndex?: number; reduceMotion?: boolean }} [opts]
 */
export function startConfirmationScene(svg, opts = {}) {
  const reduceMotion = opts.reduceMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** @type {import('./icons.js').SideCode} */
  let mineSide = opts.side ?? 'sav';
  let mineIndex = opts.slotIndex ?? 0;

  const narrow = matchMedia('(max-width: 560px)');
  const fitView = () => {
    svg.setAttribute('viewBox', narrow.matches ? '104 0 492 236' : '0 0 700 236');
  };
  fitView();
  narrow.addEventListener('change', fitView);

  let seed = 2;
  const boilTimer = reduceMotion
    ? null
    : setInterval(() => {
        if (!document.hidden) seed = (seed % 4) + 1;
      }, 160);

  let raf = 0;
  const frame = (now) => {
    const t = reduceMotion ? 0 : now / 1000;
    const figs = PEOPLE.map((p, i) =>
      figure({
        x: p.x,
        ground: G,
        pose: 'cheer',
        kind: p.kind === 'cheer' ? 'hip' : p.kind,
        dir: p.x < TX ? 1 : -1,
        mine: !!p.mine,
        host: !!p.host,
        t,
        phase: i * 1.3,
      }),
    ).join('');
    svg.innerHTML = `<defs><filter id="rough-confirm" x="-10%" y="-20%" width="120%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter></defs>
    <g filter="url(#rough-confirm)">${lights()}
      <path class="ln" d="M4 ${G} H696"/><path class="scallop" d="M10 ${G}${' q 12 10 24 0'.repeat(28)}"/>
      ${tableMarkup({ side: mineSide, index: mineIndex })}${figs}</g>`;
    if (!reduceMotion) raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);

  return {
    /** @param {import('./icons.js').SideCode} side @param {number} [index] */
    setMine(side, index = 0) {
      mineSide = side;
      mineIndex = index;
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (boilTimer) clearInterval(boilTimer);
      narrow.removeEventListener('change', fitView);
    },
  };
}
