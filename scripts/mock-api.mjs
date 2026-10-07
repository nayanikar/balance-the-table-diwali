import http from 'node:http';
import { URL } from 'node:url';
import { createStore } from './lib/api-v2-store.mjs';

const PORT = Number(process.env.BTT_MOCK_PORT || 8787);
const store = createStore();

let lastSeed = null;

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function applyQueryDebug(url) {
  const seed = url.searchParams.get('_seed');
  if (seed) {
    store.applySeed(seed);
    lastSeed = seed;
  } else if (lastSeed !== 'default') {
    store.reset();
    lastSeed = 'default';
  }

  const patch = {};
  const state = url.searchParams.get('_state');
  if (state) patch.stateOverride = state;
  const now = url.searchParams.get('_now');
  if (now) patch.nowMs = parseInt(now, 10);
  if (url.searchParams.get('_fail') === '1') patch.failNext = true;
  if (Object.keys(patch).length) store.debug = patch;
}

function latency(url) {
  const ms = parseInt(url.searchParams.get('_latency') || '0', 10);
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const wait = latency(url);

  const run = async () => {
    if (wait) await new Promise((r) => setTimeout(r, wait));

    try {
      applyQueryDebug(url);

      if (req.method === 'GET') {
        const event = url.searchParams.get('event');
        const checkName = url.searchParams.get('checkDisplayName');
        if (checkName && event) {
          json(res, 200, {
            exists: store.findAttendingByDisplayName(checkName, event),
          });
          return;
        }
        const guestId = url.searchParams.get('guestId');
        const payload = store.get({
          event,
          guestId,
          stateOverride: url.searchParams.get('_state'),
        });
        json(res, 200, payload);
        return;
      }

      if (req.method === 'POST') {
        const raw = await readBody(req);
        const body = JSON.parse(raw || '{}');
        const out = await store.post(body);
        json(res, 200, out);
        return;
      }

      json(res, 405, { ok: false, error: 'invalid' });
    } catch (e) {
      console.error(e);
      json(res, 500, { ok: false, error: 'invalid' });
    }
  };

  void run();
});

server.listen(PORT, '127.0.0.1', () => {
  store.reset();
  lastSeed = 'default';
  console.log(`BTT mock API v2 http://127.0.0.1:${PORT}/exec`);
  console.log(`Try: ?event=diwali-2026&_seed=empty|host-only|sweet-heavy|crowd25`);
});

export { store };
