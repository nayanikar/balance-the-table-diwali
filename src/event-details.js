import { startConfirmationScene } from './confirmation-scene.js';
import { ICONS, iconFor, toSideCode } from './icons.js';
import { setStepNavState, stepNavHtml } from './step-nav.js';
import { resolveApiUrl } from './config.js';
import { getGuestId } from './guest.js';
import { ApiError } from './api.js';
import { enqueuePost } from './sync-queue.js';

const STYLE_URL = new URL('./event-details.css', import.meta.url).href;
const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Patrick+Hand&display=swap';

const CALENDAR_ICON = `<rect class="ln" x="4" y="7" width="22" height="19" rx="3"/><path class="ln thin" d="M4 13h22M10 4v5M20 4v5"/><circle cx="15" cy="19" r="2.4" fill="var(--sav)" stroke="var(--ink)" stroke-width="1.2"/>`;
const PIN_ICON = `<path class="ln" d="M15 27s9-8.5 9-15a9 9 0 0 0-18 0c0 6.5 9 15 9 15z"/><circle cx="15" cy="12" r="3" fill="var(--swt)" stroke="var(--ink)" stroke-width="1.4"/>`;
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
}

/** @param {string} t */
function compactTime(t) {
  return t.trim().replace(/\s*(AM|PM)$/i, (m) => m.replace(/\s/g, '').toUpperCase());
}

/** @param {string} raw e.g. "Saturday, November 7, 2026 · 3:30 PM" */
function formatWhenHtml(raw) {
  const parts = raw.split('·').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const head = parts[0];
    const comma = head.indexOf(',');
    const dayName = comma >= 0 ? head.slice(0, comma).trim() : head;
    const calendarDate = comma >= 0 ? head.slice(comma + 1).trim() : '';
    const timeLine = `${dayName} ${compactTime(parts[1])}`;
    return `<span class="when-line1">${esc(calendarDate)}</span><br><span class="when-line2">${esc(timeLine)}</span>`;
  }
  return esc(raw);
}

/** @param {string} address */
function formatAddressHtml(address) {
  const q = encodeURIComponent(address);
  const body = esc(address).replace(/,\s*/, ',<br>');
  return `<a class="map-link" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">${body}</a>`;
}

/** @param {'savoury'|'sweet'} side @param {string|null|undefined} dishName */
function bringingLabel(side, dishName) {
  if (dishName && String(dishName).trim()) return esc(String(dishName).trim());
  return side === 'savoury' ? 'Savoury' : 'Sweet';
}

/** @param {string} startsAt e.g. 2026-11-07T15:30:00 */
function formatWhenFromEvent(startsAt) {
  if (!startsAt) return '';
  const m = startsAt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return esc(startsAt);
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const dayName = days[d.getDay()];
  const head = `${dayName}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  let h = d.getHours();
  const mi = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const time = `${h}:${String(mi).padStart(2, '0')} ${ampm}`;
  return formatWhenHtml(`${head} · ${time}`);
}

class EventDetails extends HTMLElement {
  static observedAttributes = [
    'step-label',
    'event-date',
    'event-address',
    'allergies-note',
  ];

  /** @type {ReturnType<typeof startConfirmationScene>|null} */
  #scene = null;

  /** @type {{ side?: 'savoury'|'sweet'; dishName?: string|null; icon?: string; guestId?: string }} */
  #completion = {};

  /** @type {'idle'|'editing'|'done'} */
  #allergiesPhase = 'idle';

  /** @type {string} */
  #guestId = '';

  /** @type {boolean} */
  #readOnly = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.#render();
    this.#bindEvents();
    this.#startScene();
    setStepNavState(this.shadowRoot, { prev: true, next: false });
  }

  disconnectedCallback() {
    this.#scene?.stop();
    this.#scene = null;
  }

  /**
   * @param {{ side: 'savoury'|'sweet'; dishName?: string|null; icon?: string; guestId?: string }} detail
   */
  setCompletion(detail) {
    this.#completion = { ...this.#completion, ...detail };
    this.#syncBringingTile();
    const code = toSideCode(detail.side);
    this.#scene?.setMine(code, 0);
  }

  hydrateFromBoot({ event, me, guestId }) {
    if (guestId) this.#guestId = guestId;
    const whenEl = this.shadowRoot?.querySelector('[data-when]');
    const whereEl = this.shadowRoot?.querySelector('[data-where]');
    if (event?.startsAt && whenEl) whenEl.innerHTML = formatWhenFromEvent(event.startsAt);
    if (event?.address && whereEl) whereEl.innerHTML = formatAddressHtml(event.address);
    const sub = this.shadowRoot?.querySelector('[data-guest-sub]');
    if (sub && me?.displayName) sub.textContent = me.displayName;
    if (me?.side) {
      this.setCompletion({
        side: /** @type {'savoury'|'sweet'} */ (me.side),
        dishName: me.dishName,
        icon: me.icon,
      });
    }
    if (me?.allergies?.trim()) {
      this.#allergiesPhase = 'done';
      this.#writeSavedAllergies(me.allergies.trim());
      this.#syncAllergiesFormField(me.allergies.trim());
      this.#renderAllergiesDone();
    }
  }

  setReadOnly(readOnly) {
    this.#readOnly = readOnly;
    const changeBtn = this.shadowRoot?.querySelector('[data-action="change-rsvp"]');
    const copyBtn = this.shadowRoot?.querySelector('[data-action="copy-link"]');
    if (changeBtn instanceof HTMLElement) changeBtn.hidden = readOnly;
    if (readOnly && this.#allergiesPhase !== 'done') {
      const slot = this.shadowRoot?.querySelector('[data-allergies-slot]');
      if (slot) slot.innerHTML = '';
    }
    if (copyBtn instanceof HTMLElement) copyBtn.hidden = readOnly;
  }

  attributeChangedCallback(name, _old, value) {
    if (!this.shadowRoot?.querySelector('.rsvp-step')) return;
    if (name === 'step-label') {
      this.shadowRoot.querySelector('.step-label').textContent = value || '';
      return;
    }
    if (name === 'event-date') {
      const el = this.shadowRoot.querySelector('[data-when]');
      if (el) el.innerHTML = formatWhenHtml(value || '');
      return;
    }
    if (name === 'event-address') {
      const el = this.shadowRoot.querySelector('[data-where]');
      if (el) el.innerHTML = formatAddressHtml(value || '');
      return;
    }
    if (name === 'allergies-note' && this.#allergiesPhase === 'idle') {
      const el = this.shadowRoot.querySelector('[data-action="allergies-start"]');
      if (el) el.textContent = value?.trim() || 'Any allergies?';
    }
  }

  #eventId() {
    return this.getAttribute('event-id') || 'default';
  }

  #allergiesStorageKey() {
    return `btt:${this.#eventId()}:allergies`;
  }

  #readSavedAllergies() {
    try {
      return localStorage.getItem(this.#allergiesStorageKey()) || '';
    } catch {
      return '';
    }
  }

  /** @param {string} text */
  #writeSavedAllergies(text) {
    try {
      if (text) localStorage.setItem(this.#allergiesStorageKey(), text);
      else localStorage.removeItem(this.#allergiesStorageKey());
    } catch {
      /* ignore */
    }
  }

  /** @param {string} value */
  #syncAllergiesFormField(value) {
    const form = this.closest('form');
    if (!form) return;
    let el = form.querySelector('input[name="allergies_note"]');
    if (!el) {
      el = document.createElement('input');
      el.type = 'hidden';
      el.name = 'allergies_note';
      form.appendChild(el);
    }
    el.value = value;
  }

  #render() {
    const step = this.getAttribute('step-label') || 'RSVP · step 3 of 3';
    const date = this.getAttribute('event-date') || 'Saturday, November 7, 2026 · 3:30 PM';
    const address = this.getAttribute('event-address') || '433 Pacific Ave, Jersey City, NJ 07304';
    const allergiesLabel = this.getAttribute('allergies-note')?.trim() || 'Any allergies?';

    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="${STYLE_URL}">
      <link rel="stylesheet" href="${FONT_URL}">
      <main class="rsvp-step">
        ${stepNavHtml(esc(step))}
        <h1 class="step-title" tabindex="-1">See you there!</h1>
        <p class="guest-sub" data-guest-sub></p>
        <div class="step-body">
          <div class="step-scene">
            <svg data-scene viewBox="0 0 700 236" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Everyone celebrating around the finished potluck table"></svg>
          </div>
          <div class="step-content">
        <div class="place" role="list">
          <div class="tile" role="listitem">
            <svg viewBox="0 0 30 30" aria-hidden="true">${CALENDAR_ICON}</svg>
            <div class="lbl">When</div>
            <div class="val" data-when>${formatWhenHtml(date)}</div>
          </div>
          <div class="tile" role="listitem">
            <svg viewBox="0 0 30 30" aria-hidden="true">${PIN_ICON}</svg>
            <div class="lbl">Where</div>
            <div class="val" data-where>${formatAddressHtml(address)}</div>
          </div>
          <div class="tile" role="listitem">
            <svg class="tile-dish-icon" viewBox="0 0 40 40" aria-hidden="true" data-bringing-icon><g class="dish" style="--c:var(--sav)">${ICONS.pot}</g></svg>
            <div class="lbl">You're bringing</div>
            <div class="val" data-bringing>Savoury</div>
          </div>
        </div>
          </div>
          <div class="step-actions choices choices-col">
            <div class="allergies-slot" data-allergies-slot></div>
            <button type="button" class="ink-btn" data-action="copy-link">Copy my edit link</button>
            <button type="button" class="ink-btn" data-action="change-rsvp">Change my RSVP</button>
          </div>
        </div>
      </main>
    `;
    this.#syncBringingTile();
    this.#restoreAllergiesUi(allergiesLabel);
  }

  /** @param {string} label */
  #restoreAllergiesUi(label) {
    const saved = this.#readSavedAllergies();
    if (saved.trim()) {
      this.#allergiesPhase = 'done';
      this.#syncAllergiesFormField(saved.trim());
      this.#renderAllergiesDone();
      return;
    }
    this.#allergiesPhase = 'idle';
    this.#renderAllergiesButton(label);
  }

  /** @param {string} [label] */
  #renderAllergiesButton(label) {
    const slot = this.shadowRoot.querySelector('[data-allergies-slot]');
    if (!slot) return;
    const text = label ?? (this.getAttribute('allergies-note')?.trim() || 'Any allergies?');
    slot.innerHTML = `<button type="button" class="ink-btn" data-action="allergies-start">${esc(text)}</button>`;
  }

  #renderAllergiesInput() {
    const slot = this.shadowRoot.querySelector('[data-allergies-slot]');
    if (!slot) return;
    const saved = this.#readSavedAllergies();
    slot.innerHTML = `<input type="text" class="allergies-input" data-allergies-input placeholder="Your allergies…" maxlength="120" value="${esc(saved)}" autocomplete="off" aria-label="Food allergies">`;
    const input = slot.querySelector('[data-allergies-input]');
    if (input instanceof HTMLInputElement) {
      requestAnimationFrame(() => input.focus());
    }
  }

  #renderAllergiesDone() {
    const slot = this.shadowRoot.querySelector('[data-allergies-slot]');
    if (!slot) return;
    slot.innerHTML =
      '<button type="button" class="ink-btn allergies-done" data-action="allergies-edit">TAKEN CARE OF!</button>';
  }

  #openAllergiesInput() {
    this.#allergiesPhase = 'editing';
    this.#renderAllergiesInput();
  }

  #editAllergiesAgain() {
    this.#openAllergiesInput();
    const input = this.shadowRoot.querySelector('[data-allergies-input]');
    if (input instanceof HTMLInputElement) {
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  }

  async #copyEditLink() {
    const eventId = this.#eventId();
    const gid = this.#guestId || getGuestId(eventId);
    const url = new URL(location.href);
    url.searchParams.set('g', gid);
    const api = resolveApiUrl();
    if (api) url.searchParams.set('api', api);
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      /* ignore */
    }
  }

  /** @param {string} raw */
  async #finishAllergies(raw) {
    const text = raw.trim();
    if (!text) {
      this.#writeSavedAllergies('');
      this.#syncAllergiesFormField('');
      this.#allergiesPhase = 'idle';
      this.#renderAllergiesButton();
      return;
    }
    const api = resolveApiUrl();
    const eventId = this.#eventId();
    const guestId = this.#guestId || getGuestId(eventId);
    try {
      if (api) {
        await enqueuePost(api, {
          action: 'allergies',
          event: eventId,
          guestId,
          allergies: text,
        });
      }
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'closed' || err.code === 'past')) {
        this.dispatchEvent(
          new CustomEvent('btt:server-state', { bubbles: true, detail: { state: err.code } }),
        );
        return;
      }
      /* queued */
    }
    this.#allergiesPhase = 'done';
    this.#writeSavedAllergies(text);
    this.#syncAllergiesFormField(text);
    this.#renderAllergiesDone();
    this.#emit('details:allergies', { note: text });
  }

  #syncBringingTile() {
    const side = this.#completion.side ?? 'savoury';
    const code = toSideCode(side);
    const dishName = this.#completion.dishName ?? null;
    const iconKey =
      this.#completion.icon || iconFor(code, dishName, 0) || (code === 'sav' ? 'pot' : 'slice');
    const labelEl = this.shadowRoot.querySelector('[data-bringing]');
    const iconEl = this.shadowRoot.querySelector('[data-bringing-icon]');
    if (labelEl) labelEl.innerHTML = bringingLabel(side, dishName);
    if (iconEl) {
      iconEl.innerHTML = `<g class="dish" style="--c:var(--${code})">${ICONS[iconKey] || ICONS.pot}</g>`;
    }
    this.#scene?.setMine(code, 0);
  }

  #startScene() {
    const svg = this.shadowRoot.querySelector('[data-scene]');
    if (!(svg instanceof SVGSVGElement)) return;
    const side = this.#completion.side ? toSideCode(this.#completion.side) : 'sav';
    this.#scene = startConfirmationScene(svg, { side, slotIndex: 0 });
  }

  #bindEvents() {
    this.shadowRoot.addEventListener('click', (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      if (t.closest('[data-step-prev]:not(:disabled)')) {
        this.#emit('details:back', {});
        return;
      }
      if (t.closest('[data-action="allergies-start"]')) {
        this.#openAllergiesInput();
        return;
      }
      if (t.closest('[data-action="allergies-edit"]')) {
        this.#editAllergiesAgain();
        return;
      }
      if (t.closest('[data-action="copy-link"]')) {
        void this.#copyEditLink();
        return;
      }
      if (t.closest('[data-action="change-rsvp"]')) {
        this.#emit('details:change-rsvp', {});
      }
    });

    this.shadowRoot.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || !input.matches('[data-allergies-input]')) return;
      e.preventDefault();
      this.#finishAllergies(input.value);
    });

    this.shadowRoot.addEventListener('focusout', (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || !input.matches('[data-allergies-input]')) return;
      this.#finishAllergies(input.value);
    });
  }

  /** @param {string} type @param {object} detail */
  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
  }
}

customElements.define('event-details', EventDetails);

export { EventDetails };
