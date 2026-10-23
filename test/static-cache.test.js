// test/static-cache.test.js — weak-network revalidation of the static mounts: a page reload / a reconnect asks for the
// files it already has instead of downloading them again. `/public/**` (`/js/`, `/css/`, the rest of public/),
// `/shared/**` and `/data/**` all go through server/http/files.js serveFile: an ETag on every response, 304 (no body) when
// the browser presents it, and `no-cache` (store, but revalidate each time) — so one conditional request replaces a
// download on a bad link. The per-mount details (content-hash ETags of the art, gzip / brotli variants) have their own
// tests (test/lobby.test.js, test/asset-index.test.js); this one pins the exact mounts the client loads at boot and
// in a match.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.js';

let srv = null;
after(async () => { if (srv) await srv.close(); });

test('/public/**, /shared/** and /data/** revalidate with ETag / 304', async () => {
  srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
  const get = (p, headers = {}) => fetch(srv.url + p, { headers });
  for (const path of ['/js/main.js', '/css/theme.css', '/index.html', '/shared/constants.js', '/data/config.json', '/data/chess.json']) {
    const first = await get(path);
    assert.equal(first.status, 200, path);
    await first.arrayBuffer();
    const etag = first.headers.get('etag');
    assert.ok(etag, `${path} has an ETag`);
    assert.equal(first.headers.get('last-modified') != null, true, `${path} has Last-Modified too`);
    assert.equal(first.headers.get('cache-control'), 'no-cache', `${path} is stored but revalidated`);
    const again = await get(path, { 'if-none-match': etag });
    assert.equal(again.status, 304, `${path} with its ETag`);
    assert.equal((await again.arrayBuffer()).byteLength, 0, `${path}: a 304 has no body`);
    const weak = await get(path, { 'if-none-match': `"stale", W/${etag}` });
    assert.equal(weak.status, 304, `${path}: weak comparison`);
    const stale = await get(path, { 'if-none-match': '"stale"' });
    assert.equal(stale.status, 200, `${path}: an unknown validator downloads again`);
    await stale.arrayBuffer();
  }
  // a compressed response has its own validator: revalidating with the encoding that produced it is a 304, without is not
  const gz = await get('/js/main.js', { 'accept-encoding': 'gzip' });
  await gz.arrayBuffer();
  const gzTag = gz.headers.get('etag');
  assert.notEqual(gzTag, null);
  assert.equal((await get('/js/main.js', { 'if-none-match': gzTag, 'accept-encoding': 'gzip' })).status, 304);
  assert.equal((await get('/js/main.js', { 'if-none-match': gzTag, 'accept-encoding': 'identity' })).status, 200);
});
