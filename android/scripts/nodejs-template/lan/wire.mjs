// android/scripts/nodejs-template/lan/wire.mjs — attach the room beacon to an already-started game server.
//
// One line of wiring, in one place, because there are two hosts that need it and they live in different trees:
//   * inside the APK, nodejs-template/lan/host.mjs   (the server is web/nodejs/server/index.js)
//   * on a PC,       android/scripts/host-with-lan.mjs (the server is <repo>/server/index.js)
// The two cannot share an import of the server, but they must not disagree about how the beacon is configured
// either — a difference there is invisible until a phone fails to find the host.
//
// It takes `srv` (anything with `.port` and a `.lobby` exposing the public `rooms` Map) and returns the announcer
// handle from startLanAnnouncer(). app/proto are passed in rather than imported, so this file stays runnable from
// the template source directory, where no shared/ tree exists next to it.

import { startLanAnnouncer } from './announce.mjs';
import { roomListFromLobby } from './protocol.mjs';

/**
 * @param {{ port: number, lobby: any }} srv a started server from server/index.js startServer()
 * @param {{ name?: string, app?: string, proto?: number, log?: (message: string) => void,
 *           onError?: (error: Error) => void, keepAlive?: boolean, hostPort?: number, seekPort?: number }} [opts]
 * @returns {ReturnType<typeof startLanAnnouncer>}
 */
export function announceServer(srv, opts = {}) {
  if (!srv || !Number.isInteger(srv.port)) throw new TypeError('announceServer needs a started server');
  return startLanAnnouncer({
    port: srv.port,
    name: opts.name,
    app: opts.app,
    proto: opts.proto,
    getRooms: () => roomListFromLobby(srv.lobby),
    log: opts.log,
    onError: opts.onError,
    keepAlive: opts.keepAlive,
    hostPort: opts.hostPort,
    seekPort: opts.seekPort,
  });
}
