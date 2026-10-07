/**
 * Balance the Table — Google Apps Script web app (API v2)
 * Sheet tabs: events, guests, summary (summary is host-only, not read here)
 */

var LOCK_MS = 8000;
var RATE_EVENT_MAX = 60;
var RATE_GUEST_MAX = 20;
var RATE_TTL = 60;

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

var ALLOW_SIDES = { savoury: true, sweet: true };
var ALLOW_STATUS = { attending: true, declined: true, pending: true };
var ALLOW_ICONS = {
  bowl: true,
  pot: true,
  dumpling: true,
  samosa: true,
  skewer: true,
  pizza: true,
  slice: true,
  cookie: true,
  donut: true,
  pudding: true,
  icecream: true,
  cupcake: true,
  cloche: true,
};

/** @enum {number} */
var E = {
  event_id: 0,
  title: 1,
  starts_at: 2,
  timezone: 3,
  address: 4,
  host_name: 5,
  rsvp_open: 6,
  rsvp_deadline: 7,
  max_guests: 8,
};

/** @enum {number} */
var G = {
  event_id: 0,
  guest_id: 1,
  status: 2,
  display_name: 3,
  side: 4,
  dish_name: 5,
  icon: 6,
  allergies: 7,
  is_host: 8,
  created_at: 9,
  updated_at: 10,
  client: 11,
};

var GUEST_COLS = 12;

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function eventsSheet_() {
  return SpreadsheetApp.getActive().getSheetByName('events');
}

function guestsSheet_() {
  return SpreadsheetApp.getActive().getSheetByName('guests');
}

function isTrue_(v) {
  if (v === true) return true;
  if (v === false || v == null || v === '') return false;
  var s = String(v).trim().toUpperCase();
  return s === 'TRUE' || s === 'YES' || s === '1';
}

function stripControls_(s) {
  return String(s).replace(/[\x00-\x1f\x7f]/g, '');
}

function sanitizeShort_(s, maxLen) {
  return stripControls_(String(s || '').trim()).slice(0, maxLen);
}

function sanitizeIcon_(icon) {
  var k = String(icon || 'cloche').trim();
  return ALLOW_ICONS[k] ? k : 'cloche';
}

function dishNameOrNull_(v) {
  var s = sanitizeShort_(v, 40);
  return s === '' ? null : s;
}

function isValidGuestId_(id) {
  return UUID_RE.test(String(id || ''));
}

function parseLocalDateTime_(str, tz) {
  if (!str) return null;
  var s = String(str).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  try {
    var dateStr = m[1] + '/' + m[2] + '/' + m[3] + ' ' + m[4] + ':' + m[5] + ':' + m[6];
    return Utilities.parseDate(dateStr, tz || 'America/New_York', 'yyyy/MM/dd HH:mm:ss').getTime();
  } catch (err) {
    return null;
  }
}

function loadEventRow_(eventId) {
  var sh = eventsSheet_();
  if (!sh) return null;
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return null;
  for (var i = 1; i < data.length; i++) {
    if (data[i][E.event_id] === eventId) return data[i];
  }
  return null;
}

function loadGuestRowsForEvent_(eventId) {
  var sh = guestsSheet_();
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var out = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][G.event_id] === eventId) out.push(data[i]);
  }
  return out;
}

function findGuestRowSheetIndex_(eventId, guestId) {
  var sh = guestsSheet_();
  if (!sh) return -1;
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][G.event_id] === eventId && data[i][G.guest_id] === guestId) return i + 1;
  }
  return -1;
}

function countAttending_(guestRows) {
  var seen = {};
  var n = 0;
  guestRows.forEach(function (r) {
    if (isTrue_(r[G.is_host])) return;
    if (String(r[G.status] || '').toLowerCase() !== 'attending') return;
    var gid = String(r[G.guest_id]);
    if (!seen[gid]) {
      seen[gid] = true;
      n++;
    }
  });
  return n;
}

function isGuestAttending_(guestRows, guestId) {
  if (!guestId) return false;
  for (var i = 0; i < guestRows.length; i++) {
    var r = guestRows[i];
    if (isTrue_(r[G.is_host])) continue;
    if (r[G.guest_id] === guestId && String(r[G.status] || '').toLowerCase() === 'attending') {
      return true;
    }
  }
  return false;
}

function computeState_(eventRow, guestRows, guestIdParam) {
  if (!eventRow) return 'closed';
  var tz = String(eventRow[E.timezone] || 'America/New_York');
  var nowMs = new Date().getTime();
  var startsMs = parseLocalDateTime_(eventRow[E.starts_at], tz);
  if (startsMs != null && nowMs > startsMs + 24 * 60 * 60 * 1000) return 'past';

  if (!isTrue_(eventRow[E.rsvp_open])) return 'closed';

  var deadlineMs = parseLocalDateTime_(eventRow[E.rsvp_deadline], tz);
  if (deadlineMs != null && nowMs > deadlineMs) return 'closed';

  var maxGuests = parseInt(eventRow[E.max_guests], 10);
  if (!isNaN(maxGuests) && maxGuests > 0) {
    var attending = countAttending_(guestRows);
    var already = isGuestAttending_(guestRows, guestIdParam);
    if (attending >= maxGuests && !already) return 'full';
  }
  return 'open';
}

function eventToApi_(eventRow, state) {
  return {
    id: String(eventRow[E.event_id]),
    title: String(eventRow[E.title] || ''),
    startsAt: String(eventRow[E.starts_at] || ''),
    timezone: String(eventRow[E.timezone] || 'America/New_York'),
    address: String(eventRow[E.address] || ''),
    hostName: String(eventRow[E.host_name] || ''),
    state: state,
  };
}

function buildDishes_(guestRows) {
  var dishes = [];
  guestRows.forEach(function (r) {
    var side = String(r[G.side] || '').toLowerCase();
    if (!ALLOW_SIDES[side]) return;
    var isHost = isTrue_(r[G.is_host]);
    var status = String(r[G.status] || '').toLowerCase();
    if (isHost || status === 'attending') {
      dishes.push({
        side: side,
        name: dishNameOrNull_(r[G.dish_name]),
        icon: sanitizeIcon_(r[G.icon]),
      });
    }
  });
  return dishes;
}

function rowToMe_(r) {
  if (!r) return null;
  var side = String(r[G.side] || '').toLowerCase();
  return {
    status: String(r[G.status] || '').toLowerCase() || null,
    displayName: String(r[G.display_name] || ''),
    side: ALLOW_SIDES[side] ? side : '',
    dishName: dishNameOrNull_(r[G.dish_name]),
    icon: sanitizeIcon_(r[G.icon]),
    allergies: sanitizeShort_(r[G.allergies], 200),
  };
}

function meToMine_(me) {
  if (!me || !me.side) return null;
  return {
    side: me.side,
    name: me.dishName,
    icon: me.icon,
  };
}

function findMeRow_(guestRows, guestId) {
  if (!guestId) return null;
  for (var i = 0; i < guestRows.length; i++) {
    if (guestRows[i][G.guest_id] === guestId) return guestRows[i];
  }
  return null;
}

function buildGetPayload_(eventId, guestIdParam) {
  var eventRow = loadEventRow_(eventId);
  if (!eventRow) {
    return {
      error: 'invalid',
      dishes: [],
      people: { attending: 0 },
      me: null,
      mine: null,
    };
  }
  var guestRows = loadGuestRowsForEvent_(eventId);
  var state = computeState_(eventRow, guestRows, guestIdParam);
  var meRow = findMeRow_(guestRows, guestIdParam);
  var me = rowToMe_(meRow);
  return {
    event: eventToApi_(eventRow, state),
    dishes: buildDishes_(guestRows),
    people: { attending: countAttending_(guestRows) },
    me: me,
    mine: meToMine_(me),
  };
}

function checkRateLimit_(eventId, guestId) {
  var cache = CacheService.getScriptCache();
  var ek = 'wr:event:' + eventId;
  var ec = parseInt(cache.get(ek) || '0', 10);
  if (ec >= RATE_EVENT_MAX) return false;
  var gk = 'wr:guest:' + guestId;
  var gc = parseInt(cache.get(gk) || '0', 10);
  if (gc >= RATE_GUEST_MAX) return false;
  cache.put(ek, String(ec + 1), RATE_TTL);
  cache.put(gk, String(gc + 1), RATE_TTL);
  return true;
}

function normalizePostBody_(body) {
  if (!body || !body.event || !body.guestId) return null;
  if (!body.action) {
    if (body.remove) {
      body.action = 'contribution.remove';
    } else if (body.side) {
      body.action = 'contribution';
      if (body.name === undefined) body.name = '';
    }
  }
  return body;
}

function writeGuestRow_(sheetRowIndex, rowValues) {
  var sh = guestsSheet_();
  sh.getRange(sheetRowIndex, 1, sheetRowIndex, GUEST_COLS).setValues([rowValues]);
}

function appendGuestRow_(rowValues) {
  guestsSheet_().appendRow(rowValues);
}

function blankGuestRow_(eventId, guestId) {
  var row = [];
  for (var c = 0; c < GUEST_COLS; c++) row.push('');
  row[G.event_id] = eventId;
  row[G.guest_id] = guestId;
  return row;
}

function isoNow_() {
  return new Date().toISOString();
}

function postError_(error) {
  return json_({ ok: false, error: error });
}

function postSuccess_(eventId, guestId, clientTag) {
  var guestRows = loadGuestRowsForEvent_(eventId);
  var eventRow = loadEventRow_(eventId);
  var state = computeState_(eventRow, guestRows, guestId);
  var me = rowToMe_(findMeRow_(guestRows, guestId));
  return json_({ ok: true, state: state, me: me });
}

function canWrite_(state, body, guestRows, guestId) {
  if (state === 'closed' || state === 'past') return 'closed';
  if (body.action === 'rsvp' && body.status === 'attending') {
    if (state === 'full' && !isGuestAttending_(guestRows, guestId)) return 'full';
  }
  return null;
}

function handlePostAction_(body) {
  var eventId = String(body.event);
  var guestId = String(body.guestId);
  if (!isValidGuestId_(guestId)) return postError_('invalid');

  var eventRow = loadEventRow_(eventId);
  if (!eventRow) return postError_('invalid');

  var guestRows = loadGuestRowsForEvent_(eventId);
  var state = computeState_(eventRow, guestRows, guestId);
  var block = canWrite_(state, body, guestRows, guestId);
  if (block) return postError_(block);

  var sh = guestsSheet_();
  if (!sh) return postError_('invalid');

  var sheetRow = findGuestRowSheetIndex_(eventId, guestId);
  var row =
    sheetRow > 0
      ? sh.getRange(sheetRow, 1, sheetRow, GUEST_COLS).getValues()[0]
      : blankGuestRow_(eventId, guestId);
  var now = isoNow_();
  var clientTag = sanitizeShort_(body.client || '', 80);

  if (body.action === 'rsvp') {
    var status = String(body.status || '').toLowerCase();
    if (!ALLOW_STATUS[status] || status === 'pending') return postError_('invalid');
    row[G.status] = status;
    row[G.display_name] = sanitizeShort_(body.displayName, 40);
    if (status === 'declined') {
      row[G.side] = '';
      row[G.dish_name] = '';
      row[G.icon] = '';
    }
  } else if (body.action === 'contribution') {
    var side = String(body.side || '').toLowerCase();
    if (!ALLOW_SIDES[side]) return postError_('invalid');
    var curStatus = String(row[G.status] || '').toLowerCase();
    if (curStatus !== 'attending') {
      if (sheetRow <= 0) {
        if (state === 'full') return postError_('full');
        row[G.status] = 'attending';
      } else {
        return postError_('not_attending');
      }
    }
    row[G.side] = side;
    row[G.dish_name] = sanitizeShort_(body.name, 40);
    row[G.icon] = sanitizeIcon_(body.icon);
  } else if (body.action === 'contribution.remove') {
    row[G.side] = '';
    row[G.dish_name] = '';
    row[G.icon] = '';
  } else if (body.action === 'allergies') {
    row[G.allergies] = sanitizeShort_(body.allergies, 200);
  } else {
    return postError_('invalid');
  }

  if (clientTag) row[G.client] = clientTag;
  if (!row[G.created_at]) row[G.created_at] = now;
  row[G.updated_at] = now;

  if (sheetRow > 0) {
    writeGuestRow_(sheetRow, row);
  } else {
    appendGuestRow_(row);
  }

  return postSuccess_(eventId, guestId, clientTag);
}

function doGet(e) {
  var eventId = e && e.parameter ? e.parameter.event : null;
  if (!eventId) {
    return json_({
      error: 'invalid',
      dishes: [],
      people: { attending: 0 },
      me: null,
      mine: null,
    });
  }
  var guestId = e.parameter.guestId || null;
  return json_(buildGetPayload_(eventId, guestId));
}

function doPost(e) {
  var body = {};
  try {
    body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  } catch (err) {
    return postError_('invalid');
  }

  body = normalizePostBody_(body);
  if (!body) return postError_('invalid');

  var lock = LockService.getScriptLock();
  var gotLock = false;
  try {
    gotLock = lock.tryLock(LOCK_MS);
  } catch (err) {
    return postError_('busy');
  }
  if (!gotLock) return postError_('busy');

  try {
    if (!checkRateLimit_(body.event, body.guestId)) return postError_('busy');
    return handlePostAction_(body);
  } finally {
    lock.releaseLock();
  }
}

/**
 * One-time migration from v1 tabs `contributions` and `seed` → `guests`.
 * Run manually from the Apps Script editor on a **copy** of the sheet first.
 */
function migrateContributions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var guestsSh = ss.getSheetByName('guests');
  if (!guestsSh) throw new Error('Missing guests tab');

  var existingKeys = {};
  var data = guestsSh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var k = migrationKey_(r[G.event_id], r[G.guest_id], r[G.side], r[G.dish_name], r[G.icon], isTrue_(r[G.is_host]));
    existingKeys[k] = true;
  }

  var now = isoNow_();
  migrateLegacySheet_(ss.getSheetByName('contributions'), existingKeys, now, false);
  migrateLegacySheet_(ss.getSheetByName('seed'), existingKeys, now, true);
}

function migrationKey_(eventId, guestId, side, dishName, icon, isHost) {
  if (isHost || guestId === 'host') {
    return [eventId, guestId, side, dishName, icon].join('\0');
  }
  return eventId + '\0' + guestId;
}

function migrateLegacySheet_(sh, existingKeys, now, isHost) {
  if (!sh) return;
  var guestsSh = guestsSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var eventId = r[0];
    var guestId = r[1];
    if (!eventId || !guestId) continue;
    var side = String(r[2] || '').toLowerCase();
    var dishName = r[3];
    var icon = sanitizeIcon_(r[4]);
    var key = migrationKey_(eventId, guestId, side, dishName, icon, isHost);
    if (existingKeys[key]) continue;

    var row = blankGuestRow_(eventId, guestId);
    if (isHost) {
      row[G.is_host] = true;
      row[G.side] = side;
      row[G.dish_name] = dishName;
      row[G.icon] = icon;
    } else {
      row[G.status] = 'attending';
      row[G.side] = side;
      row[G.dish_name] = dishName;
      row[G.icon] = icon;
    }
    row[G.created_at] = now;
    row[G.updated_at] = now;
    guestsSh.appendRow(row);
    existingKeys[key] = true;
  }
}
