// android/web/launcher.js — the in-app chooser between "host on this phone" and "join someone else".
//
// Host mode starts the embedded Node.js server (which unpacks the game out of the APK the first time), starts the
// LAN room beacon (web/nodejs/lan/, so other phones can find this one) and then points the WebView at
// http://<this phone's LAN address>:<port>. Join mode points the WebView at a host's LAN address — either one that
// was discovered automatically or one the player typed.
//
// Why discovery exists: two phones that both tapped 「建立主机」 are two independent authoritative game servers
// (server/lobby.js keeps rooms in a process-local Map) and cannot be connected to each other in any way. The only
// way they end up in the same match is for one of them to join the other, so this page has to make that one tap.
// The seeking half is a native plugin (LanDiscoveryPlugin → LanDiscoveryCore) because the app's Node runtime only
// starts in host mode and unpacking ~330 MB of assets just to listen for a UDP packet would make 「加入房间」 the
// slow path. See android/scripts/nodejs-template/lan/protocol.mjs.
//
// How this talks to the Node runtime: @jadejr/capacitor-nodejs starts a Node process and exposes it through the
// `CapacitorNodeJS` plugin. start() resolves once the project has been unpacked and Node launched; whenReady()
// resolves when the bundled `bridge` module has signalled readiness; from then on the Node side can push events
// (we listen for `server-ready` / `server-error`).

'use strict';

/* global capacitorCapacitorNodeJS, capacitorExports */

const DEFAULT_PORT = 3000;
const HOST_WAIT_MS = 120_000;   // first launch has to unpack ~320 MB out of the APK
const READY_WAIT_MS = 60_000;   // after the unpack: waiting for the server to bind its port
const READY_GRACE_MS = 25_000;  // bridge is up but `server-ready` has not arrived yet → use loopback anyway
const DISCOVERY_POLL_MS = 1500; // how often the discovered-host list is refreshed while this page is visible
const STOP_WAIT_MS = 250;       // how long enterGame() waits for the native stop() before navigating away

const NodeJS = (typeof capacitorCapacitorNodeJS !== 'undefined' && capacitorCapacitorNodeJS.NodeJS) || null;
const Capacitor = window.Capacitor || null;

const $ = (id) => document.getElementById(id);
const el = {
  cardChoose: $('card-choose'),
  cardLan: $('card-lan'),
  cardHost: $('card-host'),
  cardJoin: $('card-join'),
  cardFatal: $('card-fatal'),
  btnHost: $('btn-host'),
  btnJoin: $('btn-join'),
  btnCopy: $('btn-copy'),
  btnEnter: $('btn-enter'),
  btnLoopback: $('btn-loopback'),
  btnBack1: $('btn-back-1'),
  btnBack2: $('btn-back-2'),
  btnConnect: $('btn-connect'),
  btnRetry: $('btn-retry'),
  btnRescan: $('btn-rescan'),
  hostStatus: $('host-status'),
  hostHint: $('host-hint'),
  hostBar: $('host-bar'),
  hostAddresses: $('host-addresses'),
  hostRival: $('host-rival'),
  addrList: $('addr-list'),
  joinAddr: $('join-addr'),
  joinError: $('join-error'),
  discoverState: $('discover-state'),
  hostList: $('host-list'),
  fatalMessage: $('fatal-message'),
  fatalDetail: $('fatal-detail'),
};

/**
 * The native LAN seeker. `window.Capacitor.Plugins` is only populated once something calls registerPlugin (the
 * vendored capacitor.js provides it), so both routes are tried; on an app build without the plugin the proxy
 * exists but every call rejects, which the callers below treat as "discovery unavailable".
 */
const LanDiscovery = (() => {
  const cap = window.Capacitor;
  if (!cap) return null;
  try {
    if (cap.Plugins && cap.Plugins.LanDiscovery) return cap.Plugins.LanDiscovery;
    if (typeof cap.registerPlugin === 'function') return cap.registerPlugin('LanDiscovery');
  } catch { /* fall through */ }
  return (cap.Plugins && cap.Plugins.LanDiscovery) || null;
})();

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* ignore */ } },
};

let hostAddress = null;   // where the host will actually play
let loopbackAddress = null;
let hostInfo = null;
let unpackTimer = null;
/** IPv4 addresses of this device — its own beacon is heard over loopback and must not be listed as "another host". */
const ownAddresses = new Set();

// ---------------------------------------------------------------------------------------------------
// view helpers
// ---------------------------------------------------------------------------------------------------
function show(which) {
  for (const card of [el.cardChoose, el.cardHost, el.cardJoin, el.cardFatal]) {
    card.classList.toggle('hidden', card !== which);
  }
  // The discovered-room list belongs to both "not in a game yet" screens.
  el.cardLan.classList.toggle('hidden', which !== el.cardChoose && which !== el.cardJoin);
  updateRivalWarning();
}

function setBar(indeterminate, percent) {
  el.hostBar.classList.toggle('indeterminate', indeterminate);
  el.hostBar.style.width = indeterminate ? '40%' : `${Math.max(0, Math.min(100, percent))}%`;
}

/** An indeterminate bar plus a running clock, so a long first-run unpack never looks like a hang. */
function startElapsed(text) {
  stopElapsed();
  const began = Date.now();
  const tick = () => {
    const s = Math.round((Date.now() - began) / 1000);
    el.hostStatus.textContent = `${text}（已用 ${s} 秒）`;
  };
  tick();
  unpackTimer = setInterval(tick, 1000);
}

function stopElapsed() {
  if (unpackTimer) { clearInterval(unpackTimer); unpackTimer = null; }
}

function fatal(message, detail) {
  stopElapsed();
  el.fatalMessage.textContent = message;
  if (detail) {
    el.fatalDetail.textContent = String(detail);
    el.fatalDetail.classList.remove('hidden');
  } else {
    el.fatalDetail.classList.add('hidden');
  }
  show(el.cardFatal);
}

const shortError = (err) => String(err?.message ?? err ?? '').slice(0, 160);

// ---------------------------------------------------------------------------------------------------
// address handling
// ---------------------------------------------------------------------------------------------------
/**
 * Accepts "1.2.3.4", "1.2.3.4:3000", "http://1.2.3.4:3000/", "https://host/?room=ABCD" and returns a clean URL
 * for the WebView. A bare host defaults to http (the in-app server is plain http on the LAN); an explicit
 * https:// is kept so that a tunnel/exposed host still works (the client then uses wss:// for the socket).
 */
function normaliseAddress(raw) {
  let value = String(raw || '').trim();
  if (!value) return null;
  value = value.replace(/\s+/g, '');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `http://${value}`;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname) return null;

  // A bare host, or a plain http:// host without a port, means the in-app server, which listens on 3000.
  // An https:// host without a port is a tunnel / reverse proxy, so its implicit 443 is the right choice.
  if (!url.port && url.protocol !== 'https:') url.port = String(DEFAULT_PORT);

  // The game client builds absolute URLs ( /data/, /vendor/, /ws ) so it must be served from the site root.
  const room = url.searchParams.get('room');
  const authority = url.port ? `${url.hostname}:${url.port}` : url.hostname;
  return `${url.protocol}//${authority}/${room ? `?room=${encodeURIComponent(room)}` : ''}`;
}

/** `http://192.168.1.23:3000/` + room code → the deep link public/js/main.js auto-joins. */
function withRoom(base, code) {
  try {
    const url = new URL(base);
    url.searchParams.set('room', String(code));
    return url.toString();
  } catch {
    return base;
  }
}

/** A label for the other phone's list, from the WebView's user agent (e.g. "Pixel 7 的主机"). */
function deviceLabel() {
  const ua = String(navigator.userAgent || '');
  // Android's UA is "…(Linux; Android <ver>; <model> Build/<build>; wv)…". Anything else (a desktop WebView, a
  // test) has no model in it, and picking a random segment out of it produces nonsense like "x64 的主机".
  if (!/Android/i.test(ua)) return '卫戍协议主机';
  const inner = /\(([^)]*)\)/.exec(ua);
  if (inner) {
    const parts = inner[1].split(';').map((s) => s.trim());
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i].replace(/\s*Build\/.*$/i, '').trim();
      if (!part || part.length > 32) continue;
      if (/^(wv|mobile|u|en|zh|ja|ko|us|linux|android)$/i.test(part)) continue;
      if (/^android\b/i.test(part)) continue;
      return `${part} 的主机`;
    }
  }
  return '卫戍协议主机';
}

// ---------------------------------------------------------------------------------------------------
// LAN discovery (the native seeker)
// ---------------------------------------------------------------------------------------------------
/** @type {any[]} */
let discoveredHosts = [];
let discoveryStatus = null;
let discoveryTimer = null;
let discoveryPolling = false;

function setDiscoverState(text, kind) {
  el.discoverState.textContent = text;
  el.discoverState.classList.toggle('found', kind === 'found');
  el.discoverState.classList.toggle('warn', kind === 'warn');
}

const isOwnAddress = (address) => ownAddresses.has(String(address || ''));

/**
 * How good an address is to send a player to. A phone with a VPN or a hotspot has several interfaces, each receives
 * its own copy of a host's announcement (we broadcast `who` on all of them), so the same host shows up once per
 * reachable address. Any of them works — this only decides which one to put on the button.
 */
function addressScore(address) {
  const parts = String(address || '').split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return 0;
  const [a, b] = parts;
  if (a === 192 && b === 168) return 4;          // the usual home / hotspot LAN
  if (a === 10) return 3;
  if (a === 172 && b >= 16 && b <= 31) return 3;
  if (a === 169 && b === 254) return 1;          // link-local: reachable only by accident
  return 2;                                      // CGNAT / VPN / anything else that got a reply through
}

/** One row per host: same instance id = same server seen over several interfaces. */
function mergeHosts(hosts) {
  const byId = new Map();
  for (const host of hosts) {
    if (!host) continue;
    const key = host.id || `${host.address}:${host.port}`;
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, { ...host, others: [] });
      continue;
    }
    // Room data can arrive on either copy; keep whichever one has it.
    if (!(existing.rooms || []).length && (host.rooms || []).length) existing.rooms = host.rooms;
    if (addressScore(host.address) > addressScore(existing.address)) {
      existing.others.push(existing.address);
      existing.address = host.address;
      existing.baseUrl = `http://${host.address}:${host.port}/`;
    } else {
      existing.others.push(host.address);
    }
  }
  return [...byId.values()];
}

/** The hosts worth showing: everything that is not this device's own beacon, one row each. */
function visibleHosts() {
  return mergeHosts(discoveredHosts.filter((h) => !isOwnAddress(h.address)));
}

async function startDiscovery() {
  if (!LanDiscovery) {
    renderHosts([]);
    return;
  }
  try {
    discoveryStatus = await LanDiscovery.start();
  } catch (err) {
    discoveryStatus = { error: shortError(err) };
  }
  await pollHosts();
  if (!discoveryTimer) discoveryTimer = setInterval(() => { pollHosts(); }, DISCOVERY_POLL_MS);
}

/** Fire-and-forget from the timer; the guard keeps a slow native call from stacking up. */
async function pollHosts() {
  if (discoveryPolling) return;
  discoveryPolling = true;
  try {
    const res = await LanDiscovery.getHosts();
    discoveryStatus = res;
    discoveredHosts = Array.isArray(res?.hosts) ? res.hosts : [];
    renderHosts(visibleHosts());
  } catch (err) {
    discoveryStatus = { error: shortError(err) };
    renderHosts([]);
  } finally {
    discoveryPolling = false;
    updateRivalWarning();
  }
}

/** Stop seeking. Awaited (briefly) before navigating away so the native side really does stop. */
async function stopDiscovery() {
  if (discoveryTimer) { clearInterval(discoveryTimer); discoveryTimer = null; }
  if (!LanDiscovery) return;
  try {
    await Promise.race([
      LanDiscovery.stop(),
      new Promise((resolve) => setTimeout(resolve, STOP_WAIT_MS)),
    ]);
  } catch { /* the plugin may not be there at all */ }
}

function emptyItem(text) {
  const li = document.createElement('li');
  li.className = 'host-empty';
  li.textContent = text;
  return li;
}

function hostItem(host) {
  const li = document.createElement('li');
  li.className = 'host';

  const head = document.createElement('div');
  head.className = 'host-head';
  const name = document.createElement('span');
  name.className = 'host-name';
  name.textContent = host.name || '未命名主机';
  const address = document.createElement('span');
  address.className = 'host-addr';
  address.textContent = `${host.address}:${host.port}`;
  head.append(name, address);
  li.appendChild(head);

  const base = host.baseUrl || `http://${host.address}:${host.port}/`;
  const rooms = Array.isArray(host.rooms) ? host.rooms : [];

  const meta = document.createElement('div');
  meta.className = 'host-meta';
  const others = Array.isArray(host.others) && host.others.length ? `（另有 ${host.others.join('、')}）` : '';
  meta.textContent = (rooms.length
    ? `${rooms.length} 个房间可以加入`
    : '还没有创建房间，进去之后在大厅里建房') + others;
  li.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'host-actions';
  for (const room of rooms) {
    const btn = document.createElement('button');
    btn.className = 'primary';
    btn.textContent = room.inMatch
      ? `${room.code} · 对局中`
      : `加入 ${room.code}（${room.players}/${room.max || 4}）`;
    btn.addEventListener('click', () => { enterGame(withRoom(base, room.code)); });
    actions.appendChild(btn);
  }
  const lobby = document.createElement('button');
  lobby.className = rooms.length ? 'ghost' : 'primary';
  lobby.textContent = rooms.length ? '只进大厅' : '进入大厅';
  lobby.addEventListener('click', () => { enterGame(base); });
  actions.appendChild(lobby);
  li.appendChild(actions);

  return li;
}

function renderHosts(hosts) {
  el.hostList.innerHTML = '';

  if (!LanDiscovery) {
    el.hostList.appendChild(emptyItem('这个版本不支持自动搜索房间。请在「加入房间」里手动输入主机地址（对方点「建立主机」后会看到）。'));
    setDiscoverState('不可用', 'warn');
    return;
  }
  if (discoveryStatus?.error) {
    el.hostList.appendChild(emptyItem(`搜索端口用不了：${discoveryStatus.error}`));
    setDiscoverState('出错', 'warn');
    return;
  }
  if (!hosts.length) {
    el.hostList.appendChild(emptyItem('还没有搜到。请确认对方已经点了「建立主机」，而且两台设备连的是同一个 Wi-Fi（访客网络常会隔离设备）。'));
    setDiscoverState('搜索中…');
    return;
  }

  setDiscoverState(`找到 ${hosts.length} 台`, 'found');
  for (const host of hosts) el.hostList.appendChild(hostItem(host));
}

/** While hosting, warn about the exact mistake this feature exists to prevent: two phones both hosting. */
function updateRivalWarning() {
  if (el.cardHost.classList.contains('hidden')) {
    el.hostRival.classList.add('hidden');
    return;
  }
  const rivals = visibleHosts();
  if (!rivals.length) {
    el.hostRival.classList.add('hidden');
    return;
  }
  const first = rivals[0];
  el.hostRival.textContent = `注意：同一 Wi-Fi 上还有另一台主机（${first.address}:${first.port}）。两台各自开服是两个互不相通的游戏，`
    + '要一起玩请让其中一方回到首页点「加入房间」。';
  el.hostRival.classList.remove('hidden');
}

// ---------------------------------------------------------------------------------------------------
// visiting the game
// ---------------------------------------------------------------------------------------------------
async function enterGame(rawUrl) {
  const url = normaliseAddress(rawUrl);
  if (!url) return;
  el.btnEnter.disabled = true;
  if (!el.cardHost.classList.contains('hidden')) el.hostStatus.textContent = '正在进入游戏…';
  if (!el.cardJoin.classList.contains('hidden')) {
    el.joinError.textContent = '正在连接…';
    el.joinError.classList.remove('hidden');
  }
  await stopDiscovery();
  // replace() so the Android back gesture does not bounce through the launcher again.
  window.location.replace(url);
}

// ---------------------------------------------------------------------------------------------------
// host mode
// ---------------------------------------------------------------------------------------------------
function renderAddresses(info) {
  const lan = Array.isArray(info?.lan) ? info.lan.filter(Boolean) : [];
  const port = info?.port || DEFAULT_PORT;
  loopbackAddress = normaliseAddress(info?.local) || `http://127.0.0.1:${port}/`;

  for (const url of lan) {
    try { ownAddresses.add(new URL(url).hostname); } catch { /* ignore */ }
  }

  el.addrList.innerHTML = '';
  for (const url of lan) {
    const li = document.createElement('li');
    li.textContent = url;
    el.addrList.appendChild(li);
  }
  el.hostAddresses.classList.toggle('hidden', lan.length === 0);

  if (lan.length === 0) {
    el.hostHint.textContent = '没有检测到局域网地址：请确认手机已连接 Wi-Fi（不要只用移动数据），然后重启本应用。';
    el.btnLoopback.classList.add('hidden');
    hostAddress = loopbackAddress;
  } else {
    // Playing on the LAN address (rather than 127.0.0.1) makes the room's "复制链接" button produce a URL that
    // actually works for the other players, because the client builds it from location.origin.
    hostAddress = normaliseAddress(lan[0]) || loopbackAddress;
    el.hostHint.textContent = '进入游戏后将使用第一个地址；朋友在同一 Wi-Fi 上打开本应用会自动看到你。';
    el.btnLoopback.classList.remove('hidden');
  }

  if (info?.announce?.error) {
    el.hostHint.textContent += `（自动广播不可用：${String(info.announce.error).slice(0, 120)}——朋友仍可手动输入地址加入。）`;
  }
}

/** Resolves with the payload of the Node side's `server-ready` event. */
function waitForServer(timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const handles = [];
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const h of handles) { try { h.remove?.(); } catch { /* ignore */ } }
      fn(arg);
    };
    const parse = (ev) => {
      try { return JSON.parse(ev?.args?.[0] ?? '{}'); } catch { return {}; }
    };

    // Attach before calling start(): the events are not retained for late subscribers.
    handles.push(NodeJS.addListener('server-ready', (ev) => finish(resolve, parse(ev))));
    handles.push(NodeJS.addListener('server-error', (ev) => {
      const info = parse(ev);
      finish(reject, new Error(info.message || info.error || '服务器启动失败'));
    }));

    const timer = setTimeout(() => {
      finish(reject, new Error(`等待服务器启动超时（${timeoutMs / 1000} 秒）`));
    }, timeoutMs);

    // SP_HOST_NAME is what the other phones see in their room list.
    NodeJS.start({ env: { SP_PORT: String(DEFAULT_PORT), SP_HOST_NAME: deviceLabel() } })
      .then(() => NodeJS.whenReady())
      .then(() => {
        startElapsed('正在启动服务器');
        setBar(true);
        // Reaching this point already proves the bridge works — the `ready` handshake is sent by the bridge
        // module itself while the Node entry point loads it. So if the follow-up `server-ready` event is ever
        // lost, fall back to the (fixed) loopback port rather than leaving the user stuck on this screen.
        setTimeout(
          () => finish(resolve, { port: DEFAULT_PORT, local: `http://127.0.0.1:${DEFAULT_PORT}`, lan: [] }),
          READY_GRACE_MS,
        );
      })
      .catch((err) => finish(reject, err));
  });
}

async function host() {
  if (!NodeJS) { fatal('这个页面上没有找到 Node.js 插件。', '请在手机上的「卫戍协议」应用里打开本页面。'); return; }

  show(el.cardHost);
  el.btnEnter.disabled = true;
  el.btnLoopback.classList.add('hidden');
  el.hostHint.textContent = '';
  el.hostAddresses.classList.add('hidden');
  el.hostRival.classList.add('hidden');
  setBar(true);
  startElapsed('正在准备游戏文件（首次启动需要解压素材，请耐心等待）');
  // Keep seeking while hosting: not to join anything, but to warn about the other phone that also tapped host.
  startDiscovery();

  try {
    const info = await waitForServer(READY_WAIT_MS + HOST_WAIT_MS);
    stopElapsed();
    setBar(false, 100);
    hostInfo = info;
    renderAddresses(info);
    store.set('sp.lastHost', hostAddress);
    el.hostStatus.textContent = '服务器已就绪，可以开始游戏了。';
    el.btnEnter.disabled = false;
  } catch (err) {
    // The engine can only be started once per app launch. If a previous attempt already started it, the port is
    // deterministic, so just go there instead of failing.
    const message = String(err?.message ?? err);
    stopElapsed();
    if (/already been started|已经启动/i.test(message)) {
      const url = store.get('sp.lastHost') || `http://127.0.0.1:${DEFAULT_PORT}/`;
      await enterGame(url);
      return;
    }
    fatal('无法启动本机服务器。', message);
  }
}

// ---------------------------------------------------------------------------------------------------
// join mode
// ---------------------------------------------------------------------------------------------------
async function join() {
  el.joinError.classList.add('hidden');
  const url = normaliseAddress(el.joinAddr.value);
  if (!url) {
    el.joinError.textContent = '地址格式不对，请填写类似 192.168.1.23:3000 的地址。';
    el.joinError.classList.remove('hidden');
    return;
  }
  store.set('sp.lastJoin', el.joinAddr.value.trim());
  el.btnConnect.disabled = true;
  el.joinError.textContent = '正在连接…';
  el.joinError.classList.remove('hidden');
  await enterGame(url);
}

// ---------------------------------------------------------------------------------------------------
// wiring
// ---------------------------------------------------------------------------------------------------
el.btnHost.addEventListener('click', host);
el.btnJoin.addEventListener('click', () => {
  el.joinAddr.value = store.get('sp.lastJoin') || '';
  el.joinError.classList.add('hidden');
  show(el.cardJoin);
  el.joinAddr.focus();
});
el.btnBack1.addEventListener('click', () => { stopElapsed(); show(el.cardChoose); });
el.btnBack2.addEventListener('click', () => { show(el.cardChoose); });
el.btnConnect.addEventListener('click', join);
el.btnEnter.addEventListener('click', () => { if (hostAddress) enterGame(hostAddress); });
el.btnLoopback.addEventListener('click', () => {
  // Rare escape hatch: some routers / guest networks do not let a device reach its own LAN address.
  if (loopbackAddress) { hostAddress = loopbackAddress; enterGame(loopbackAddress); }
});
el.btnRetry.addEventListener('click', () => { show(el.cardChoose); });
el.btnRescan.addEventListener('click', () => {
  setDiscoverState('正在搜索…');
  if (LanDiscovery) pollHosts();
  else renderHosts([]);
});
el.joinAddr.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });

el.btnCopy.addEventListener('click', async () => {
  const urls = hostInfo?.lan?.length ? hostInfo.lan : (hostAddress ? [hostAddress] : []);
  if (!urls.length) return;
  const text = urls.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    el.hostStatus.textContent = '地址已复制。';
  } catch {
    // Clipboard API needs a secure context; fall back to a selection the user can copy by hand.
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); el.hostStatus.textContent = '地址已复制。'; }
    catch { el.hostStatus.textContent = '请长按上面的地址手动复制。'; }
    ta.remove();
  }
});

// Android hardware back button: leave the app when we are on the chooser.
try {
  Capacitor?.Plugins?.App?.addListener?.('backButton', ({ canGoBack }) => {
    if (!canGoBack || !el.cardChoose.classList.contains('hidden')) Capacitor.Plugins.App.exitApp();
    else window.history.back();
  });
} catch { /* App plugin unavailable — nothing to do */ }

show(el.cardChoose);
el.joinAddr.value = store.get('sp.lastJoin') || '';
startDiscovery();
