/**
 * In-memory API v2 store — parity with backend/Code.gs
 */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOW_SIDES = new Set(['savoury', 'sweet']);
const ALLOW_STATUS = new Set(['attending', 'declined', 'pending']);
const ALLOW_ICONS = new Set([
  'bowl', 'pot', 'dumpling', 'samosa', 'skewer', 'pizza', 'slice',
  'cookie', 'donut', 'pudding', 'icecream', 'cupcake', 'cloche',
]);

const RATE_EVENT_MAX = 60;
const RATE_GUEST_MAX = 20;
const RATE_WINDOW_MS = 60_000;

const DEFAULT_EVENT = {
  event_id: 'diwali-2026',
  title: 'Diwali Potluck',
  starts_at: '2026-11-07T15:30:00',
  timezone: 'America/New_York',
  address: '433 Pacific Ave, Jersey City, NJ 07304',
  host_name: 'Nayanika',
  rsvp_open: true,
  rsvp_deadline: '2026-11-05T23:59:00',
  max_guests: 40,
};

const HOST_SEED_DISHES = [
  { side: 'savoury', dish_name: 'Biryani', icon: 'bowl' },
  { side: 'savoury', dish_name: 'Momos', icon: 'dumpling' },
  { side: 'sweet', dish_name: 'Tiramisu', icon: 'slice' },
  { side: 'sweet', dish_name: 'Cookies', icon: 'cookie' },
  { side: 'sweet', dish_name: 'Rasmalai', icon: 'pudding' },
  { side: 'sweet', dish_name: '', icon: 'cloche' },
  { side: 'sweet', dish_name: 'Gulab jamun', icon: 'donut' },
  { side: 'sweet', dish_name: 'Brownies', icon: 'cookie' },
];

function isTrue(v) {
  if (v === true) return true;
  if (v === false || v == null || v === '') return false;
  const s = String(v).trim().toUpperCase();
  return s === 'TRUE' || s === 'YES' || s === '1';
}

function stripControls(s) {
  return String(s).replace(/[\x00-\x1f\x7f]/g, '');
}

function sanitizeShort(s, maxLen) {
  return stripControls(String(s ?? '').trim()).slice(0, maxLen);
}

function sanitizeIcon(icon) {
  const k = String(icon || 'cloche').trim();
  return ALLOW_ICONS.has(k) ? k : 'cloche';
}

function dishNameOrNull(v) {
  const s = sanitizeShort(v, 40);
  return s === '' ? null : s;
}

export function isValidGuestId(id) {
  return UUID_RE.test(String(id || ''));
}

/** Parse local wall time in IANA tz → UTC ms (approx via formatter). */
export function parseLocalDateTime(str, tz) {
  if (!str) return null;
  const s = String(str).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  const h = +m[4];
  const mi = +m[5];
  const sec = +m[6];
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, sec);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  for (let offsetMin = -840; offsetMin <= 840; offsetMin += 15) {
    const t = utcGuess - offsetMin * 60_000;
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(t)).map((p) => [p.type, p.value]),
    );
    const py = +parts.year;
    const pmo = +parts.month;
    const pd = +parts.day;
    let ph = +parts.hour;
    if (ph === 24) ph = 0;
    const pmi = +parts.minute;
    const psec = +parts.second;
    if (py === y && pmo === mo && pd === d && ph === h && pmi === mi && psec === sec) {
      return t;
    }
  }
  return utcGuess;
}

function blankGuestRow(eventId, guestId) {
  return {
    event_id: eventId,
    guest_id: guestId,
    status: '',
    display_name: '',
    side: '',
    dish_name: '',
    icon: '',
    allergies: '',
    is_host: false,
    created_at: '',
    updated_at: '',
    client: '',
  };
}

function rowToMe(r) {
  if (!r) return null;
  const side = String(r.side || '').toLowerCase();
  return {
    status: String(r.status || '').toLowerCase() || null,
    displayName: String(r.display_name || ''),
    side: ALLOW_SIDES.has(side) ? side : '',
    dishName: dishNameOrNull(r.dish_name),
    icon: sanitizeIcon(r.icon),
    allergies: sanitizeShort(r.allergies, 200),
  };
}

function meToMine(me) {
  if (!me || !me.side) return null;
  return { side: me.side, name: me.dishName, icon: me.icon };
}

export function createStore(options = {}) {
  /** @type {Map<string, object>} */
  const events = new Map();
  /** @type {object[]} */
  let guestRows = [];
  let postLock = Promise.resolve();
  /** @type {{ t: number, n: number }[]} */
  const rateEvent = [];
  /** @type {Map<string, { t: number, n: number }[]>} */
  const rateGuest = new Map();

  let stateOverride = null;
  let nowMs = () => Date.now();
  let failNext = false;

  events.set(DEFAULT_EVENT.event_id, { ...DEFAULT_EVENT });

  function reset() {
    events.clear();
    events.set(DEFAULT_EVENT.event_id, { ...DEFAULT_EVENT });
    guestRows = [];
    stateOverride = null;
    nowMs = () => Date.now();
    failNext = false;
    rateEvent.length = 0;
    rateGuest.clear();
  }

  function setEvent(eventId, patch) {
    const cur = events.get(eventId) || { ...DEFAULT_EVENT, event_id: eventId };
    events.set(eventId, { ...cur, ...patch, event_id: eventId });
  }

  function addHostSeeds(eventId) {
    const now = new Date().toISOString();
    for (const d of HOST_SEED_DISHES) {
      guestRows.push({
        ...blankGuestRow(eventId, 'host'),
        is_host: true,
        side: d.side,
        dish_name: d.dish_name,
        icon: d.icon,
        created_at: now,
        updated_at: now,
      });
    }
  }

  function applySeed(mode) {
    reset();
    const eid = DEFAULT_EVENT.event_id;
    if (mode === 'empty') return;
    if (mode === 'host-only') {
      addHostSeeds(eid);
      return;
    }
    if (mode === 'sweet-heavy') {
      addHostSeeds(eid);
      const now = new Date().toISOString();
      for (let i = 0; i < 2; i++) {
        guestRows.push({
          ...blankGuestRow(eid, `00000000-0000-4000-8000-${String(1000 + i).padStart(12, '0')}`),
          status: 'attending',
          display_name: `SavGuest${i}`,
          side: 'savoury',
          icon: 'pot',
          created_at: now,
          updated_at: now,
        });
      }
      for (let i = 0; i < 12; i++) {
        guestRows.push({
          ...blankGuestRow(eid, `00000000-0000-4000-9000-${String(2000 + i).padStart(12, '0')}`),
          status: 'attending',
          display_name: `SweetGuest${i}`,
          side: 'sweet',
          icon: 'slice',
          created_at: now,
          updated_at: now,
        });
      }
      return;
    }
    if (mode === 'crowd25') {
      const now = new Date().toISOString();
      for (let i = 0; i < 25; i++) {
        guestRows.push({
          ...blankGuestRow(eid, crypto.randomUUID()),
          status: 'attending',
          display_name: `Guest${i}`,
          side: i % 2 ? 'sweet' : 'savoury',
          icon: i % 2 ? 'slice' : 'pot',
          created_at: now,
          updated_at: now,
        });
      }
    }
  }

  function rowsForEvent(eventId) {
    return guestRows.filter((r) => r.event_id === eventId);
  }

  function countAttending(rows) {
    const seen = new Set();
    let n = 0;
    for (const r of rows) {
      if (isTrue(r.is_host)) continue;
      if (String(r.status || '').toLowerCase() !== 'attending') continue;
      const gid = String(r.guest_id);
      if (!seen.has(gid)) {
        seen.add(gid);
        n++;
      }
    }
    return n;
  }

  function isGuestAttending(rows, guestId) {
    if (!guestId) return false;
    return rows.some(
      (r) =>
        !isTrue(r.is_host) &&
        r.guest_id === guestId &&
        String(r.status || '').toLowerCase() === 'attending',
    );
  }

  function computeState(eventRow, rows, guestIdParam) {
    if (!eventRow) return 'closed';
    const tz = String(eventRow.timezone || 'America/New_York');
    const now = nowMs();
    const startsMs = parseLocalDateTime(eventRow.starts_at, tz);
    if (startsMs != null && now > startsMs + 24 * 60 * 60 * 1000) return 'past';
    if (!isTrue(eventRow.rsvp_open)) return 'closed';
    const deadlineMs = parseLocalDateTime(eventRow.rsvp_deadline, tz);
    if (deadlineMs != null && now > deadlineMs) return 'closed';
    const maxGuests = parseInt(eventRow.max_guests, 10);
    if (!Number.isNaN(maxGuests) && maxGuests > 0) {
      const attending = countAttending(rows);
      const already = isGuestAttending(rows, guestIdParam);
      if (attending >= maxGuests && !already) return 'full';
    }
    return 'open';
  }

  function buildDishes(rows) {
    const dishes = [];
    for (const r of rows) {
      const side = String(r.side || '').toLowerCase();
      if (!ALLOW_SIDES.has(side)) continue;
      const isHost = isTrue(r.is_host);
      const status = String(r.status || '').toLowerCase();
      if (isHost || status === 'attending') {
        dishes.push({
          side,
          name: dishNameOrNull(r.dish_name),
          icon: sanitizeIcon(r.icon),
        });
      }
    }
    return dishes;
  }

  function findGuestRow(eventId, guestId) {
    return guestRows.find((r) => r.event_id === eventId && r.guest_id === guestId && !isTrue(r.is_host));
  }

  function buildGet(eventId, guestIdParam, opts = {}) {
    const eventRow = events.get(eventId);
    if (!eventRow) {
      return {
        error: 'invalid',
        dishes: [],
        people: { attending: 0 },
        me: null,
        mine: null,
      };
    }
    const rows = rowsForEvent(eventId);
    let state = computeState(eventRow, rows, guestIdParam);
    if (opts.stateOverride) state = opts.stateOverride;
    const meRow = guestIdParam ? findGuestRow(eventId, guestIdParam) : null;
    const me = rowToMe(meRow);
    return {
      event: {
        id: String(eventRow.event_id),
        title: String(eventRow.title || ''),
        startsAt: String(eventRow.starts_at || ''),
        timezone: String(eventRow.timezone || 'America/New_York'),
        address: String(eventRow.address || ''),
        hostName: String(eventRow.host_name || ''),
        state,
      },
      dishes: buildDishes(rows),
      people: { attending: countAttending(rows) },
      me,
      mine: meToMine(me),
    };
  }

  function pruneRate(arr, now) {
    while (arr.length && now - arr[0].t > RATE_WINDOW_MS) arr.shift();
  }

  function checkRateLimit(eventId, guestId) {
    const now = nowMs();
    pruneRate(rateEvent, now);
    const total = rateEvent.reduce((s, x) => s + x.n, 0);
    if (total >= RATE_EVENT_MAX) return false;
    rateEvent.push({ t: now, n: 1 });

    let gArr = rateGuest.get(guestId);
    if (!gArr) {
      gArr = [];
      rateGuest.set(guestId, gArr);
    }
    pruneRate(gArr, now);
    const gTotal = gArr.reduce((s, x) => s + x.n, 0);
    if (gTotal >= RATE_GUEST_MAX) return false;
    gArr.push({ t: now, n: 1 });
    return true;
  }

  function normalizePostBody(body) {
    if (!body?.event || !body?.guestId) return null;
    const b = { ...body };
    if (!b.action) {
      if (b.remove) b.action = 'contribution.remove';
      else if (b.side) {
        b.action = 'contribution';
        if (b.name === undefined) b.name = '';
      }
    }
    return b;
  }

  function postSuccess(eventId, guestId) {
    const eventRow = events.get(eventId);
    const rows = rowsForEvent(eventId);
    const state = computeState(eventRow, rows, guestId);
    const me = rowToMe(findGuestRow(eventId, guestId));
    return { ok: true, state, me };
  }

  function handlePost(body) {
    const b = normalizePostBody(body);
    if (!b) return { ok: false, error: 'invalid' };
    const eventId = String(b.event);
    const guestId = String(b.guestId);
    if (!isValidGuestId(guestId)) return { ok: false, error: 'invalid' };

    const eventRow = events.get(eventId);
    if (!eventRow) return { ok: false, error: 'invalid' };

    const rows = rowsForEvent(eventId);
    const state = computeState(eventRow, rows, guestId);
    if (state === 'closed' || state === 'past') return { ok: false, error: 'closed' };
    if (b.action === 'rsvp' && b.status === 'attending') {
      if (state === 'full' && !isGuestAttending(rows, guestId)) return { ok: false, error: 'full' };
    }

    if (!checkRateLimit(eventId, guestId)) return { ok: false, error: 'busy' };

    let row = findGuestRow(eventId, guestId);
    const isNew = !row;
    if (!row) row = blankGuestRow(eventId, guestId);
    const now = new Date().toISOString();

    if (b.action === 'rsvp') {
      const status = String(b.status || '').toLowerCase();
      if (!ALLOW_STATUS.has(status) || status === 'pending') return { ok: false, error: 'invalid' };
      row.status = status;
      row.display_name = sanitizeShort(b.displayName, 40);
      if (status === 'declined') {
        row.side = '';
        row.dish_name = '';
        row.icon = '';
      }
    } else if (b.action === 'contribution') {
      const side = String(b.side || '').toLowerCase();
      if (!ALLOW_SIDES.has(side)) return { ok: false, error: 'invalid' };
      const curStatus = String(row.status || '').toLowerCase();
      if (curStatus !== 'attending') {
        if (isNew) {
          if (state === 'full') return { ok: false, error: 'full' };
          row.status = 'attending';
        } else {
          return { ok: false, error: 'not_attending' };
        }
      }
      row.side = side;
      row.dish_name = sanitizeShort(b.name, 40);
      row.icon = sanitizeIcon(b.icon);
    } else if (b.action === 'contribution.remove') {
      row.side = '';
      row.dish_name = '';
      row.icon = '';
    } else if (b.action === 'allergies') {
      row.allergies = sanitizeShort(b.allergies, 200);
    } else {
      return { ok: false, error: 'invalid' };
    }

    if (b.client) row.client = sanitizeShort(b.client, 80);
    if (!row.created_at) row.created_at = now;
    row.updated_at = now;

    if (isNew) guestRows.push(row);
    return postSuccess(eventId, guestId);
  }

  async function post(body) {
    if (failNext) {
      failNext = false;
      throw new Error('mock fail');
    }
    let result;
    const run = () => {
      result = handlePost(body);
    };
    postLock = postLock.then(run, run);
    await postLock;
    return result;
  }

  function get(query) {
    const eventId = query.event;
    if (!eventId) {
      return {
        error: 'invalid',
        dishes: [],
        people: { attending: 0 },
        me: null,
        mine: null,
      };
    }
    return buildGet(eventId, query.guestId || null, {
      stateOverride: query.stateOverride || stateOverride,
    });
  }

  /** @param {string} name @param {string} eventId */
  function findAttendingByDisplayName(name, eventId = DEFAULT_EVENT.event_id) {
    const n = sanitizeShort(name, 40).toLowerCase();
    if (!n) return false;
    return rowsForEvent(eventId).some(
      (r) =>
        !isTrue(r.is_host) &&
        String(r.status || '').toLowerCase() === 'attending' &&
        String(r.display_name || '').toLowerCase() === n,
    );
  }

  return {
    reset,
    applySeed,
    setEvent,
    get,
    post,
    buildGet,
    rowsForEvent,
    findAttendingByDisplayName,
    set debug(v) {
      if (v.stateOverride !== undefined) stateOverride = v.stateOverride;
      if (v.nowMs !== undefined) nowMs = () => v.nowMs;
      if (v.failNext !== undefined) failNext = v.failNext;
    },
    resetDebug() {
      stateOverride = null;
      nowMs = () => Date.now();
      failNext = false;
    },
    get debugState() {
      return { stateOverride, failNext };
    },
  };
}
