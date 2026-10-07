const PREFIX = 'btt:boot:';

export function readBootCache(eventId) {
  try {
    const raw = localStorage.getItem(PREFIX + eventId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @param {object} payload */
export function writeBootCache(eventId, payload) {
  try {
    localStorage.setItem(PREFIX + eventId, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}
