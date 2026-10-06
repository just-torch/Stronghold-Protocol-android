// android/scripts/nodejs-template/lan/protocol.mjs — wire format for the LAN room beacon.
//
// WHY THIS EXISTS
// server/lobby.js keeps every room in a `Map` inside one process, and public/js/net.js connects to
// `ws(s)://<location.host>/ws`. Two phones that both tapped 「建立主机」 therefore run two authoritative servers
// with no channel between them at all — they cannot see each other's rooms, and no amount of work on the game
// protocol would change that, because a room is server-local state. The only way two independent copies of the app
// end up in the same match is for one of them to stop being a server and become the other's client.
//
// This module is that missing channel, and it is deliberately NOT part of the game: it only exists to turn
// "there is a server over there" into a URL the launcher can navigate the WebView to. A client that has joined a
// room never sends or receives any of this.
//
// TRANSPORT
// One UDP datagram, UTF-8, `key=value` lines, nothing else. Not JSON on purpose: the seeker half is implemented
// in plain Java (android/android/app/src/main/java/io/github/sganggs/strongholdprotocol/lan/LanDiscoveryCore.java)
// which must stay free of Android and JSON dependencies so it can be compiled and run by a desktop JVM in
// android/scripts/lan-verify.mjs, and line parsing is ~20 lines in both languages, a JSON parser in Java is not.
//
// TWO PORTS, NEVER ONE
// The same phone can be announcing and seeking at the same time, and one device cannot bind the same UDP port
// twice, so the two directions use different ports:
//   * HOST_PORT — announcers send `here` to it, seekers bind it. (So a seeker never needs to bind SEEK_PORT.)
//   * SEEK_PORT — seekers send `who` to it, announcers bind it.
// A `who` therefore arrives at the announcer from the seeker's HOST_PORT socket, and the unicast `here` reply goes
// back to that same address/port — no extra state, and no packet is ever delivered to the socket that sent it.
//
// This file is mirrored verbatim into the APK (web/nodejs/lan/protocol.mjs) and is imported by both the announcer
// and the tests, so it must not import anything from the game: that would break it when run from this source
// location, where no server/ or shared/ tree exists next to it.

/** First line of every datagram. Anything else on the port is not ours. */
export const LAN_MAGIC = 'splan';

/** Bumped whenever a field's meaning changes. Peers with a different version ignore each other. */
export const LAN_VERSION = 1;

/** Announcers send `here` here; seekers bind it. */
export const HOST_PORT = 45777;

/** Seekers send `who` here; announcers bind it. */
export const SEEK_PORT = 45778;

/** How often a host repeats its unsolicited announcement. */
export const ANNOUNCE_INTERVAL_MS = 2000;

/** How often a seeker asks, so the first result does not wait for the next unsolicited announcement. */
export const QUERY_INTERVAL_MS = 2500;

/** A host is forgotten after this long without a packet (a bit over 3 missed announcements). */
export const HOST_TTL_MS = 8000;

/** Datagrams larger than this are rejected outright (and are never sent). */
export const MAX_DATAGRAM = 1200;

/** At most this many rooms are advertised, to keep the datagram small. */
export const MAX_ROOMS = 8;

/** Seat count fallback (shared/constants.js MAX_SEATS) — see the note about imports above. */
const MAX_SEATS_FALLBACK = 4;

const KEY_RE = /^[a-z][a-z0-9]*$/;
const ID_RE = /^[0-9a-f]{8,32}$/;
const CODE_RE = /^[A-Z]{4}$/;

/** Escape a value so it survives the one-line-per-field encoding. */
function escapeValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}

/** Inverse of escapeValue. Unknown escapes degrade to the escaped character. */
function unescapeValue(value) {
  return value.replace(/\\(.)/g, (_, ch) => (ch === 'n' ? '\n' : ch === 'r' ? '\r' : ch));
}

/**
 * Encode a message. `undefined`/`null` fields are dropped, so callers can pass optional data directly.
 * @param {Record<string, unknown>} fields
 * @returns {Buffer}
 */
export function encodePacket(fields) {
  const lines = [];
  for (const key of Object.keys(fields)) {
    const value = fields[key];
    if (value === undefined || value === null || value === '') continue;
    if (!KEY_RE.test(key)) throw new TypeError(`invalid LAN protocol key: ${key}`);
    lines.push(`${key}=${escapeValue(value)}`);
  }
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8');
}

/**
 * Parse and validate a message. Returns null for anything that is not a well-formed packet of our version —
 * including other applications' traffic that happens to land on the port.
 * @param {Buffer | Uint8Array} buf
 * @returns {Record<string, string> | null}
 */
export function decodePacket(buf) {
  if (!buf || buf.length === 0 || buf.length > MAX_DATAGRAM) return null;

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return null;
  }

  /** @type {Record<string, string>} */
  const fields = {};
  for (const line of text.split('\n')) {
    const clean = line.endsWith('\r') ? line.slice(0, -1) : line;
    if (clean === '') continue;
    const eq = clean.indexOf('=');
    if (eq <= 0) return null;
    const key = clean.slice(0, eq);
    if (!KEY_RE.test(key)) return null;
    fields[key] = unescapeValue(clean.slice(eq + 1));
  }

  if (fields.sp !== LAN_MAGIC) return null;
  if (Number(fields.v) !== LAN_VERSION) return null;
  if (fields.t !== 'who' && fields.t !== 'here') return null;
  if (!ID_RE.test(fields.id || '')) return null;
  return fields;
}

/**
 * `rooms` field: `code,mode,difficulty,players,bots,max,inMatch` per room, rooms joined by `|`.
 * Every part is drawn from a restricted alphabet, so no escaping is needed inside the field.
 * @param {Array<{code: string, mode?: string, diff?: string, players?: number, bots?: number, max?: number, inMatch?: boolean}>} rooms
 * @returns {string}
 */
export function encodeRooms(rooms) {
  if (!Array.isArray(rooms)) return '';
  return rooms
    .slice(0, MAX_ROOMS)
    .map((r) => [
      r.code,
      r.mode || '',
      r.diff || '',
      Math.max(0, Number(r.players) || 0),
      Math.max(0, Number(r.bots) || 0),
      Math.max(0, Number(r.max) || 0),
      r.inMatch ? 1 : 0,
    ].join(','))
    .join('|');
}

/**
 * @param {string | undefined} text
 * @returns {Array<{code: string, mode: string, diff: string, players: number, bots: number, max: number, inMatch: boolean}>}
 */
export function decodeRooms(text) {
  if (!text) return [];
  const out = [];
  for (const part of String(text).split('|')) {
    const f = part.split(',');
    if (f.length < 7 || !CODE_RE.test(f[0])) continue;
    out.push({
      code: f[0],
      mode: f[1],
      diff: f[2],
      players: Number(f[3]) || 0,
      bots: Number(f[4]) || 0,
      max: Number(f[5]) || 0,
      inMatch: f[6] === '1',
    });
    if (out.length >= MAX_ROOMS) break;
  }
  return out;
}

/** A random instance id (`[0-9a-f]{16}`), matching what the Java seeker generates. */
export function newInstanceId() {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {{ id: string, name?: string, port: number, app?: string, proto?: number, rooms?: unknown[], ts?: number }} info
 * @returns {Buffer}
 */
export function herePacket(info) {
  return encodePacket({
    sp: LAN_MAGIC,
    v: LAN_VERSION,
    t: 'here',
    id: info.id,
    name: info.name,
    port: info.port,
    app: info.app,
    proto: info.proto,
    rooms: encodeRooms(info.rooms || []),
    ts: info.ts ?? Date.now(),
  });
}

/** @param {string} id @returns {Buffer} */
export function whoPacket(id) {
  return encodePacket({ sp: LAN_MAGIC, v: LAN_VERSION, t: 'who', id });
}

/**
 * Turn a validated `here` packet into the record the launcher renders, or null when it is unusable.
 * @param {Record<string, string>} packet
 * @param {{ address: string }} rinfo
 * @param {number} now
 */
export function hostFromPacket(packet, rinfo, now) {
  const port = Number(packet.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (!rinfo || !rinfo.address) return null;
  return {
    id: packet.id,
    // Trimmed and capped: this string is rendered into the DOM by the launcher, which always sets it via
    // textContent, but a bounded label keeps a hostile packet from bloating the list.
    name: typeof packet.name === 'string' ? packet.name.slice(0, 40) : '',
    address: rinfo.address,
    port,
    app: typeof packet.app === 'string' ? packet.app.slice(0, 24) : '',
    proto: Number(packet.proto) || 0,
    rooms: decodeRooms(packet.rooms),
    lastSeen: now,
  };
}

/**
 * Advertise the rooms the lobby currently holds.
 *
 * This reads `lobby.rooms` (a documented public Map, see server/lobby.js) and never writes to it. Everything is
 * guarded so that a future refactor of the lobby turns the room codes into "no rooms advertised" instead of
 * taking the beacon — and with it the host's whole app — down.
 * @param {any} lobby
 */
export function roomListFromLobby(lobby) {
  const rooms = lobby && lobby.rooms;
  if (!rooms || typeof rooms.values !== 'function') return [];
  const out = [];
  try {
    for (const room of rooms.values()) {
      if (!room || typeof room.code !== 'string') continue;
      const seats = Array.isArray(room.seats) ? room.seats : [];
      let players = 0;
      let bots = 0;
      for (const seat of seats) {
        if (!seat || seat.left) continue;
        if (seat.isBot) bots++;
        else players++;
      }
      out.push({
        code: room.code,
        mode: typeof room.mode === 'string' ? room.mode : '',
        diff: typeof room.difficulty === 'string' ? room.difficulty : '',
        players,
        bots,
        max: seats.length || MAX_SEATS_FALLBACK,
        inMatch: !!room.match,
      });
      if (out.length >= MAX_ROOMS) break;
    }
  } catch {
    return out;
  }
  return out;
}
