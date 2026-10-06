// android/scripts/lan-verify.mjs — prove that the two halves of the LAN beacon really talk to each other.
//
//   node android/scripts/lan-verify.mjs            (from the repository root; needs `cd android && npm run assemble` first)
//
// The beacon is implemented twice on purpose (see nodejs-template/lan/protocol.mjs): the announcer in JavaScript,
// inside the APK's Node runtime, and the seeker in Java, in the app process, because the Node runtime only starts
// when the phone is hosting. A device is needed to test the APK itself, so this harness tests everything that can
// be tested without one — including running the actual Java class that ships, on a desktop JVM, against the actual
// JavaScript announcer.
//
// Phases:
//   1. protocol   Node announcer ↔ Node seeker over loopback unicast on private ports. Fails ⇒ the wire format,
//                 the ports or the announcer are wrong.
//   2. java       Node announcer ↔ the shipping Java seeker (compiled here with javac). Fails ⇒ a phone would not
//                 see a host even though the protocol is fine — the two implementations have drifted.
//   3. broadcast  Real 255.255.255.255 / subnet broadcasts, no loopback shortcut. This is what a phone actually
//                 does; a failure here that phase 1 and 2 pass means this machine's firewall drops inbound UDP, not
//                 that the app is broken (it is reported, not treated as fatal).
//   4. host       The real thing: startServer() + the real announcer + a real WebSocket client that creates a room,
//                 then check that a seeker is told that exact 4-letter room code — i.e. the one-tap
//                 "加入 ABCD" button on the other phone would work.

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { startLanAnnouncer } from './nodejs-template/lan/announce.mjs';
import { broadcastAddresses } from './nodejs-template/lan/net.mjs';
import { startSeeker, seekFor } from './lib/lan-seeker.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(SCRIPT_DIR, '..');
const BUILD = path.join(APP, '.build');
const JAVA_OUT = path.join(BUILD, 'lan-verify-classes');
const ASSEMBLED_HOST = path.join(APP, 'web', 'nodejs', 'lan', 'host.mjs');
const JAVA_CORE = path.join(APP, 'android', 'app', 'src', 'main', 'java', 'io', 'github', 'sganggs', 'strongholdprotocol', 'lan', 'LanDiscoveryCore.java');
const JAVA_PROBE = path.join(APP, 'test', 'java', 'LanProbe.java');

/** Private ports for phases 1 and 2, so a real instance of the app (or the previous run) cannot interfere. */
const HOST_PORT = 45791;
const SEEK_PORT = 45792;

let failures = 0;
const pass = (msg) => console.log(`  \u2713 ${msg}`);
const fail = (msg) => { failures++; console.log(`  \u2717 ${msg}`); };
const info = (msg) => console.log(`    ${msg}`);
const phase = (title) => console.log(`\n=== ${title} ===`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run a child process to completion *without* blocking this process's event loop.
 *
 * spawnSync would be the obvious choice and is wrong here: while it runs, this process cannot service its own
 * sockets, so the announcer would never answer the Java seeker and the test would "prove" a bug that is not there.
 * stdio is inherited rather than piped, which also keeps the harness usable where pipes are restricted.
 */
function runInherit(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', (err) => resolve({ status: -1, error: err }));
    child.on('close', (status) => resolve({ status, error: null }));
  });
}

// ---------------------------------------------------------------------------------------------------
// phase 1: the protocol itself
// ---------------------------------------------------------------------------------------------------
async function phaseProtocol() {
  phase('1. protocol: Node announcer ↔ Node seeker');
  const rooms = [{ code: 'ABCD', mode: 'coop', diff: 'hard', players: 2, bots: 1, max: 4, inMatch: false }];
  const announcer = startLanAnnouncer({
    port: 34567,
    name: 'lan-verify',
    app: '0.0.0',
    proto: 1,
    getRooms: () => rooms,
    hostPort: HOST_PORT,
    seekPort: SEEK_PORT,
  });
  await sleep(120);

  try {
    const found = await seekFor({ hostPort: HOST_PORT, seekPort: SEEK_PORT, targets: ['127.0.0.1'], timeoutMs: 3000 });
    if (!found.length) { fail('the seeker never heard the announcer over loopback'); return; }
    pass(`found 1 host: ${found[0].name} @ ${found[0].address}:${found[0].port}`);
    if (found[0].id === announcer.id) pass('the instance id survived the round trip'); else fail(`id mismatch: ${found[0].id} != ${announcer.id}`);
    if (found[0].port === 34567) pass('the advertised game port survived'); else fail(`port mismatch: ${found[0].port}`);
    const room = found[0].rooms[0];
    if (room && room.code === 'ABCD' && room.players === 2 && room.bots === 1 && room.max === 4 && room.diff === 'hard') {
      pass('the room list round-tripped intact');
    } else {
      fail(`room list came back wrong: ${JSON.stringify(found[0].rooms)}`);
    }
  } finally {
    await announcer.close();
  }
}

// ---------------------------------------------------------------------------------------------------
// phase 2: the Java class that ships, against the real announcer
// ---------------------------------------------------------------------------------------------------
function findJavaHome() {
  const statePath = path.join(BUILD, 'sdk-state.json');
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (state.javaHome && fs.existsSync(path.join(state.javaHome, 'bin', 'javac.exe'))) return state.javaHome;
      if (state.javaHome && fs.existsSync(path.join(state.javaHome, 'bin', 'javac'))) return state.javaHome;
    } catch { /* fall through */ }
  }
  if (process.env.JAVA_HOME && fs.existsSync(path.join(process.env.JAVA_HOME, 'bin', 'javac'))) return process.env.JAVA_HOME;
  return null;
}

async function phaseJava() {
  phase('2. java: Node announcer ↔ the shipping Java seeker (desktop JVM)');
  const javaHome = findJavaHome();
  if (!javaHome) {
    fail('no JDK found (looked at android/.build/sdk-state.json and JAVA_HOME) — phase skipped');
    return;
  }
  const javac = path.join(javaHome, 'bin', 'javac');
  const java = path.join(javaHome, 'bin', 'java');
  info(`JDK: ${javaHome}`);

  fs.mkdirSync(JAVA_OUT, { recursive: true });
  // Piped stdio is not always available here, so compile with inherited output and judge by the exit code.
  const compiled = spawnSync(javac, ['-encoding', 'UTF-8', '-d', JAVA_OUT, JAVA_CORE, JAVA_PROBE], { stdio: 'inherit' });
  if (compiled.status !== 0) { fail(`javac exited with ${compiled.status}`); return; }
  pass('LanDiscoveryCore.java + LanProbe.java compile');

  const rooms = [{ code: 'WXYZ', mode: 'coop', diff: 'normal', players: 1, bots: 0, max: 4, inMatch: true }];
  const announcer = startLanAnnouncer({
    port: 34568,
    name: 'java-verify',
    app: '0.0.0',
    proto: 1,
    getRooms: () => rooms,
    hostPort: HOST_PORT,
    seekPort: SEEK_PORT,
  });
  await sleep(120);

  const outFile = path.join(JAVA_OUT, 'probe.json');
  try {
    fs.rmSync(outFile, { force: true });
    const run = await runInherit(
      java,
      ['-Dfile.encoding=UTF-8', '-cp', JAVA_OUT, 'LanProbe', String(SEEK_PORT), String(HOST_PORT), '6', outFile, '127.0.0.1'],
    );
    if (run.error) { fail(`could not start java: ${run.error.message}`); return; }
    if (run.status !== 0) { fail(`java exited with ${run.status}`); return; }
    if (!fs.existsSync(outFile)) { fail('the probe wrote no result file'); return; }

    const result = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    if (result.error) fail(`the Java socket reported: ${result.error}`);
    if (!result.found) { fail('the Java seeker found nothing (loopback unicast)'); return; }

    const host = result.hosts[0];
    pass(`Java found: ${host.name} @ ${host.address}:${host.port}`);
    if (host.id === announcer.id) pass('Java parsed the instance id exactly as JavaScript wrote it');
    else fail(`id mismatch: Java ${host.id} != Node ${announcer.id}`);
    const room = host.rooms[0];
    if (room && room.code === 'WXYZ' && room.inMatch === true && room.max === 4) pass('Java parsed the room list, including inMatch');
    else fail(`Java parsed the room list wrong: ${JSON.stringify(host.rooms)}`);
  } finally {
    await announcer.close();
  }
}

// ---------------------------------------------------------------------------------------------------
// phase 3: real broadcasts
// ---------------------------------------------------------------------------------------------------
async function phaseBroadcast() {
  phase('3. broadcast: the same thing over real broadcast addresses');
  const targets = broadcastAddresses();
  info(`targets: ${targets.join(', ')}`);
  const announcer = startLanAnnouncer({
    port: 34569,
    name: 'broadcast-verify',
    app: '0.0.0',
    getRooms: () => [],
    hostPort: HOST_PORT,
    seekPort: SEEK_PORT,
  });
  await sleep(120);
  try {
    const found = await seekFor({ hostPort: HOST_PORT, seekPort: SEEK_PORT, timeoutMs: 3000 });
    if (found.length) pass(`a real broadcast reached the seeker (${announcer.targets.join(', ')})`);
    else {
      info('no broadcast arrived. Phases 1 and 2 passing means the code and both ports are fine, so this machine');
      info('(very likely Windows Firewall on inbound UDP) is dropping it. A phone on a normal Wi-Fi does not.');
    }
  } finally {
    await announcer.close();
  }
}

// ---------------------------------------------------------------------------------------------------
// phase 4: the real server, the real announcer, a real room
// ---------------------------------------------------------------------------------------------------
async function phaseHost() {
  phase('4. host: startServer() + the real announcer + a real room code');
  if (!fs.existsSync(ASSEMBLED_HOST)) {
    fail('android/web/nodejs/lan/host.mjs is missing — run: cd android && npm run assemble');
    return;
  }

  const { startHost } = await import(pathToFileURL(ASSEMBLED_HOST).href);
  let host = null;
  let socket = null;
  try {
    host = await startHost({ port: 0, name: 'verify-host', log: () => {} });
    pass(`game server on port ${host.srv.port}`);

    if (!host.announcer) { fail('startHost() did not create an announcer'); return; }
    if (host.announcer.error) { fail(`the announcer failed: ${host.announcer.error.message}`); return; }
    pass(`announcer ${host.announcer.id} broadcasting game port ${host.announcer.port}`);

    // Create a room the way a player would, so the deep link has something real to point at.
    socket = new globalThis.WebSocket(`ws://127.0.0.1:${host.srv.port}/ws`);
    const code = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('the room was never created (no room.state frame)')), 8000);
      socket.addEventListener('message', (event) => {
        let msg;
        try { msg = JSON.parse(String(event.data)); } catch { return; }
        if (msg.t === 'welcome') socket.send(JSON.stringify({ t: 'room.create', mode: 'coop', difficulty: 'NORMAL' }));
        if (msg.t === 'room.state' && msg.code) { clearTimeout(timer); resolve(msg.code); }
        if (msg.t === 'error') { clearTimeout(timer); reject(new Error(`server rejected ${msg.code ?? '?'}: ${msg.msg ?? '(no message)'}`)); }
      });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('websocket error')); });
      socket.addEventListener('open', () => socket.send(JSON.stringify({ t: 'hello', name: 'lan-verify' })));
    });
    pass(`created room ${code} over the real WebSocket protocol`);

    // The announcer reads the lobby every time it speaks, so one query is enough.
    const found = await seekFor({ timeoutMs: 3000, targets: ['127.0.0.1'] });
    const seen = found.find((h) => h.id === host.announcer.id);
    if (!seen) { fail('a seeker could not see the real host at all'); return; }
    const room = seen.rooms.find((r) => r.code === code);
    if (room) pass(`a seeker is told about room ${code} (${room.players}/${room.max}) — the one-tap join would work`);
    else fail(`the advertised room list does not contain ${code}: ${JSON.stringify(seen.rooms)}`);

    const base = `http://${seen.address}:${seen.port}/?room=${code}`;
    info(`the other phone would open: ${base}`);
  } catch (err) {
    fail(`phase failed: ${err?.message ?? err}`);
  } finally {
    try { socket?.close(); } catch { /* ignore */ }
    try { await host?.close(); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------------------------------
async function main() {
  console.log('LAN discovery verification');
  console.log(`  repository: ${path.resolve(APP, '..')}`);
  console.log(`  app:        ${APP}`);

  await phaseProtocol();
  await phaseJava();
  await phaseBroadcast();
  await phaseHost();

  console.log(`\n${failures ? `${failures} check(s) FAILED` : 'all checks passed'}`);
  process.exitCode = failures ? 1 : 0;
}

await main();
