// android/scripts/nodejs-template/lan/host.mjs — "be a LAN host": the game server plus the room beacon.
//
// This is the one place the app wires those two together, and it is imported both by the APK entry point
// (nodejs-template/index.js) and by android/scripts/lan-verify.mjs, so the verification exercises the real wiring
// instead of a look-alike copy of it.
//
// It imports ../server/index.js, i.e. it only resolves inside the assembled tree (android/web/nodejs/), where
// server/, shared/, data/ and public/ are siblings. Run `cd android && npm run assemble` before using it.

import os from 'node:os';

import { startServer, lanUrls } from '../server/index.js';
import { APP_VERSION, PROTOCOL_VERSION } from '../shared/constants.js';
import { announceServer } from './wire.mjs';

/** A label for the other phone's list. `os.hostname()` is "localhost" on Android, hence the override. */
export function defaultHostName() {
  const host = os.hostname();
  if (!host || host === 'localhost' || host === 'localhost.localdomain') return '卫戍协议 · 局域网主机';
  return host.slice(0, 40);
}

/**
 * Start the game server and announce it on the LAN.
 *
 * An announcement failure is never fatal: the phone must still be playable (and joinable by anyone who types the
 * address) on a device with no Wi-Fi, or when another instance already holds the discovery port.
 *
 * @param {{ port?: number, host?: string, name?: string, announce?: boolean, log?: (message: string) => void }} [opts]
 * @returns {Promise<{ srv: any, announcer: any, lan: string[], name: string,
 *                     close: () => Promise<void> }>}
 */
export async function startHost(opts = {}) {
  const port = opts.port ?? 3000;
  const bindHost = opts.host ?? '0.0.0.0';
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const name = (opts.name && String(opts.name)) || defaultHostName();

  const srv = await startServer({ port, host: bindHost });

  let announcer = null;
  if (opts.announce !== false) {
    try {
      announcer = announceServer(srv, {
        name,
        app: APP_VERSION,
        proto: PROTOCOL_VERSION,
        log,
      });
    } catch (err) {
      // RangeError from an invalid port would mean a bug, but a playable server beats a crashed app either way.
      log(`[lan] not announcing: ${err?.message ?? err}`);
    }
  }

  // The socket binds asynchronously. Give it one turn so `announcer.error` is populated (EADDRINUSE, no Wi-Fi)
  // before the launcher renders the host card.
  await new Promise((resolve) => setTimeout(resolve, 50));

  return {
    srv,
    announcer,
    name,
    lan: lanUrls(srv.port),
    async close() {
      try {
        await announcer?.close();
      } catch { /* ignore */ }
      await srv.close();
    },
  };
}
