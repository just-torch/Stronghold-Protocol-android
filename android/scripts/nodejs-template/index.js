// android/scripts/nodejs-template/index.js — entry point executed by the embedded Node.js runtime inside the app.
//
// The @jadejr/capacitor-nodejs plugin copies the whole webDir/nodejs tree out of the APK into the app's private
// files directory and then runs this file. Because this file sits next to copies of `server/`, `shared/`, `data/`
// and `public/`, server/index.js resolves its own ROOT to this directory and serves the game unmodified.
//
// Hosting is `lan/host.mjs`: the game server plus the UDP room beacon that lets other phones find this one (see
// lan/protocol.mjs for why that beacon has to exist at all).
//
// Communication with the launcher page goes over the plugin's built-in `bridge` module (a native CommonJS builtin
// that is only present inside the app, hence the createRequire + try/catch so the same file also runs under plain
// `node index.js` on a desktop for debugging).
//
// Env in:  SP_PORT (game server port, default 3000), SP_HOST_NAME (label shown on the other phone).

import { createRequire } from 'node:module';
import process from 'node:process';

import { startHost } from './lan/host.mjs';

/**
 * Debug console (DESIGN §21.33), the switch this BUILD staged: `'auto'` = the server's own default (loopback clients
 * only: the app's own WebView, so the panel is there for single-player testing), `'1'` = every client of this app
 * (a test build — `build-apk.ps1 -Variant devtest` — where a friend joining over LAN may use it too), `'0'` = off
 * everywhere. `assemble-nodejs.mjs --console=…` rewrites the token below; an unrewritten token changes nothing, so
 * running this file directly (`node index.js`) leaves the server on its default. An SP_CONSOLE the platform sets wins.
 */
const consoleMode = '__SP_CONSOLE__';
if ((consoleMode === '0' || consoleMode === '1') && !process.env.SP_CONSOLE) process.env.SP_CONSOLE = consoleMode;

const require = createRequire(import.meta.url);

/** @type {{ channel?: { send: (eventName: string, ...args: unknown[]) => void } } | null} */
let bridge = null;
try {
  bridge = require('bridge');
} catch (err) {
  console.log('[sp] the Capacitor bridge module is not available — running standalone:', err?.message ?? err);
}

const channel = bridge?.channel ?? null;

/** Send a launcher event; a no-op when running outside the app. */
function send(eventName, ...args) {
  if (!channel) return;
  try {
    channel.send(eventName, ...args);
  } catch (err) {
    console.error(`[sp] failed to send "${eventName}" to the launcher:`, err);
  }
}

const port = Number(process.env.SP_PORT || process.env.PORT || 3000);
const hostName = process.env.SP_HOST_NAME || '';

try {
  // 0.0.0.0 so the other phones on the same Wi-Fi can reach this one.
  const host = await startHost({ port, name: hostName, log: (message) => console.log(message) });
  const { srv, announcer } = host;

  console.log(`[sp] listening on ${srv.url}${host.lan.length ? ` — LAN: ${host.lan.join(', ')}` : ' — no LAN address found'}`);
  if (announcer) {
    if (announcer.error) console.warn(`[sp] LAN discovery unavailable: ${announcer.error.message ?? announcer.error}`);
    else console.log(`[sp] LAN discovery active as ${announcer.id} (broadcast → :${announcer.hostPort})`);
  }

  send('server-ready', JSON.stringify({
    port: srv.port,
    local: `http://127.0.0.1:${srv.port}`,
    lan: host.lan,
    name: host.name,
    announce: announcer
      ? {
        id: announcer.id,
        hostPort: announcer.hostPort,
        seekPort: announcer.seekPort,
        error: announcer.error ? String(announcer.error.message ?? announcer.error) : null,
      }
      : null,
  }));
} catch (err) {
  const message = err?.code === 'EADDRINUSE'
    ? `端口 ${port} 已被占用（可能已有一个服务器在运行）`
    : String(err?.message ?? err);
  console.error('[sp] failed to start the server:', err);
  send('server-error', JSON.stringify({ message }));
}
