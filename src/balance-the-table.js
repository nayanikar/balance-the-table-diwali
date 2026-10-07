import {
  ICONS,
  SEEDS,
  iconFor,
  toPublicSide,
  toSideCode,
} from './icons.js';
import { getTable } from './api.js';
import { enqueuePost } from './sync-queue.js';
import {
  buildPlateSceneShell,
  dishWorldCoords,
  HALF,
  layoutX,
  MAXT,
  updatePlateScene,
} from './plate-scene.js';
import { setStepNavState, stepNavHtml } from './step-nav.js';

const STYLE_URL = new URL('./styles.css', import.meta.url).href;
/** @type {string|undefined} */
const INLINE_CSS = typeof BTT_INLINE_CSS !== 'undefined' ? BTT_INLINE_CSS : undefined;
const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Patrick+Hand&display=swap';

const LOADING_MS = 1500;

let instanceCounter = 0;

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
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
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class BalanceTheTable extends HTMLElement {
  static observedAttributes = ['event-id', 'api', 'guest-id', 'step-label'];

  /** @type {import('./icons.js').SideCode[]} */
  #sides = ['sav', 'swt'];

  /** @type {{ sav: object[]; swt: object[] }} */
  #dishes = { sav: [], swt: [] };

  /** @type {'loading'|'intro'|'dropping'|'settled'|'naming'|'done'} */
  #phase = 'loading';

  static #DROP_MS = 920;

  static #PLATE_HOLD_MS = 2000;

  /** @type {object|null} */
  #mine = null;

  /** @type {boolean} */
  #manualIcon = false;

  /** @type {string} */
  #devSeed = 'sweet';

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
  #uid = '';

  /** @type {string} */
  #guestId = '';

  /** @type {AbortController|null} */
  #loadAbort = null;

  /** @type {boolean} */
  #apiBypass = false;

  /** @type {boolean} */
  #bootHydrated = false;

  /** @type {number} */
  #attendingCount = 0;

  /** @type {boolean} */
  #loadError = false;

  /** @type {number} */
  #gapBeforePick = 0;

  /** @type {boolean} */
  #reduceMotion = false;

  /** @type {Record<string, number>} */
  #displayX = {};

  /** @type {number} */
  #minePopStart = 0;

  /** @type {number} */
  #lastPeopleKey = '';

  constructor() {
    super();
    this.#uid = `btt${++instanceCounter}`;
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.#reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.#renderShell();
    this.#bindEvents();
    setStepNavState(this.shadowRoot, { prev: true, next: false });
    this.#guestId = this.#resolveGuestId();
    this.#phase = 'loading';
    this.#renderAll();
    if (this.#apiBase() && !this.#bootHydrated) void this.#loadInitial();
    else if (!this.#apiBase()) {
      this.#phase = 'intro';
      this.#renderAll();
    }
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
    this.#lastPeopleKey = '';
    this.#clearSavedContribution();
    this.#loadTableFromSeed(seed);
    this.#phase = 'intro';
    this.#ang = this.#targetAngle();
    this.#vel = 0;
    this.#renderAll();
  }

  attributeChangedCallback(name, _old, value) {
    if (!this.shadowRoot?.querySelector('.rsvp-step')) return;
    if (name === 'step-label') {
      const el = this.#$('.step-label');
      if (el) el.textContent = value || '';
    }
  }

  #$(sel) {
    return this.shadowRoot.querySelector(sel);
  }

  #eventId() {
    return this.getAttribute('event-id') || 'default';
  }

  #apiBase() {
    return this.getAttribute('api')?.trim() || '';
  }

  #storageKeyGuest() {
    return `btt:${this.#eventId()}:guestId`;
  }

  #storageKeyContribution() {
    return `btt:${this.#eventId()}:${this.#guestId}`;
  }

  #resolveGuestId() {
    const attr = this.getAttribute('guest-id');
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
      /* ignore */
    }
  }

  #clearSavedContribution() {
    this.#writeSavedContribution(null);
  }

  hydrateFromBoot({ dishes, people, me, loadError }) {
    this.#bootHydrated = true;
    this.#loadAbort?.abort();
    this.#attendingCount = people?.attending ?? 0;
    this.#loadError = Boolean(loadError);
    if (this.#loadError) {
      this.#dishes = { sav: [], swt: [] };
      this.#mine = null;
      this.#phase = 'intro';
    } else {
      this.#setDishesFromApi(dishes || []);
      const mine = me?.side
        ? { side: me.side, name: me.dishName, icon: me.icon || 'cloche' }
        : null;
      this.#attachMine(mine);
      this.#phase = this.#mine ? 'done' : 'intro';
    }
    this.#ang = this.#targetAngle();
    this.#vel = 0;
    this.#renderAll();
    this.#syncFormFields();
  }

  async #loadInitial() {
    if (this.#apiBypass || this.#bootHydrated) return;
    const api = this.#apiBase();
    this.#loadAbort = new AbortController();
    const { signal } = this.#loadAbort;

    const timeout = new Promise((_, reject) => {
      setTimeout(() => {
        signal.abort();
        reject(new Error('timeout'));
      }, LOADING_MS);
    });

    try {
      if (!api) throw new Error('no api');
      const data = await Promise.race([
        getTable(api, this.#eventId(), this.#guestId, signal),
        timeout,
      ]);
      if (!data) throw new Error('empty');
      this.#setDishesFromApi(data.dishes);
      const mineSource =
        data.mine ??
        (() => {
          const saved = this.#readSavedContribution();
          if (!saved) return null;
          return {
            side: /** @type {'savoury'|'sweet'} */ (saved.side),
            name: saved.dishName,
            icon: saved.icon || 'cloche',
          };
        })();
      this.#attachMine(mineSource);
      this.#phase = this.#mine ? 'done' : 'intro';
    } catch {
      if (!signal.aborted && !this.#apiBypass) {
        this.#loadError = true;
        this.#dishes = { sav: [], swt: [] };
        this.#mine = null;
        this.#phase = 'intro';
      }
    }

    this.#ang = this.#targetAngle();
    this.#vel = 0;
    this.#renderAll();
    this.#syncFormFields();
    this.#emit('btt:loaded', { complete: this.#phase === 'done' });
  }

  /** @param {{ side: string; name: string|null; icon: string }[]} dishes */
  #setDishesFromApi(dishes) {
    this.#dishes = { sav: [], swt: [] };
    dishes.forEach((row, i) => {
      const side = toSideCode(/** @type {'savoury'|'sweet'} */ (row.side));
      const name = row.name;
      this.#dishes[side].push({
        name,
        side,
        icon: row.icon || iconFor(side, name, i),
        mine: false,
        landed: true,
      });
    });
  }

  /** @param {{ side: string; name: string|null; icon: string }|null} mine */
  #attachMine(mine) {
    this.#mine = null;
    if (!mine) return;
    const side = toSideCode(/** @type {'savoury'|'sweet'} */ (mine.side));
    const icon = mine.icon || 'cloche';
    const name = mine.name;
    const existing = this.#dishes[side].find(
      (d) => d.name === name && d.icon === icon && !d.mine,
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
      icon: saved.icon || 'cloche',
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
        landed: true,
      }));
    }
  }

  #counted(side) {
    return this.#dishes[side].filter((d) => !(d.mine && !d.landed)).length;
  }

  #targetAngle() {
    const d = this.#counted('swt') - this.#counted('sav');
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
    if (Math.abs(this.#vel) >= 0.001) return true;
    if (this.#phase === 'dropping' || this.#phase === 'settled') return true;
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
      (d) => d.mine && !d.landed && d.fy,
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
    const key = people.map((p) => p.id).join('|');
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
    const showMine = this.#mine && this.#phase !== 'intro';
    let total = this.#attendingCount;
    const dishCount = this.#dishes.sav.length + this.#dishes.swt.length;
    const hostOnly = total === 0 && dishCount > 0;
    if (hostOnly) total = 1;
    if (showMine && total < 1) total = 1;

    /** @type {{ id: string; mine: boolean; host: boolean }[]} */
    const list = [];
    for (let i = 0; i < total; i++) {
      const isMineSlot = showMine && (i === 0 || (total === 1 && showMine));
      list.push({
        id: isMineSlot ? this.#guestId : `guest-${i}`,
        mine: Boolean(isMineSlot),
        host: hostOnly && i === 0 && !showMine,
      });
    }
    if (!hostOnly && list.length === 1) list[0].host = true;

    const people = list.slice(0, 10);
    return { people, extra: Math.max(0, total - 10) };
  }

  #startBoil() {
    this.#boilTimer = setInterval(() => {
      if (this.#boilOn && !this.#reduceMotion) {
        this.#boilSeed = (this.#boilSeed % 4) + 1;
        this.shadowRoot.querySelector(`#turb-${this.#uid}`)?.setAttribute('seed', String(this.#boilSeed));
      }
    }, 160);
  }

  #renderShell() {
    const step = this.getAttribute('step-label') || '';

    const styleBlock = INLINE_CSS
      ? `<style>${INLINE_CSS}</style>`
      : `<link rel="stylesheet" href="${STYLE_URL}">`;

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
    this.shadowRoot.addEventListener('click', (e) => this.#onClick(e));
  }

  /** @param {MouseEvent} e */
  #onClick(e) {
    if (e.target.closest('[data-step-prev]:not(:disabled)')) {
      this.#emit('btt:back', {});
      return;
    }

    const pick = e.target.closest('[data-pick]');
    if (pick && (this.#phase === 'intro' || this.#phase === 'done')) {
      if (this.#phase === 'done') this.#changeDish();
      if (this.#phase !== 'intro') return;

      const side = pick.dataset.pick;
      this.#gapBeforePick = Math.abs(this.#counted('swt') - this.#counted('sav'));
      const d = {
        name: null,
        side,
        icon: side === 'sav' ? 'pot' : 'slice',
        mine: true,
        landed: false,
        fy: -90,
      };
      this.#dishes[side].push(d);
      this.#mine = d;
      this.#manualIcon = false;
      this.#phase = 'dropping';
      this.#minePopStart = performance.now();
      this.#ensureAnimLoop();
      this.shadowRoot.querySelectorAll('[data-pick]').forEach((b) => {
        b.disabled = true;
      });
      this.#emit('btt:pick', { side: toPublicSide(/** @type {import('./icons.js').SideCode} */ (side)) });
      this.#renderPanel();
      this.#drop(d);
      const delay = this.#reduceMotion ? 0 : BalanceTheTable.#DROP_MS;
      setTimeout(() => {
        if (this.#phase === 'dropping') this.#settleOnPlate(null);
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
    this.#phase = 'intro';
    this.#emit('btt:change', {});
    this.#syncFormFields();
    this.#drawScene();
    this.#renderPanel();
    const api = this.#apiBase();
    if (api && !this.#apiBypass) {
      void enqueuePost(api, {
        action: 'contribution.remove',
        event: this.#eventId(),
        guestId: this.#guestId,
      }).catch(() => {});
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
    const dur = BalanceTheTable.#DROP_MS;
    const from = -90;
    let landed = false;
    this.#ensureAnimLoop();
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      d.fy = from * (1 - easeOutBounce(t));
      if (!landed && t > 0.36) {
        landed = true;
        d.landed = true;
        this.#vel += (d.side === 'swt' ? 1 : -1) * 1.6;
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
    const afterGap = Math.abs(this.#counted('swt') - this.#counted('sav'));
    if (afterGap < this.#gapBeforePick) {
      this.#burst(side);
      this.#emit('btt:gap-narrowed', {});
    }
    const live = this.#$('#live');
    if (live) {
      live.textContent = `Your dish joined the ${side === 'sav' ? 'savoury' : 'sweet'} side.`;
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
        (row) => row.landed !== false || (row.mine && !row.landed),
      );
      const idx = list.indexOf(d);
      const coords =
        idx >= 0
          ? dishWorldCoords(side, idx, this.#ang)
          : dishWorldCoords(side, 0, this.#ang);
      x = coords.x;
      y = coords.y;
    } else {
      const coords = dishWorldCoords(side, 0, this.#ang);
      x = coords.x;
      y = coords.y;
    }
    let lines = '';
    for (let i = 0; i < 8; i++) {
      const th = (i * Math.PI) / 4;
      lines += `<line x1="${Math.cos(th) * 52}" y1="${Math.sin(th) * 44}" x2="${Math.cos(th) * 64}" y2="${Math.sin(th) * 54}"/>`;
    }
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${x} ${y})`);
    g.innerHTML = `<g class="burst" style="transform-box:fill-box;transform-origin:center">${lines}</g>`;
    this.#$('#fx')?.appendChild(g);
    setTimeout(() => g.remove(), 900);
  }

  #updateSceneNow() {
    const mount = this.#$('#sceneMount');
    if (!mount?.querySelector('#plateRot')) return;
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
      minePopStart: this.#minePopStart,
    });
  }

  #drawScene() {
    const mount = this.#$('#sceneMount');
    if (!mount) return;
    const roughId = `rough-${this.#uid}`;
    const turbId = `turb-${this.#uid}`;
    if (!mount.querySelector('#plateRot')) {
      mount.innerHTML = buildPlateSceneShell({
        roughId,
        turbId,
        boilSeed: this.#boilSeed,
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
    const dis = disabled ? ' disabled' : '';
    return `<div class="choices choices-col">
        <button type="button" class="ink-btn" data-pick="sav"${dis}>SAVOURY</button>
        <button type="button" class="ink-btn" data-pick="swt"${dis}>SWEET</button>
      </div>`;
  }

  #renderPanel() {
    const p = this.#$('#panel');
    const actions = this.#$('#actions');
    const headline = this.#$('#headline');
    if (!p || !headline || !actions) return;

    const helpCopy = 'Add to the spread';
    const firstCopy = 'Add to the spread';
    const tableEmpty = !this.#dishes.sav.length && !this.#dishes.swt.length;
    const vegNote = `<p class="hint">It's vegetarian only please.</p>`;

    if (this.#phase === 'loading') {
      headline.textContent = helpCopy;
      p.innerHTML = `<div class="fade"><div class="label">Your move.</div>${vegNote}</div>`;
      actions.innerHTML = this.#pickActionsMarkup(true);
      return;
    }

    headline.textContent = tableEmpty && !this.#mine ? firstCopy : helpCopy;

    if (this.#phase === 'settled') {
      p.innerHTML = '';
      actions.innerHTML = '';
      return;
    }

    if (this.#loadError) {
      p.innerHTML = `<div class="fade"><div class="label">We couldn't load the table — try again.</div></div>`;
      actions.innerHTML = this.#pickActionsMarkup(true);
      return;
    }

    const emptyTable =
      !this.#dishes.sav.length && !this.#dishes.swt.length && !this.#mine;
    const sub =
      emptyTable && this.#attendingCount <= 1
        ? `<p class="hint">You're the first dish on the table.</p>`
        : '';

    if (this.#phase === 'intro' || this.#phase === 'dropping' || this.#phase === 'done') {
      p.innerHTML = `<div class="fade"><div class="label">Your move.</div>${vegNote}${sub}</div>`;
      actions.innerHTML = this.#pickActionsMarkup(this.#phase === 'dropping');
      return;
    }
  }

  #updateBalanceDescription() {
    const title = this.#$('#balDesc');
    if (!title) return;
    const s = this.#counted('sav');
    const w = this.#counted('swt');
    const { people, extra } = this.#buildPeople();
    const n = people.length + extra;
    title.textContent = `${n} ${n === 1 ? 'person is' : 'people are'} holding up the table: ${s} savoury and ${w} sweet dishes.`;
  }

  /** @param {string|null} name */
  #settleOnPlate(name) {
    const d = this.#mine;
    if (!d) return;
    d.name = name;
    d.icon = d.side === 'sav' ? 'pot' : 'slice';
    this.#manualIcon = false;
    d.pop = true;
    d.landed = true;
    this.#phase = 'settled';
    this.#minePopStart = performance.now();
    this.#drawScene();
    this.#renderPanel();

    const publicSide = toPublicSide(d.side);
    this.#writeSavedContribution({
      side: publicSide,
      dishName: d.name,
      icon: d.icon,
    });
    this.#syncFormFields();

    const api = this.#apiBase();
    if (api && !this.#apiBypass) {
      const trimmed = d.name ? String(d.name).trim().slice(0, 40) : null;
      void enqueuePost(api, {
        action: 'contribution',
        event: this.#eventId(),
        guestId: this.#guestId,
        side: publicSide,
        name: trimmed ?? '',
        icon: d.icon,
      })
        .then((data) => {
          this.dispatchEvent(
            new CustomEvent('btt:saved', { bubbles: true, composed: true, detail: data }),
          );
        })
        .catch(() => {});
    }

    const hold = this.#reduceMotion ? 420 : BalanceTheTable.#PLATE_HOLD_MS;
    setTimeout(() => {
      if (this.#phase !== 'settled' || this.#mine !== d) return;
      this.#phase = 'done';
      this.#drawScene();
      this.#emit('btt:complete', {
        side: publicSide,
        dishName: d.name,
        icon: d.icon,
        guestId: this.#guestId,
      });
    }, hold);

    setTimeout(() => {
      if (this.#mine === d) this.#drawScene();
    }, 2600);
  }

  #syncFormFields() {
    const form = this.closest('form');
    if (!form) return;
    const ensure = (name) => {
      let el = form.querySelector(`input[name="${name}"]`);
      if (!el) {
        el = document.createElement('input');
        el.type = 'hidden';
        el.name = name;
        form.appendChild(el);
      }
      return el;
    };
    const sideEl = ensure('btt_side');
    const dishEl = ensure('btt_dish');
    const iconEl = ensure('btt_icon');
    if (this.#mine && this.#phase === 'done') {
      sideEl.value = toPublicSide(this.#mine.side);
      dishEl.value = this.#mine.name ?? '';
      iconEl.value = this.#mine.icon;
    } else {
      sideEl.value = '';
      dishEl.value = '';
      iconEl.value = '';
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
        guestId: this.#guestId,
      };
    }
    const saved = this.#readSavedContribution();
    if (!saved) return null;
    return {
      side: /** @type {'savoury'|'sweet'} */ (saved.side),
      dishName: saved.dishName,
      icon: saved.icon,
      guestId: this.#guestId,
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
}

customElements.define('balance-the-table', BalanceTheTable);

export { BalanceTheTable };
