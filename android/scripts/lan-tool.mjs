// android/scripts/lan-tool.mjs — PC-side utilities for the LAN room beacon.
//
//   node android/scripts/lan-tool.mjs scan [--seconds 6] [--host-port N] [--seek-port N]
//       List the hosts that are announcing on this network right now. The phone has no console, so this is how you
//       check whether its beacon is reaching the Wi-Fi at all (and whether the discovery ports are blocked).
//
//   node android/scripts/lan-tool.mjs doctor [--port 3000] [--seconds 5]
//       Work out which direction is broken: this machine's interfaces and broadcast targets, what it can hear,
//       and whether a server is answering on loopback and on its LAN address.
//
//   node android/scripts/lan-tool.mjs announce --port 3000 [--name "客厅主机"] [--room ABCD] [--seconds 0]
//       Announce a server running on this PC *without* starting it — for a server you started some other way. If
//       you are about to start one anyway, use android/scripts/host-with-lan.mjs instead: it announces the real
//       room codes, which this cannot know.
//
// Ctrl+C to stop. None of it touches the game; it only speaks the beacon protocol
// (scripts/nodejs-template/lan/protocol.mjs).

import os from 'node:os';

import {
  HOST_PORT,
  SEEK_PORT,
} from './nodejs-template/lan/protocol.mjs';
import { broadcastAddresses } from './nodejs-template/lan/net.mjs';
import { startSeeker } from './lib/lan-seeker.mjs';
import { startLanAnnouncer } from './nodejs-template/lan/announce.mjs';

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

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

function describeHost(host) {
  const rooms = host.rooms.length
    ? host.rooms.map((r) => `${r.code}(${r.players}/${r.max}${r.inMatch ? ',对局中' : ''})`).join(' ')
    : '还没有房间';
  return `  ${host.name || '(未命名)'}  http://${host.address}:${host.port}/  ${host.app ? `v${host.app}  ` : ''}${rooms}`;
}

async function scan(args) {
  const hostPort = num(args['host-port'], HOST_PORT);
  const seekPort = num(args['seek-port'], SEEK_PORT);
  const seconds = num(args.seconds, 6);

  const seeker = startSeeker({ hostPort, seekPort, keepAlive: true });
  console.log(`正在搜索（监听 :${hostPort}，询问 :${seekPort}）— ${seconds} 秒`);
  console.log(`广播目标：${broadcastAddresses().join(', ')}`);
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

  const hosts = seeker.hosts();
  const error = seeker.error;
  await seeker.close();

  if (error) console.log(`  socket 错误：${error.message}`);
  if (!hosts.length) {
    console.log('没有搜到任何主机。');
    console.log('  * 对方要先在应用里点「建立主机」；');
    console.log('  * 两台设备必须在同一个 Wi-Fi（访客网络常隔离设备）；');
    console.log('  * 电脑的防火墙可能拦掉了入站 UDP。');
    process.exitCode = 1;
    return;
  }
  console.log(`搜到 ${hosts.length} 台主机：`);
  for (const host of hosts) console.log(describeHost(host));
}

/**
 * "Which direction is broken?" — the one question a phone cannot answer, because it has no console.
 *
 * Discovery is deliberately two independent things (outbound announcements and inbound queries), and so is the game
 * itself (a UDP beacon to find a host, then plain TCP to actually load the page). A failure in any one of them looks
 * identical from the phone ("I can't see / can't open it"), so this prints each of them separately.
 */
async function doctor(args) {
  const hostPort = num(args['host-port'], HOST_PORT);
  const seekPort = num(args['seek-port'], SEEK_PORT);
  const seconds = num(args.seconds, 5);
  const port = args.port ? num(args.port, 3000) : null;

  console.log('=== 1. 本机网络 ===');
  const interfaces = os.networkInterfaces();
  const locals = [];
  for (const [name, list] of Object.entries(interfaces)) {
    for (const entry of list || []) {
      if (entry.family !== 'IPv4' && entry.family !== 4) continue;
      console.log(`  ${entry.internal ? '内部' : '外部'}  ${name.padEnd(28)} ${entry.address}/${entry.netmask}`);
      if (!entry.internal) locals.push(entry.address);
    }
  }
  const targets = broadcastAddresses();
  console.log(`  广播目标: ${targets.join(', ')}`);
  if (!locals.length) {
    console.log('  ⚠ 没有找到任何外部 IPv4 地址：这台机器现在没有连上局域网，广播发不出去。');
  }

  console.log(`\n=== 2. 听 ${seconds} 秒（监听 :${hostPort}，询问 :${seekPort}）===`);
  const seeker = startSeeker({ hostPort, seekPort, keepAlive: true });
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  const hosts = seeker.hosts();
  const seekError = seeker.error;
  await seeker.close();

  if (seekError) console.log(`  ✗ 搜索端 socket 错误：${seekError.message}`);
  if (hosts.length) {
    console.log(`  ✓ 收到 ${hosts.length} 台主机的广播：`);
    for (const host of hosts) console.log(describeHost(host));
  } else {
    console.log('  ✗ 这段时间里没有收到任何广播。');
  }

  console.log('\n=== 3. 本机服务器 ===');
  if (!port) {
    console.log('  （加了 --port 3000 就会探测本机的服务器）');
  } else {
    for (const address of ['127.0.0.1', ...locals]) {
      const url = `http://${address}:${port}/healthz`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
        const body = await res.text();
        console.log(`  ${res.ok ? '✓' : '✗'} ${url} → ${res.status} ${body.slice(0, 100)}`);
      } catch (err) {
        console.log(`  ✗ ${url} → ${err?.message ?? err}`);
      }
    }
  }

  console.log('\n=== 结论 ===');
  console.log('  * 手机搜不到电脑：电脑这一侧**必须有人广播**。原版 `npm start` 不会广播（广播端只在内嵌 APK 的');
  console.log('    Node 入口里），所以要用 `node android/scripts/host-with-lan.mjs` 开服，');
  console.log('    或者对已经在跑的服务器执行 `node android/scripts/lan-tool.mjs announce --port <端口>`。');
  console.log('  * 手机能搜到、但打开页面失败：Windows 防火墙挡了入站 TCP。放行一次：');
  console.log(`      netsh advfirewall firewall add rule name="Stronghold Protocol ${port ?? 3000}" dir=in action=allow protocol=TCP localport=${port ?? 3000} profile=private,domain`);
  console.log('  * 第 2 步连手机都没听到：确认手机点了「建立主机」、两台在同一个 Wi-Fi（访客网络常隔离设备）、');
  console.log('    并且没有跨网段 / 走 VPN。上面的「广播目标」应该包含你和手机共用的那个网段。');
}

async function announce(args) {
  const port = num(args.port, 3000);
  const hostPort = num(args['host-port'], HOST_PORT);
  const seekPort = num(args['seek-port'], SEEK_PORT);
  const name = args.name || 'PC 主机';
  const seconds = num(args.seconds, 0);
  const codes = [];
  if (args.room) for (const code of String(args.room).split(',')) if (code.trim()) codes.push(code.trim().toUpperCase());
  const rooms = codes.map((code) => ({ code, mode: 'coop', diff: 'NORMAL', players: 1, bots: 0, max: 4, inMatch: false }));

  const announcer = startLanAnnouncer({
    port,
    name,
    app: 'pc',
    getRooms: () => rooms,
    hostPort,
    seekPort,
    keepAlive: seconds <= 0,
    log: (message) => console.log(message),
  });

  console.log(`正在广播 http://<本机 IP>:${port}/ 为「${name}」（询问端口 :${seekPort}）`);
  if (announcer.error) console.log(`  广播失败：${announcer.error.message}`);
  if (seconds > 0) {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    await announcer.close();
    console.log('已停止。');
    return;
  }
  const stop = async () => {
    await announcer.close();
    console.log('\n已停止。');
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  // keepAlive holds the event loop open (the socket is referenced), so this never needs to resolve.
  await new Promise(() => {});
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (command === 'scan') return scan(args);
  if (command === 'doctor') return doctor(args);
  if (command === 'announce') return announce(args);
  console.log('用法：');
  console.log('  node android/scripts/lan-tool.mjs scan   [--seconds 6]');
  console.log('  node android/scripts/lan-tool.mjs doctor [--port 3000] [--seconds 5]');
  console.log('  node android/scripts/lan-tool.mjs announce --port 3000 [--name 客厅主机] [--room ABCD]');
  console.log('');
  console.log('要在电脑上开服并同时广播，用：node android/scripts/host-with-lan.mjs');
  process.exitCode = command ? 2 : 0;
}

await main();
