const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function storageKey(eventId) {
  return `guest:${eventId}:id`;
}

function legacyKey(eventId) {
  return `btt:${eventId}:guestId`;
}

function randomGuestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getGuestId(eventId) {
  try {
    let id = localStorage.getItem(storageKey(eventId));
    if (id && UUID_RE.test(id)) return id;
    const legacy = localStorage.getItem(legacyKey(eventId));
    if (legacy && UUID_RE.test(legacy)) {
      localStorage.setItem(storageKey(eventId), legacy);
      return legacy;
    }
    id = randomGuestId();
    localStorage.setItem(storageKey(eventId), id);
    return id;
  } catch {
    return randomGuestId();
  }
}

/** @returns {boolean} applied from URL */
export function applyGuestFromUrl(eventId) {
  const params = new URLSearchParams(location.search);
  const g = params.get('g');
  if (!g || !UUID_RE.test(g)) return false;
  try {
    localStorage.setItem(storageKey(eventId), g);
  } catch {
    /* ignore */
  }
  params.delete('g');
  const qs = params.toString();
  const url = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
  history.replaceState(null, '', url);
  return true;
}

export function resetGuestId(eventId) {
  const id = randomGuestId();
  try {
    localStorage.setItem(storageKey(eventId), id);
  } catch {
    /* ignore */
  }
  return id;
}

export { UUID_RE as isValidGuestIdPattern };
