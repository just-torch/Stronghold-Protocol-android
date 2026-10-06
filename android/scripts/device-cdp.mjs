#!/usr/bin/env node
// 在真机 App 的 WebView 里跑一段 JS —— 用 CDP 直连，不需要 chrome://inspect。
//
// 为什么需要它：安卓版的界面全部在系统 WebView 里，出问题（WebView 太老、脚本没跑起来、点不动）
// 时从 logcat 看到的东西很少。release 包默认开着 WebView 调试，所以可以：
//
//   adb shell cat /proc/net/unix | grep devtools_remote      # 找 @webview_devtools_remote_<pid>
//   adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>
//   curl http://127.0.0.1:9222/json/list                     # 拿 webSocketDebuggerUrl
//
// 这个脚本把上面三步和 Runtime.evaluate 串起来（Node 22+ 自带 WebSocket，无需依赖）。
//
// 用法：
//   node android/scripts/device-cdp.mjs --list                       # 列出 WebView 里的页面
//   node android/scripts/device-cdp.mjs 'navigator.userAgent'
//   node android/scripts/device-cdp.mjs --default                    # 一组「脚本到底跑没跑」的能力探针
//   node android/scripts/device-cdp.mjs 'document.getElementById("btn-host").click()'
//   node android/scripts/device-cdp.mjs --target /                'location.href'
//
// 参数：
//   --serial <id>   adb 设备序列号（只连一台时可省略）
//   --target <子串>  选择 URL 含该子串的页面（默认第一个 page 类型目标）
//   --list          只列页面
//   --port <n>      adb forward 用的本地端口（默认 9222）
//   --json          原样打印 CDP 返回的 JSON
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const adb = existsSync(join(root, 'android', '.build', 'sdk', 'platform-tools', 'adb.exe'))
  ? join(root, 'android', '.build', 'sdk', 'platform-tools', 'adb.exe')
  : 'adb';

const argv = process.argv.slice(2);
const opts = { serial: '', target: '', list: false, port: 9222, json: false, default: false };
const rest = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--serial') opts.serial = argv[++i];
  else if (a === '--target') opts.target = argv[++i];
  else if (a === '--port') opts.port = Number(argv[++i]);
  else if (a === '--list') opts.list = true;
  else if (a === '--json') opts.json = true;
  else if (a === '--default') opts.default = true;
  else rest.push(a);
}

const adbArgs = opts.serial ? ['-s', opts.serial] : [];
const run = (args) => execFileSync(adb, [...adbArgs, ...args], { encoding: 'utf8' });

if (!opts.list && !opts.default && rest.length === 0) {
  console.error('用法：node android/scripts/device-cdp.mjs [--serial id] [--target 子串] [--list] <表达式>');
  process.exit(2);
}

// --- 找 WebView 的 devtools 抽象套接字 ---------------------------------------
// /proc/net/unix 里是 "@webview_devtools_remote_<pid>"，"@" 是抽象命名空间前缀；
// adb forward 的 localabstract: 后面不能带它（带上会建出一条连不上的转发）。
const unix = run(['shell', 'cat', '/proc/net/unix']);
const sockets = unix
  .split(/\r?\n/)
  .map((l) => (l.trim().split(/\s+/).pop() || '').replace(/^@/, ''))
  .filter((name) => name.startsWith('webview_devtools_remote_'));
if (sockets.length === 0) {
  console.error('没找到 webview_devtools_remote_*：App 没在前台，或这个包关掉了 WebView 调试。');
  process.exit(3);
}

const port = opts.port;
run(['forward', `tcp:${port}`, `localabstract:${sockets[0]}`]);
const cleanup = () => { try { run(['forward', '--remove', `tcp:${port}`]); } catch { /* 已经没了就算了 */ } };
process.on('exit', cleanup);

// --- 列出目标 ---------------------------------------------------------------
const listUrl = `http://127.0.0.1:${port}/json/list`;
let targets = [];
for (let attempt = 0; attempt < 20; attempt++) {
  try {
    targets = await (await fetch(listUrl)).json();
    if (Array.isArray(targets) && targets.length) break;
  } catch { /* WebView 的 devtools 端点要一会儿才起来 */ }
  await new Promise((r) => setTimeout(r, 300));
}
if (!Array.isArray(targets) || targets.length === 0) {
  console.error(`拿不到 ${listUrl} —— 转发可能没起来（socket: ${sockets[0]}）`);
  process.exit(4);
}

if (opts.list) {
  for (const t of targets) console.log(`${t.type}\t${t.url}\t${t.title ?? ''}`);
  process.exit(0);
}

const page = (opts.target ? targets.find((t) => (t.url ?? '').includes(opts.target)) : null)
  ?? targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
  ?? targets.find((t) => t.webSocketDebuggerUrl);
if (!page) { console.error('没有可用的调试目标'); process.exit(5); }

// --- 表达式 ----------------------------------------------------------------
// --default：这台机器上「WebView 够不够新」的最小判据。WebView 66（2018）会全军覆没：
// 数字分隔符 / 可选链 / 空值合并是 SyntaxError，后面几个 API 直接 undefined。
const probes = [
  ['userAgent', 'navigator.userAgent'],
  ['numeric separator 1_000', "(()=>{try{return new Function('return 1_000')()}catch(e){return e.name}})()"],
  ['optional chaining a?.b', "(()=>{try{return new Function('return ({a:{b:1}})?.a?.b')()}catch(e){return e.name}})()"],
  ['nullish ?? ', "(()=>{try{return new Function('return null ?? 7')()}catch(e){return e.name}})()"],
  ['Object.fromEntries', 'typeof Object.fromEntries'],
  ['Array.prototype.flatMap', 'typeof [].flatMap'],
  ['String.prototype.replaceAll', "typeof ''.replaceAll"],
  ['location.href', 'location.href'],
  ['body text head', 'document.body.innerText.replace(/\\s+/g," ").slice(0,120)'],
];
const expression = opts.default
  ? `JSON.stringify([${probes.map(([name, expr]) => `[${JSON.stringify(name)}, String(${expr})]`).join(',')}])`
  : rest.join(' ');

// --- CDP -------------------------------------------------------------------
const ws = new WebSocket(page.webSocketDebuggerUrl);
const result = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('CDP 超时（10s）')), 10000);
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression, returnByValue: true, awaitPromise: true, allowUnsafeEvalBlockedByCSP: true },
    }));
  });
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id !== 1) return;
    clearTimeout(timer);
    resolve(msg);
  });
  ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WebSocket 连接失败')); });
});
ws.close();

if (opts.json) { console.log(JSON.stringify(result, null, 2)); process.exit(0); }
if (result.error) { console.error(`CDP 报错：${result.error.message}`); process.exit(6); }
const r = result.result ?? {};
if (r.exceptionDetails) {
  console.error(`页面里抛异常：${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
  process.exit(7);
}
const value = r.result?.value;
if (opts.default) {
  for (const [name, got] of JSON.parse(value)) console.log(`${name.padEnd(28)} ${got}`);
} else {
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}
