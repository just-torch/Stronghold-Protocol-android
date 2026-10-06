// android/scripts/lib/lan-seeker.mjs — a Node implementation of the seeker half of the LAN room beacon.
//
// Nothing in the APK uses this: the app's seeker is Java (LanDiscoveryCore), because the app's Node runtime only
// starts in host mode. This exists for two reasons:
//   * `android/scripts/lan-tool.mjs scan` lets you check from a PC whether a phone's beacon is actually reaching
//     the network — the phone has no console, so this is the only way to see what it is broadcasting;
//   * android/scripts/lan-verify.mjs uses it to test the announcer and the shared protocol module without needing
//     the JVM, so a failure can be attributed to the protocol side or the Java side instead of "discovery is
//     broken somewhere".
//
// Same wire format and same ports as protocol.mjs; only the socket bookkeeping differs from the Java class.

import dgram from 'node:dgram';

import {
  HOST_PORT,
  HOST_TTL_MS,
  MAX_DATAGRAM,
  QUERY_INTERVAL_MS,
  SEEK_PORT,
  decodePacket,
  hostFromPacket,
  newInstanceId,
  whoPacket,
} from '../nodejs-template/lan/protocol.mjs';
import { broadcastAddresses } from '../nodejs-template/lan/net.mjs';

/**
 * @param {{
 *   hostPort?: number, seekPort?: number, intervalMs?: number, ttlMs?: number,
 *   targets?: string[], id?: string, log?: (message: string) => void,
 *   onHosts?: (hosts: any[]) => void, keepAlive?: boolean,
 * }} [opts]
 * @returns {{ id: string, hostPort: number, seekPort: number, targets: string[], error: Error | null,
 *             hosts: () => any[], queryNow: () => void, close: () => Promise<void> }}
 */
export function startSeeker(opts = {}) {
  const hostPort = opts.hostPort ?? HOST_PORT;
  const seekPort = opts.seekPort ?? SEEK_PORT;
  const intervalMs = opts.intervalMs ?? QUERY_INTERVAL_MS;
  const ttlMs = opts.ttlMs ?? HOST_TTL_MS;
  const targets = opts.targets || broadcastAddresses();
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const onHosts = typeof opts.onHosts === 'function' ? opts.onHosts : null;
  const id = opts.id || newInstanceId();

  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  /** @type {Map<string, any>} */
  const hosts = new Map();

  const handle = {
    id,
    hostPort,
    seekPort,
    targets,
    error: null,
    hosts: () => {
      prune();
      return [...hosts.values()].sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.address < b.address ? -1 : 1));
    },
    queryNow,
    close,
  };

  function prune() {
    const deadline = Date.now() - ttlMs;
    for (const [key, host] of hosts) if (host.lastSeen < deadline) hosts.delete(key);
  }

  function queryNow() {
    if (socket.closed) return;
    const buf = whoPacket(id);
    for (const target of targets) {
      socket.send(buf, seekPort, target, (err) => {
        if (err) fail(err);
      });
    }
  }

  function fail(err) {
    if (handle.error) return;
    handle.error = err instanceof Error ? err : new Error(String(err));
    log(`[lan] ${handle.error.message}`);
  }

  socket.on('error', fail);

  socket.on('message', (buf, rinfo) => {
    if (buf.length > MAX_DATAGRAM) return;
    const packet = decodePacket(buf);
    if (!packet || packet.t !== 'here') return;
    const host = hostFromPacket(packet, rinfo, Date.now());
    if (!host) return;
    hosts.set(`${host.id}@${host.address}`, host);
    onHosts?.(handle.hosts());
  });

  /** @type {NodeJS.Timeout | null} */
  let timer = null;

  socket.on('listening', () => {
    try {
      socket.setBroadcast(true);
    } catch (err) {
      fail(/** @type {Error} */ (err));
    }
    log(`[lan] seeking on :${hostPort} → ${targets.join(', ')}:${seekPort}`);
    queryNow();
    timer = setInterval(queryNow, intervalMs);
    // See the same option in announce.mjs: referenced by default would keep a caller's process alive forever.
    if (!opts.keepAlive) {
      timer.unref?.();
      socket.unref?.();
    }
  });

  try {
    socket.bind({ port: hostPort, address: '0.0.0.0', exclusive: false });
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

/** Wait until at least one host is seen or the deadline passes. @returns {Promise<any[]>} */
export async function seekFor(opts = {}) {
  const seeker = startSeeker(opts);
  const timeoutMs = opts.timeoutMs ?? 3000;
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const found = seeker.hosts();
      if (found.length) return found;
    }
    return seeker.hosts();
  } finally {
    await seeker.close();
  }
}
