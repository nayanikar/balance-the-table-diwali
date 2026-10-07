import { resolveApiUrl, getEventId } from './config.js';
import { applyGuestFromUrl, getGuestId, resetGuestId } from './guest.js';
import { readBootCache, writeBootCache } from './boot-cache.js';
import { fetchBoot, ApiError } from './api.js';
import { initSyncQueue, flushQueue } from './sync-queue.js';

/** @typedef {import('./api.js').BootResponse} BootPayload */

/**
 * @param {object} ctx
 * @param {BootPayload|null} payload
 */
function applyBootToApp(ctx, payload) {
  if (!payload || payload.error === 'invalid') return;
  const state = payload.event?.state ?? 'open';
  const readOnly = state !== 'open';

  ctx.rsvp1.applyBoot?.({
    event: payload.event,
    me: payload.me,
    state,
    guestId: ctx.guestId,
  });
  ctx.btt.setAttribute('guest-id', ctx.guestId);
  if (ctx.api) ctx.btt.setAttribute('api', ctx.api);
  ctx.btt.hydrateFromBoot?.({
    dishes: payload.dishes || [],
    people: payload.people || { attending: 0 },
    me: payload.me,
    event: payload.event,
    loadError: false,
  });
  ctx.details3.hydrateFromBoot?.({
    event: payload.event,
    me: payload.me,
    state,
    guestId: ctx.guestId,
  });
  ctx.details3.setReadOnly?.(readOnly);
  ctx.lastBoot = payload;
}

/** @param {object} ctx @param {BootPayload|null} payload */
function routeInitialStep(ctx, payload) {
  if (!payload || payload.error === 'invalid') {
    ctx.setStep(1);
    return;
  }
  const me = payload.me;
  const state = payload.event?.state ?? 'open';

  if (!me) {
    if (state === 'open') ctx.setStep(1);
    else ctx.setStep(1);
    return;
  }
  if (me.status === 'declined') {
    ctx.setStep(1);
    return;
  }
  if (me.status === 'attending') {
    if (me.side) ctx.setStep(3);
    else if (state === 'open') ctx.setStep(2);
    else ctx.setStep(3);
    return;
  }
  ctx.setStep(1);
}

function showLoadBanner(show) {
  let el = document.getElementById('btt-load-banner');
  if (!show) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('p');
    el.id = 'btt-load-banner';
    el.setAttribute('role', 'alert');
    el.style.cssText =
      'text-align:center;color:#fff8eb;font-family:Patrick Hand,sans-serif;margin:8px auto;max-width:560px;';
    document.getElementById('rsvp')?.prepend(el);
  }
  el.textContent = "We couldn't load the table — try again.";
}

/**
 * @param {object} options
 * @param {HTMLElement} options.stage
 * @param {import('./rsvp-attendance.js').RsvpAttendance} options.rsvp1
 * @param {import('./balance-the-table.js').BalanceTheTable} options.btt
 * @param {import('./event-details.js').EventDetails} options.details3
 * @param {(n: number) => void} options.setStep
 * @param {object} options.fw
 */
export async function startBoot(options) {
  const eventId = getEventId();
  const api = resolveApiUrl();
  applyGuestFromUrl(eventId);
  const guestId = getGuestId(eventId);

  const ctx = {
    ...options,
    api,
    eventId,
    guestId,
    lastBoot: /** @type {BootPayload|null} */ (null),
  };

  if (api) initSyncQueue(api);

  const cached = readBootCache(eventId);
  if (cached) {
    applyBootToApp(ctx, cached);
    routeInitialStep(ctx, cached);
  }

  if (!api) {
    window.__bttBoot = ctx;
    return ctx;
  }

  try {
    await flushQueue(api);
    const fresh = await fetchBoot(api, eventId, guestId);
    writeBootCache(eventId, fresh);
    applyBootToApp(ctx, fresh);
    routeInitialStep(ctx, fresh);
    showLoadBanner(false);
    ctx.btt.dispatchEvent(new CustomEvent('btt:loaded', {
      bubbles: true,
      composed: true,
      detail: { complete: Boolean(fresh.me?.side) },
    }));
  } catch (err) {
    console.error('[btt] boot GET failed', api, err);
    showLoadBanner(!cached);
    ctx.btt.hydrateFromBoot?.({
      dishes: cached?.dishes || [],
      people: cached?.people || { attending: 0 },
      me: cached?.me ?? null,
      event: cached?.event,
      loadError: !cached,
    });
  }

  window.__bttBoot = ctx;
  return ctx;
}

/** @param {object} ctx @param {BootPayload} payload */
export function mergeBootResponse(ctx, payload) {
  writeBootCache(ctx.eventId, payload);
  applyBootToApp(ctx, payload);
  ctx.lastBoot = payload;
}

export async function refreshBoot(ctx) {
  if (!ctx.api) return ctx.lastBoot;
  const fresh = await fetchBoot(ctx.api, ctx.eventId, ctx.guestId);
  mergeBootResponse(ctx, fresh);
  return fresh;
}

export function handlePostResult(ctx, data) {
  if (data?.state === 'closed' || data?.state === 'past') {
    const merged = {
      ...(ctx.lastBoot || {}),
      event: { ...(ctx.lastBoot?.event || {}), state: data.state },
      me: data.me ?? ctx.lastBoot?.me,
    };
    mergeBootResponse(ctx, /** @type {BootPayload} */ (merged));
    ctx.rsvp1.applyServerState?.(data.state);
    ctx.details3.setReadOnly?.(true);
    return;
  }
  if (!data?.ok) return;
  const merged = {
    ...(ctx.lastBoot || {}),
    event: { ...(ctx.lastBoot?.event || {}), state: data.state },
    me: data.me,
  };
  mergeBootResponse(ctx, /** @type {BootPayload} */ (merged));
}

export function rsvpAsSomeoneElse(ctx) {
  ctx.guestId = resetGuestId(ctx.eventId);
  ctx.btt.setAttribute('guest-id', ctx.guestId);
  return refreshBoot(ctx);
}

export { ApiError };
