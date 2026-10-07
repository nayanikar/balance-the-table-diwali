import { postAction, ApiError } from './api.js';

const QUEUE_KEY = 'btt:postQueue';

/** @typedef {{ api: string; body: object; id: string }} QueueItem */

function readQueue() {
  try {
    return /** @type {QueueItem[]} */ (JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'));
  } catch {
    return [];
  }
}

function writeQueue(items) {
  try {
    if (!items.length) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

function emitStatus(detail) {
  document.dispatchEvent(new CustomEvent('sync:status', { detail }));
}

/**
 * @param {string} api
 * @param {object} body
 * @param {{ onSuccess?: (data: object) => void }} [opts]
 */
export async function enqueuePost(api, body, opts = {}) {
  if (!api) throw new ApiError('invalid', 'no api');
  emitStatus({ pending: true, queued: false });
  try {
    const data = await postAction(api, body);
    emitStatus({ pending: false, queued: false });
    opts.onSuccess?.(data);
    await flushQueue(api);
    return data;
  } catch (err) {
    if (err instanceof ApiError && (err.code === 'closed' || err.code === 'past' || err.code === 'full')) {
      emitStatus({ pending: false, queued: false });
      throw err;
    }
    const item = { api, body, id: crypto.randomUUID?.() || String(Date.now()) };
    const q = readQueue();
    q.push(item);
    writeQueue(q);
    emitStatus({ pending: true, queued: true, message: "Saving… we'll keep trying." });
    throw err;
  }
}

export async function flushQueue(api) {
  let q = readQueue().filter((item) => item.api === api);
  if (!q.length) {
    emitStatus({ pending: false, queued: false });
    return;
  }
  emitStatus({ pending: true, queued: true, message: "Saving… we'll keep trying." });
  const remaining = readQueue().filter((item) => item.api !== api);
  for (const item of q) {
    try {
      await postAction(api, item.body);
    } catch {
      remaining.push(item);
      writeQueue(remaining);
      emitStatus({ pending: true, queued: true, message: "Saving… we'll keep trying." });
      return;
    }
  }
  writeQueue(remaining);
  emitStatus({ pending: false, queued: false });
}

export function initSyncQueue(api) {
  if (!api) return;
  window.addEventListener('online', () => void flushQueue(api));
  void flushQueue(api);
}
