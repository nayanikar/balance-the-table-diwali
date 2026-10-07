const RETRY_MS = 400;
const BUSY_RETRY_MS = 1500;

/**
 * @typedef {{ side: 'savoury'|'sweet'; name: string|null; icon: string }} ApiDish
 * @typedef {{ id: string; title: string; startsAt: string; timezone: string; address: string; hostName: string; state: string }} BootEvent
 * @typedef {{ status: string|null; displayName: string; side: string; dishName: string|null; icon: string; allergies: string }} BootMe
 * @typedef {{ event?: BootEvent; dishes: ApiDish[]; people: { attending: number }; me: BootMe|null; mine?: ApiDish|null; error?: string }} BootResponse
 */

export class ApiError extends Error {
  /** @param {string} code */
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

export async function postWithRetry(fn, { retryBusy = true } = {}) {
  try {
    const res = await fn();
    if (res.ok) {
      const data = await res.json();
      if (data?.ok === false && data.error === 'busy' && retryBusy) {
        await new Promise((r) => setTimeout(r, BUSY_RETRY_MS));
        const res2 = await fn();
        if (res2.ok) return res2.json();
      }
      return data;
    }
  } catch (err) {
    console.warn('[btt] request failed, retrying', err);
  }
  await new Promise((r) => setTimeout(r, RETRY_MS));
  try {
    const res = await fn();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[btt] request failed after retry', err);
    throw err;
  }
}

/**
 * @param {string} apiBase
 * @param {string} eventId
 * @param {string} guestId
 * @param {AbortSignal} [signal]
 * @returns {Promise<BootResponse>}
 */
export async function fetchBoot(apiBase, eventId, guestId, signal) {
  const url = new URL(apiBase);
  url.searchParams.set('event', eventId);
  if (guestId) url.searchParams.set('guestId', guestId);
  const seed = new URLSearchParams(location.search).get('_seed');
  if (seed) url.searchParams.set('_seed', seed);
  const res = await fetch(url.toString(), { signal, method: 'GET' });
  if (!res.ok) throw new Error(`GET ${res.status}`);
  return /** @type {BootResponse} */ (await res.json());
}

/**
 * @param {string} apiBase
 * @param {object} body
 */
export async function postAction(apiBase, body) {
  const data = await postWithRetry(() =>
    fetch(apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    }),
  );
  if (!data || data.ok === false) {
    throw new ApiError(data?.error || 'invalid', data?.error);
  }
  return data;
}

/** @deprecated use fetchBoot */
export async function getTable(apiBase, eventId, guestId, signal) {
  const boot = await fetchBoot(apiBase, eventId, guestId, signal);
  return {
    dishes: boot.dishes || [],
    mine: boot.mine ?? null,
  };
}

export async function upsertContribution(apiBase, payload) {
  return postAction(apiBase, {
    action: 'contribution',
    event: payload.event,
    guestId: payload.guestId,
    side: payload.side,
    name: payload.name ?? '',
    icon: payload.icon,
  });
}

export async function removeContribution(apiBase, eventId, guestId) {
  return postAction(apiBase, {
    action: 'contribution.remove',
    event: eventId,
    guestId,
  });
}

export async function postRsvp(apiBase, eventId, guestId, status, displayName) {
  return postAction(apiBase, {
    action: 'rsvp',
    event: eventId,
    guestId,
    status,
    displayName: displayName ?? '',
  });
}

export async function postAllergies(apiBase, eventId, guestId, allergies) {
  return postAction(apiBase, {
    action: 'allergies',
    event: eventId,
    guestId,
    allergies,
  });
}

/** Soft hint check (mock supports checkDisplayName query param). */
export async function checkDisplayNameTaken(apiBase, eventId, name) {
  if (!apiBase || !name?.trim()) return false;
  try {
    const url = new URL(apiBase);
    url.searchParams.set('event', eventId);
    url.searchParams.set('checkDisplayName', name.trim());
    const res = await fetch(url.toString());
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.exists);
  } catch {
    return false;
  }
}
