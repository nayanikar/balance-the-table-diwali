export const DEFAULT_API_URL = 'http://127.0.0.1:8787/exec';

/** @returns {string|null} null = no API */
export function resolveApiUrl() {
  const params = new URLSearchParams(location.search);
  if (params.has('api')) {
    const v = params.get('api');
    return v === '' ? null : v;
  }
  return DEFAULT_API_URL;
}

export function getEventId() {
  const el = document.getElementById('rsvp1');
  return el?.getAttribute('event-id') || 'diwali-2026';
}
