import { figure, kindFor } from './figures.js';
import {
  HERO_G,
  HERO_VIEW_H,
  HERO_VIEW_W,
  WIRE_PATH_D,
  buildBulbMarkup,
  sampleBulbs,
  wireYAt,
} from './rsvp-hero-lights.js';
import { setStepNavState, stepNavHtml } from './step-nav.js';
import { resolveApiUrl } from './config.js';
import { getGuestId } from './guest.js';
import { checkDisplayNameTaken } from './api.js';
import { enqueuePost } from './sync-queue.js';

const STYLE_URL = new URL('./rsvp-attendance.css', import.meta.url).href;
const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Patrick+Hand&display=swap';
/** @type {string|undefined} */
const INLINE_CSS = typeof RSVP_INLINE_CSS !== 'undefined' ? RSVP_INLINE_CSS : undefined;

let instanceCounter = 0;

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
}

/** @param {string} state @param {string} [hostName] */
function blockedMessage(state, hostName) {
  const host = hostName || 'the host';
  if (state === 'full') {
    return `The table's full this time — reach out to ${host} if you'd like to come.`;
  }
  if (state === 'past') {
    return 'This potluck has happened. Hope it was delicious.';
  }
  return `RSVPs are closed — ask ${host} if you still want to come.`;
}

const LEFT_X = 84;
const RIGHT_X = 252;

/** @param {boolean} reduceMotion @param {number} t */
function buildHeroFigures(reduceMotion, t) {
  const animT = reduceMotion ? 0 : t;
  const leftPlate = wireYAt(LEFT_X) + 2;
  const rightPlate = wireYAt(RIGHT_X) + 1;
  return (
    figure({
      x: LEFT_X,
      ground: HERO_G,
      plate: leftPlate,
      dir: 1,
      kind: kindFor('rsvp-hero-left'),
      host: true,
      t: animT,
    })
    + figure({
      x: RIGHT_X,
      ground: HERO_G,
      plate: rightPlate,
      dir: -1,
      kind: 'sparkler',
      t: animT,
    })
  );
}

/** @param {string} roughId @param {string} turbId @param {boolean} reduceMotion @param {number} t */
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

class RsvpAttendance extends HTMLElement {
  static observedAttributes = ['event-id', 'step-label'];

  /** @type {'intro'|'name'|'declined'|'attending'|'blocked'} */
  #phase = 'intro';

  /** @type {string} */
  #guestId = '';

  /** @type {string} */
  #blockedCopy = '';

  /** @type {string} */
  #eventTitle = 'Celebrate Diwali with us!';

  /** @type {string} */
  #storedMeName = '';

  /** @type {boolean} */
  #changeRsvpMode = false;

  /** @type {boolean} */
  #nameHint = false;

  /** @type {'attending'|'declined'} */
  #namePendingStatus = 'attending';

  /** @type {string} */
  #uid = '';

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
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.#reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.#renderShell();
    this.#bindEvents();
    this.#phase = 'intro';
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
    if (this.#phase === 'intro' || this.#phase === 'name') return null;
    return this.#phase === 'declined' ? 'declined' : 'attending';
  }

  getGuestName() {
    return this.#storedMeName || this.#readGuestName();
  }

  applyBoot({ event, me, state, guestId }) {
    if (guestId) this.#guestId = guestId;
    if (event?.title) this.#eventTitle = event.title;
    const titleEl = this.shadowRoot?.querySelector('.step-title');
    if (titleEl) titleEl.textContent = this.#eventTitle;
    this.#storedMeName = me?.displayName || '';
    this.#changeRsvpMode = false;

    if (!me && state !== 'open') {
      this.#phase = 'blocked';
      this.#blockedCopy = blockedMessage(state, event?.hostName);
    } else if (!me) {
      this.#phase = 'intro';
    } else if (me.status === 'declined') {
      this.#phase = 'declined';
    } else if (me.status === 'attending') {
      this.#phase = 'attending';
    } else {
      this.#phase = 'intro';
    }
    this.#syncFormFields();
    this.#renderPanel();
    this.#syncStepNav();
  }

  applyServerState(state) {
    if (state === 'open') return;
    this.#phase = 'blocked';
    this.#blockedCopy = blockedMessage(state, '');
    this.#renderPanel();
    this.#syncStepNav();
  }

  beginChangeRsvp() {
    this.#changeRsvpMode = true;
    this.#namePendingStatus = 'attending';
    this.#phase = 'intro';
    this.#renderPanel();
    this.#syncStepNav();
  }

  refreshPanel() {
    this.#renderPanel();
    this.#syncStepNav();
  }

  /** Return to the RSVP question (e.g. from step 2 back). */
  resetToIntro() {
    this.beginChangeRsvp();
    this.#emit('rsvp:change-rsvp', {});
  }

  attributeChangedCallback(name, _old, value) {
    if (!this.shadowRoot?.querySelector('.rsvp-step')) return;
    if (name === 'step-label') {
      const el = this.shadowRoot.querySelector('.step-label');
      if (el) el.textContent = value || '';
    }
  }

  #syncStepNav() {
    const status = this.getStatus();
    const nav = this.shadowRoot.querySelector('.step-nav');
    if (nav instanceof HTMLElement) nav.hidden = this.#phase === 'declined';
    setStepNavState(this.shadowRoot, {
      prev: this.#phase === 'name' || (status !== null && this.#phase !== 'declined'),
      next: status === 'attending',
    });
  }

  #eventId() {
    return this.getAttribute('event-id') || 'default';
  }

  #storageKey() {
    return `rsvp:${this.#eventId()}:status`;
  }

  #guestNameStorageKey() {
    return `rsvp:${this.#eventId()}:guestName`;
  }

  #readGuestName() {
    try {
      return localStorage.getItem(this.#guestNameStorageKey())?.trim() || '';
    } catch {
      return '';
    }
  }

  /** @param {string} name */
  #writeGuestName(name) {
    try {
      if (name) localStorage.setItem(this.#guestNameStorageKey(), name);
      else localStorage.removeItem(this.#guestNameStorageKey());
    } catch {
      /* ignore */
    }
  }

  /** @returns {'attending'|'declined'|null} */
  #readStatus() {
    try {
      const v = localStorage.getItem(this.#storageKey());
      if (v === 'attending' || v === 'declined') return v;
    } catch {
      /* ignore */
    }
    return null;
  }

  /** @param {'attending'|'declined'} status */
  #writeStatus(status) {
    try {
      localStorage.setItem(this.#storageKey(), status);
    } catch {
      /* ignore */
    }
  }

  #renderShell() {
    const step = this.getAttribute('step-label') || 'RSVP · step 1 of 3';
    const roughId = `rough-${this.#uid}`;
    const turbId = `turb-${this.#uid}`;
    const styleBlock = INLINE_CSS
      ? `<style>${INLINE_CSS}</style>`
      : `<link rel="stylesheet" href="${STYLE_URL}">`;

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
        this.#boilSeed = (this.#boilSeed % 4) + 1;
        this.shadowRoot.querySelector(`#turb-${this.#uid}`)?.setAttribute('seed', String(this.#boilSeed));
      }
    }, 160);
  }

  #startHeroAnim() {
    if (this.#reduceMotion) return;
    const tick = (now) => {
      const el = this.shadowRoot.querySelector('#heroFigures');
      if (el) el.innerHTML = buildHeroFigures(false, now / 1000);
      this.#heroRaf = requestAnimationFrame(tick);
    };
    this.#heroRaf = requestAnimationFrame(tick);
  }

  #bindEvents() {
    this.shadowRoot.addEventListener('click', (e) => {
      if (e.target.closest('[data-not-you]')) {
        this.#emit('rsvp:not-you', {});
        return;
      }
      if (e.target.closest('[data-change-rsvp]')) {
        this.beginChangeRsvp();
        return;
      }
      if (e.target.closest('[data-step-prev]:not(:disabled)')) {
        if (this.#phase === 'name') this.resetToIntro();
        else this.resetToIntro();
        return;
      }
      if (e.target.closest('[data-step-next]:not(:disabled)')) {
        this.#emit('rsvp:step-next', {});
        return;
      }
      const btn = e.target.closest('[data-status]');
      if (!btn || this.#phase !== 'intro') return;
      const status = btn.dataset.status;
      if (status === 'attending') this.#pickAttending();
      else if (status === 'declined') this.#pickDeclined();
    });

    this.shadowRoot.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || !input.matches('[data-guest-name-input]')) return;
      e.preventDefault();
      this.#finishGuestName(input.value);
    });

    this.shadowRoot.addEventListener('focusout', (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || !input.matches('[data-guest-name-input]')) return;
      void this.#checkNameHint(input.value);
      this.#finishGuestName(input.value);
    });

    this.shadowRoot.addEventListener('input', (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || !input.matches('[data-guest-name-input]')) return;
      if (this.#nameHint) {
        this.#nameHint = false;
        this.#renderPanel();
      }
    });
  }

  #pickAttending() {
    this.#namePendingStatus = 'attending';
    this.#phase = 'name';
    this.#renderPanel();
    this.#syncStepNav();
    const live = this.shadowRoot.querySelector('#live');
    if (live) live.textContent = 'What should we call you?';
  }

  #pickDeclined() {
    this.#namePendingStatus = 'declined';
    this.#phase = 'name';
    this.#renderPanel();
    this.#syncStepNav();
    const live = this.shadowRoot.querySelector('#live');
    if (live) live.textContent = 'What should we call you?';
  }

  /** @param {string} raw */
  async #finishGuestName(raw) {
    if (this.#phase !== 'name') return;
    const name = raw.trim().slice(0, 40);
    if (!name) return;

    const status = this.#namePendingStatus;
    const api = resolveApiUrl();
    const eventId = this.#eventId();
    if (!this.#guestId) this.#guestId = getGuestId(eventId);
    try {
      const data = api
        ? await enqueuePost(api, {
            action: 'rsvp',
            event: eventId,
            guestId: this.#guestId,
            status,
            displayName: name,
          })
        : { ok: true };
      if (!data?.ok && api) return;
      this.#storedMeName = name;
      this.#writeGuestName(name);
      this.#phase = status;
      this.#syncFormFields();
      this.#syncStepNav();
      this.#renderPanel();
      if (status === 'attending') {
        this.#emit('rsvp:status', { status: 'attending', guestName: name });
        this.#emit('rsvp:committed', { data, status: 'attending', guestName: name });
        const live = this.shadowRoot.querySelector('#live');
        if (live) live.textContent = `Thanks, ${name} — we cannot wait to see you!`;
      } else {
        this.#emit('rsvp:status', { status: 'declined', guestName: name });
        this.#emit('rsvp:committed', { data, status: 'declined', guestName: name });
        const live = this.shadowRoot.querySelector('#live');
        if (live) live.textContent = "We'll miss you this time!";
      }
    } catch {
      /* queued */
    }
  }

  async #checkNameHint(name) {
    if (this.#namePendingStatus !== 'attending') {
      this.#nameHint = false;
      return;
    }
    const api = resolveApiUrl();
    if (!api || !name.trim()) {
      this.#nameHint = false;
      return;
    }
    this.#nameHint = await checkDisplayNameTaken(api, this.#eventId(), name);
    this.#renderPanel();
  }

  #renderPanel() {
    const panel = this.shadowRoot.querySelector('#panel');
    const actions = this.shadowRoot.querySelector('#actions');
    if (!panel || !actions) return;

    if (this.#phase === 'blocked') {
      panel.innerHTML = `<div class="fade done"><h2 class="step-title">${esc(this.#blockedCopy)}</h2></div>`;
      actions.innerHTML = '';
      actions.hidden = true;
      return;
    }

    if (this.#phase === 'intro') {
      const prefill = esc(this.#changeRsvpMode ? this.#storedMeName : '');
      const notYou =
        this.#storedMeName && !this.#changeRsvpMode
          ? `<p class="hint"><button type="button" class="link-btn" data-not-you>Not ${esc(this.#storedMeName)}? RSVP as someone else</button></p>`
          : '';
      panel.innerHTML = `<div class="fade"><div class="label">Let us know.</div>${notYou}</div>`;
      actions.innerHTML = `<div class="choices choices-col">
          <button type="button" class="ink-btn" data-status="attending">Joyfully, yes!</button>
          <button type="button" class="ink-btn" data-status="declined">Can't make it</button>
        </div>`;
      actions.hidden = false;
      if (this.#changeRsvpMode && prefill) {
        /* name collected on yes */
      }
      return;
    }

    if (this.#phase === 'name') {
      const saved = esc(this.#readGuestName() || this.#storedMeName);
      const hint = this.#nameHint
        ? `<p class="hint">Already RSVP'd? Use the edit link from your confirmation.</p>`
        : '';
      panel.innerHTML = `<div class="fade"><div class="label">What should we call you?</div>${hint}</div>`;
      actions.innerHTML = `<input type="text" class="name-input" data-guest-name-input placeholder="Your name" maxlength="40" value="${saved}" autocomplete="name" aria-label="Your name">`;
      actions.hidden = false;
      const input = actions.querySelector('[data-guest-name-input]');
      if (input instanceof HTMLInputElement) {
        requestAnimationFrame(() => input.focus());
      }
      return;
    }

    if (this.#phase === 'declined') {
      panel.innerHTML = `<div class="fade done">
        <h2 class="step-title">We'll miss you this time!</h2>
      </div>`;
      actions.innerHTML = `<button type="button" class="ink-btn" data-change-rsvp>Change my RSVP</button>`;
      actions.hidden = false;
      return;
    }

    if (this.#phase === 'attending') {
      panel.innerHTML = `<div class="fade done">
        <h2 class="step-title">You're on the list!</h2>
        <p>We can't wait to celebrate with you.</p>
      </div>`;
      actions.innerHTML = `<button type="button" class="ink-btn" data-change-rsvp>Change my RSVP</button>`;
      actions.hidden = false;
    }
  }

  #syncFormFields() {
    const form = this.closest('form');
    if (!form) return;
    let el = form.querySelector('input[name="rsvp_status"]');
    if (!el) {
      el = document.createElement('input');
      el.type = 'hidden';
      el.name = 'rsvp_status';
      form.appendChild(el);
    }
    let nameEl = form.querySelector('input[name="rsvp_guest_name"]');
    if (!nameEl) {
      nameEl = document.createElement('input');
      nameEl.type = 'hidden';
      nameEl.name = 'rsvp_guest_name';
      form.appendChild(nameEl);
    }
    if (this.#phase === 'intro' || this.#phase === 'name') {
      el.value = '';
      nameEl.value = this.#phase === 'name' ? this.#readGuestName() : '';
    } else if (this.#phase === 'declined') {
      el.value = 'declined';
      nameEl.value = '';
    } else {
      el.value = 'attending';
      nameEl.value = this.#readGuestName();
    }
  }

  /** @param {string} type @param {object} detail */
  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
  }
}

customElements.define('rsvp-attendance', RsvpAttendance);

export { RsvpAttendance };
