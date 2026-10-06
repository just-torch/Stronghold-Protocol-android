// android/scripts/nodejs-template/lan/announce.mjs — the host half of the LAN room beacon (see protocol.mjs).
//
// One UDP socket bound to SEEK_PORT. It does two things:
//   * every ANNOUNCE_INTERVAL_MS it broadcasts a `here` packet to HOST_PORT on every broadcast address of every
//     non-loopback IPv4 interface, so a seeker that is simply sitting on the join screen finds it;
//   * it answers a seeker's `who` with a unicast `here` to the sender's address/port, so opening the join screen
//     shows the room immediately instead of up to one announcement interval later.
//
// The room list comes from the game's lobby (protocol.mjs roomListFromLobby) so a seeker can deep-link straight
// into `?room=CODE` (public/js/main.js remembers it and auto-joins) instead of having to be told the 4-letter code.
//
// This runs inside the same Node process as the game server: the app starts it from nodejs-template/index.js right
// after startServer() resolves, and android/scripts/lan-tool.mjs runs it next to a PC-hosted `npm start` so phones
// can discover a desktop server too. It is never started on a phone that is joining rather than hosting.

import dgram from 'node:dgram';

import {
  ANNOUNCE_INTERVAL_MS,
  HOST_PORT,
  SEEK_PORT,
  decodePacket,
  herePacket,
  newInstanceId,
} from './protocol.mjs';
import { broadcastAddresses } from './net.mjs';

/** Minimum gap between two replies to the same address, so one spamming peer cannot make us flood the LAN. */
const REPLY_COOLDOWN_MS = 1000;

/**
 * Start announcing. Never throws for network problems: a device without Wi-Fi, or a port already taken by another
 * instance of the app, must not stop the game server from running. Failures are reported through `onError` and the
 * returned handle's `error`.
 *
 * @param {{
 *   port: number,                    // the game server's TCP port (what a client would open)
 *   name?: string,                   // label shown on the other phone
 *   app?: string,                    // game version, shown as a detail
 *   proto?: number,                  // wire PROTOCOL_VERSION, informational
 *   getRooms?: () => unknown[],      // live room list (protocol.mjs roomListFromLobby)
 *   hostPort?: number, seekPort?: number, intervalMs?: number,
 *   id?: string, log?: (message: string) => void, onError?: (error: Error) => void,
 *   interfaces?: ReturnType<typeof os.networkInterfaces>,
 *   keepAlive?: boolean,
 * }} opts
 * @returns {{ id: string, port: number, hostPort: number, seekPort: number, targets: string[],
 *             announceNow: () => void, close: () => Promise<void>, error: Error | null }}
 */
export function startLanAnnouncer(opts = {}) {
  const port = Number(opts.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError(`invalid game port: ${opts.port}`);

  const hostPort = opts.hostPort ?? HOST_PORT;
  const seekPort = opts.seekPort ?? SEEK_PORT;
  const intervalMs = opts.intervalMs ?? ANNOUNCE_INTERVAL_MS;
  const id = opts.id || newInstanceId();
  const name = opts.name || '卫戍协议 · 局域网主机';
  const app = opts.app || '';
  const proto = Number(opts.proto) || 0;
  const getRooms = typeof opts.getRooms === 'function' ? opts.getRooms : () => [];
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const onError = typeof opts.onError === 'function' ? opts.onError : () => {};
  const targets = broadcastAddresses(opts.interfaces);

  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  /** @type {Map<string, number>} last reply time per source address */
  const lastReply = new Map();

  const handle = {
    id,
    port,
    hostPort,
    seekPort,
    targets,
    announceNow,
    close,
    error: null,
  };

  /** @returns {Buffer} */
  function packet() {
    let rooms = [];
    try {
      rooms = getRooms() || [];
    } catch (err) {
      log(`[lan] room list unavailable: ${err?.message ?? err}`);
    }
    return herePacket({ id, name, port, app, proto, rooms });
  }

  function announceNow() {
    if (socket.closed) return;
    const buf = packet();
    for (const target of targets) {
      socket.send(buf, hostPort, target, (err) => {
        if (err) fail(err);
      });
    }
  }

  function fail(err) {
    if (handle.error) return;
    handle.error = err instanceof Error ? err : new Error(String(err));
    log(`[lan] ${handle.error.message}`);
    onError(handle.error);
  }

  socket.on('error', fail);

  socket.on('message', (buf, rinfo) => {
    const parsed = decodePacket(buf);
    if (!parsed || parsed.t !== 'who') return;
    const now = Date.now();
    const previous = lastReply.get(rinfo.address) || 0;
    if (now - previous < REPLY_COOLDOWN_MS) return;
    lastReply.set(rinfo.address, now);
    if (lastReply.size > 64) {
      for (const [addr, at] of lastReply) if (now - at > 60_000) lastReply.delete(addr);
    }
    socket.send(packet(), rinfo.port, rinfo.address, (err) => {
      if (err) fail(err);
    });
  });

  /** @type {NodeJS.Timeout | null} */
  let timer = null;

  socket.on('listening', () => {
    try {
      socket.setBroadcast(true);
    } catch (err) {
      fail(/** @type {Error} */ (err));
    }
    log(`[lan] announcing :${port} as ${id} to ${targets.join(', ')} (listen :${seekPort})`);
    announceNow();
    timer = setInterval(announceNow, intervalMs);
    // Do not hold the event loop open by default: inside the app the game server already keeps the process alive,
    // and when it closes the process must be able to exit. Run standalone (scripts/lan-tool.mjs announce) and this
    // must be off, or Node would see no referenced handle and exit at once.
    if (!opts.keepAlive) {
      timer.unref?.();
      socket.unref?.();
    }
  });

  try {
    socket.bind({ port: seekPort, address: '0.0.0.0', exclusive: false });
  } catch (err) {
    fail(/** @type {Error} */ (err));
  }

  async function close() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    await new Promise((resolve) => {
      try {
        socket.close(() => resolve());
      } catch {
        resolve();
      }
    });
  }

  return handle;
}
