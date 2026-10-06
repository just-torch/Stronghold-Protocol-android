// android/scripts/host-with-lan.mjs — start the game server on this PC *and* announce it on the LAN.
//
// This is `npm start` plus the room beacon, for the case "the host is my computer, the players are phones". It
// exists because the beacon that ships inside the APK only ever runs on a phone: a plain `npm start` on a PC is a
// completely silent server, so the phone app has nothing to discover and the room list stays empty even though both
// devices are on the same Wi-Fi.
//
// Nothing in the game repository is modified to achieve this — it imports the original server as a library and
// attaches the same beacon module the APK uses (lan/wire.mjs → lan/announce.mjs), reading room codes out of the
// lobby's public fields so a phone can offer a one-tap "加入 ABCD".
//
//   node android/scripts/host-with-lan.mjs [--port 3000] [--host 0.0.0.0] [--name 客厅电脑]
//                                         [--no-announce] [--quiet]
//
// Ctrl+C stops both.

import os from 'node:os';
import process from 'node:process';

import { startServer, lanUrls } from '../../server/index.js';
import { APP_VERSION, PROTOCOL_VERSION } from '../../shared/constants.js';
import { announceServer } from './nodejs-template/lan/wire.mjs';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) { args._.push(token); continue; }
    const eq = token.indexOf('=');
    if (eq > 0) { args[token.slice(2, eq)] = token.slice(eq + 1); continue; }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { args[key] = next; i++; } else { args[key] = 'true'; }
  }
  return args;
}

/** A name the phone's list can show. `os.hostname()` on Windows is usually readable enough. */
function defaultName() {
  const host = os.hostname();
  if (!host) return 'PC 主机';
  return host.slice(0, 40);
}

/** The firewall rule the players need; without it discovery works but nobody can actually load the page. */
function firewallHint(port) {
  return `netsh advfirewall firewall add rule name="Stronghold Protocol ${port}" dir=in action=allow protocol=TCP localport=${port} profile=private,domain`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('用法: node android/scripts/host-with-lan.mjs [--port 3000] [--host 0.0.0.0] [--name 名字] [--no-announce]');
    return;
  }

  const port = Number(args.port ?? process.env.PORT ?? 3000);
  const host = args.host ?? process.env.HOST ?? '0.0.0.0';
  const quiet = args.quiet === 'true';
  const name = args.name || defaultName();
  const announce = args['no-announce'] !== 'true';

  const server = await startServer({ port, host, quiet });

  let announcer = null;
  if (announce) {
    announcer = announceServer(server, {
      name,
      app: APP_VERSION,
      proto: PROTOCOL_VERSION,
      log: (message) => { if (!quiet) console.log(message); },
    });
    // The socket binds asynchronously; give it a tick so a bind failure is reported on this line rather than never.
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  console.log(`\n  卫戍协议：盟约 · Stronghold Protocol: Covenant v${APP_VERSION}`);
  console.log(`  Local:   ${server.url}`);
  const lan = lanUrls(server.port);
  for (const url of lan) console.log(`  LAN:     ${url}`);

  if (!announce) {
    console.log('\n  广播已关闭（--no-announce）：手机需要手动输入上面的地址。');
  } else if (announcer?.error) {
    console.log(`\n  ⚠ 广播失败：${announcer.error.message}`);
    console.log('    手机搜不到这台电脑，但用上面的地址手动加入仍然可以。');
  } else {
    console.log(`\n  ✓ 正在广播为「${name}」，手机打开应用即可在首页看到（UDP → :${announcer.hostPort}，询问 :${announcer.seekPort}）`);
    console.log('    房间建好之后，房号也会出现在手机上的列表里，可以直接一键加入。');
  }

  console.log('\n  提醒：');
  console.log('   * 手机第一次连接时，Windows 防火墙会拦掉入站 TCP，手机能搜到但打不开页面。放行一次即可：');
  console.log(`       ${firewallHint(server.port)}`);
  console.log('     （只放行入站 TCP 就够；广播是出站流量，不受防火墙影响）');
  console.log('   * 手机和电脑要在同一个 Wi-Fi / 热点下，并且中间没有 AP 隔离（访客网络常见）。');
  console.log('   * 如果手机仍然搜不到，用另一个终端跑 `node android/scripts/lan-tool.mjs doctor` 看看方向。');
  console.log('\n  Ctrl+C 停止。\n');

  let stopping = false;
  const stop = async (signal) => {
    if (stopping) process.exit(1);
    stopping = true;
    console.log(`\n[${signal}] 正在停止…`);
    try { await announcer?.close(); } catch { /* ignore */ }
    try { await server.close(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.on('SIGINT', () => { stop('SIGINT'); });
  process.on('SIGTERM', () => { stop('SIGTERM'); });
}

await main();
