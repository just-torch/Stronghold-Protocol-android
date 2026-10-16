// The external art directory (SP_ASSETS_DIR / the assetsDir option, docs/DEPLOY.md): the Android app unpacks the game
// into app-private storage and deletes that whole tree whenever the APK changes, so downloaded art has to live in a
// sibling directory that survives an app update. The server serves /assets/** and the extension-less /media/** audio
// route out of it first and keeps the bundled public/assets as the fallback; with no external directory the mounts are
// exactly what they were before.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createStaticHandler } from '../server/index.js';
import { serveDirs } from '../server/http/config.js';
import { createAssetIndex, hash16 } from '../server/http/assetIndex.js';
import { createManifestViews } from '../server/http/assetViews.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
/** The bundled art directory — what the server falls back to. Git-ignored, so a test may have to create a file here. */
const BUNDLED_ROOT = path.join(PUBLIC, 'assets');

/**
 * Files relative to an assets root.
 * The `BUNDLED_*` ones are created in public/assets by a test when the checkout does not have them and removed again.
 */
const EXTERNAL = 'audio/audio-assets-dir-test-external.mp3';
const BUNDLED = 'audio/audio-assets-dir-test-fallback.mp3';
const EXTERNAL_BGM = 'audio/bgm/audio-assets-dir-test-track.mp3';
const BUNDLED_BGM = 'audio/bgm/audio-assets-dir-test-fallback-track.mp3';

const tmpDirs = [];
function mkTmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/** Give `<root>/<rel>` (relative to the assets root) some content. */
function put(root, rel, body) {
  const file = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

/** Files this run created under public/assets (not in git) — removed again by removeCreated(). */
const created = new Set();
/** Create `<BUNDLED_ROOT>/<rel>` only when the checkout has no such file; returns whether it had to be created. */
function ensureBundled(rel, body) {
  const file = path.join(BUNDLED_ROOT, ...rel.split('/'));
  if (fs.existsSync(file)) return false;
  put(BUNDLED_ROOT, rel, body);
  created.add(file);
  return true;
}
/** Remove the files and temp trees this run created, deepest first. */
function removeCreated() {
  for (const file of [...created].reverse()) {
    try { fs.rmSync(file, { force: true }); } catch { /* best effort */ }
  }
  created.clear();
  for (const dir of [...tmpDirs].reverse()) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  tmpDirs.length = 0;
}
/** Empty directories left behind under public/assets after the created files are gone. */
function pruneEmptyDirs() {
  for (const rel of ['audio/bgm', 'audio', '']) {
    const dir = path.join(BUNDLED_ROOT, ...rel.split('/').filter(Boolean));
    try {
      if (fs.existsSync(dir) && !fs.readdirSync(dir).length) fs.rmdirSync(dir);
    } catch { /* another test may be using it */ }
  }
}

/** An http server around the static handler, on an ephemeral port. */
function serve({ assetsDir, assetIndex = null }) {
  const handler = createStaticHandler({
    publicDir: PUBLIC,
    dataDir: path.join(ROOT, 'data'),
    sharedDir: path.join(ROOT, 'shared'),
    assetsDir,
    assetIndex,
    log: { info() {}, warn() {}, error() {}, debug() {} },
  });
  const srv = http.createServer((req, res) => {
    const [p, q] = req.url.split('?');
    handler(req, res, p, q || '');
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve(srv)));
}

function get(srv, url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: srv.address().port, path: url, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], cache: res.headers['cache-control'], body }));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Run `fn` against a server started with `assetsDir`, and close it + drop the temp trees afterwards. */
async function withServer(assetsDir, fn) {
  const srv = await serve({ assetsDir });
  try {
    await fn(srv);
  } finally {
    await new Promise((resolve) => srv.close(resolve));
  }
}

/** The same with a content-hash index over `assetsDir` (0.3.0: the index reads the external directory). */
async function withIndexedServer(assetsDir, fn) {
  const index = createAssetIndex({ publicDir: PUBLIC, rootDirs: { assets: assetsDir }, delayMs: 0 });
  index.start();
  await index.whenReady();
  const srv = await serve({ assetsDir, assetIndex: index });
  try {
    await fn(srv, index);
  } finally {
    await new Promise((resolve) => srv.close(resolve));
    index.close();
  }
}

describe('assetsDir: /assets/** comes from the external art directory first, public/assets second', () => {
  test('a file of the external directory is served (and keeps the public /assets cache policy)', async () => {
    const art = mkTmp('sp-art-');
    put(art, EXTERNAL, 'external art');
    try {
      await withServer(art, async (srv) => {
        const r = await get(srv, `/assets/${EXTERNAL}`);
        assert.equal(r.status, 200);
        assert.equal(r.body, 'external art');
        assert.equal(r.type, 'audio/mpeg', 'the Content-Type follows the on-disk name');
        assert.equal(r.cache, 'public, max-age=86400', '/assets/** is cached like the public mount');
      });
    } finally {
      removeCreated();
      pruneEmptyDirs();
    }
  });

  test('a file the external directory does not hold still comes out of the bundled public/assets', async () => {
    const art = mkTmp('sp-art-');
    ensureBundled(BUNDLED, 'bundled art');
    try {
      await withServer(art, async (srv) => {
        const r = await get(srv, `/assets/${BUNDLED}`);
        assert.equal(r.status, 200);
        assert.equal(r.body, 'bundled art');
        assert.equal(r.cache, 'public, max-age=86400');
      });
    } finally {
      removeCreated();
      pruneEmptyDirs();
      assert.ok(!fs.existsSync(path.join(BUNDLED_ROOT, ...BUNDLED.split('/'))), 'the test cleaned up after itself');
    }
  });

  test('the external directory wins over the bundled file of the same name', async () => {
    const art = mkTmp('sp-art-');
    const madeHere = ensureBundled(BUNDLED, 'bundled art');
    put(art, BUNDLED, 'external override');
    try {
      await withServer(art, async (srv) => {
        assert.equal((await get(srv, `/assets/${BUNDLED}`)).body, 'external override');
      });
    } finally {
      removeCreated();
      pruneEmptyDirs();
      assert.ok(!madeHere || !fs.existsSync(path.join(BUNDLED_ROOT, ...BUNDLED.split('/'))));
    }
  });

  test('a missing subtree in the external directory falls back too', async () => {
    const art = mkTmp('sp-art-');
    ensureBundled(BUNDLED, 'bundled art');
    put(art, 'local/client/index.html', 'external index'); // the external root exists, but has no audio/ at all
    try {
      await withServer(art, async (srv) => {
        assert.equal((await get(srv, `/assets/${BUNDLED}`)).body, 'bundled art');
      });
    } finally {
      removeCreated();
      pruneEmptyDirs();
    }
  });

  test('a file in neither directory is a 404', async () => {
    const art = mkTmp('sp-art-');
    try {
      await withServer(art, async (srv) => {
        const r = await get(srv, '/assets/audio/audio-assets-dir-test-nope.mp3');
        assert.equal(r.status, 404);
        assert.match(r.body, /404/);
        assert.equal((await get(srv, '/assets/audio/audio-assets-dir-test-nope.mp3', 'HEAD')).status, 404);
      });
    } finally {
      removeCreated();
      pruneEmptyDirs();
    }
  });

  test('a traversal attempt stays refused, in the external directory and in the fallback', async () => {
    const art = mkTmp('sp-art-');
    put(art, EXTERNAL, 'external art');
    try {
      await withServer(art, async (srv) => {
        assert.equal((await get(srv, '/assets/../../package.json')).status, 403, 'dot-segments');
        assert.equal((await get(srv, '/assets/..%2f..%2fpackage.json')).status, 403, 'encoded dot-segments');
        assert.equal((await get(srv, '/assets/.hidden/secret.mp3')).status, 404, 'dotfiles');
        assert.equal((await get(srv, `/assets/${EXTERNAL}/`)).status, 404, 'a file addressed like a directory');
      });
    } finally {
      removeCreated();
      pruneEmptyDirs();
    }
  });

  test('a directory inside the external art root still answers with its index.html', async () => {
    const art = mkTmp('sp-art-');
    put(art, 'local/client/index.html', 'external index');
    try {
      await withServer(art, async (srv) => {
        assert.equal((await get(srv, '/assets/local/client/')).body, 'external index');
        assert.equal((await get(srv, '/assets/local/client')).status, 301);
      });
    } finally {
      removeCreated();
      pruneEmptyDirs();
    }
  });
});

describe('assetsDir: /media/<name> resolves in the external directory first, then public/assets', () => {
  test('extension-less BGM from the external art root', async () => {
    const art = mkTmp('sp-art-');
    put(art, EXTERNAL_BGM, 'external bgm');
    try {
      await withServer(art, async (srv) => {
        const r = await get(srv, '/media/bgm/audio-assets-dir-test-track');
        assert.equal(r.status, 200);
        assert.equal(r.body, 'external bgm');
        assert.equal(r.type, 'audio/mpeg');
        assert.equal(r.cache, 'public, max-age=86400', 'the extension-less route keeps the /assets/audio cache policy');
      });
    } finally {
      removeCreated();
      pruneEmptyDirs();
    }
  });

  test('extension-less BGM falls back to the bundled public/assets/audio', async () => {
    const art = mkTmp('sp-art-');
    const madeHere = ensureBundled(BUNDLED_BGM, 'bundled bgm');
    try {
      await withServer(art, async (srv) => {
        const r = await get(srv, '/media/bgm/audio-assets-dir-test-fallback-track');
        assert.equal(r.status, 200);
        assert.equal(r.body, 'bundled bgm');
        assert.equal(r.cache, 'public, max-age=86400');
      });
    } finally {
      removeCreated();
      pruneEmptyDirs();
      assert.ok(!madeHere || !fs.existsSync(path.join(BUNDLED_ROOT, ...BUNDLED_BGM.split('/'))));
    }
  });

  test('the external directory wins for /media/** too, and neither directory → 404', async () => {
    const art = mkTmp('sp-art-');
    const madeHere = ensureBundled(BUNDLED_BGM, 'bundled bgm');
    put(art, BUNDLED_BGM, 'external bgm override');
    try {
      await withServer(art, async (srv) => {
        assert.equal((await get(srv, '/media/bgm/audio-assets-dir-test-fallback-track')).body, 'external bgm override');
        assert.equal((await get(srv, '/media/bgm/audio-assets-dir-test-nope')).status, 404);
        assert.equal((await get(srv, '/media/../../package.json')).status, 403, 'traversal stays refused');
      });
    } finally {
      removeCreated();
      pruneEmptyDirs();
      assert.ok(!madeHere || !fs.existsSync(path.join(BUNDLED_ROOT, ...BUNDLED_BGM.split('/'))));
    }
  });
});

describe('serveDirs: the art directory is an option or SP_ASSETS_DIR', () => {
  const withEnv = (value, fn) => {
    const saved = process.env.SP_ASSETS_DIR;
    if (value === undefined) delete process.env.SP_ASSETS_DIR;
    else process.env.SP_ASSETS_DIR = value;
    try { return fn(); } finally {
      if (saved === undefined) delete process.env.SP_ASSETS_DIR;
      else process.env.SP_ASSETS_DIR = saved;
    }
  };

  test('SP_ASSETS_DIR is picked up; the option wins over it', () => {
    withEnv('D:/sp-art-env', () => {
      assert.equal(serveDirs({}).assetsDir, 'D:/sp-art-env');
      assert.equal(serveDirs({ assetsDir: 'D:/sp-art-option' }).assetsDir, 'D:/sp-art-option');
    });
    withEnv(undefined, () => {
      assert.equal(serveDirs({}).assetsDir, '', 'unset → the feature is off');
      assert.equal(serveDirs({ publicDir: '/tmp/x' }).publicDir, '/tmp/x', 'the other directories are unchanged');
    });
  });

  test('unset → the /assets mount does not exist and public/ serves the art as before', async () => {
    const art = mkTmp('sp-art-');
    put(art, EXTERNAL, 'not reached');
    try {
      await withServer('', async (srv) => {
        assert.equal((await get(srv, `/assets/${EXTERNAL}`)).status, 404, 'the external file is invisible');
        assert.equal((await get(srv, '/assets/audio/audio-assets-dir-test-bundled-only.mp3')).status, 404);
        assert.equal((await get(srv, '/index.html')).status, 200, 'the public mount keeps serving the client');
      });
    } finally {
      removeCreated();
      pruneEmptyDirs();
    }
  });
});

describe('the content-hash index reads the external art directory (0.3.0, `rootDirs`)', () => {
  test('the `assets` root hashes the external directory, not the bundled public/assets', async () => {
    const art = mkTmp('sp-art-');
    const pub = mkTmp('sp-pub-');
    put(art, 'char/avatar/x.png', 'external png');
    put(pub, 'assets/char/avatar/x.png', 'bundled png');
    const index = createAssetIndex({ publicDir: pub, rootDirs: { assets: art }, delayMs: 0 });
    index.start();
    await index.whenReady();
    try {
      assert.equal(index.hashOf('assets/char/avatar/x.png'), hash16(Buffer.from('external png')), 'the served bytes are the external ones');
      assert.equal(index.hashOf('assets/char/avatar/nope.png'), null, 'a file the directory does not hold has no hash');
    } finally {
      index.close();
    }
  });

  test('the served manifests carry those hashes and the hashed URL is immutable', async () => {
    const art = mkTmp('sp-art-');
    const dataDir = mkTmp('sp-data-');
    put(art, 'char/avatar/avatar-assets-dir-test.png', 'indexed art');
    const rel = 'assets/char/avatar/avatar-assets-dir-test.png';
    fs.writeFileSync(path.join(dataDir, 'assets.json'), JSON.stringify({ chars: { t: { avatar: '/' + rel } } }));
    const index = createAssetIndex({ publicDir: PUBLIC, rootDirs: { assets: art }, delayMs: 0 });
    index.start();
    await index.whenReady();
    const views = createManifestViews({ dataDir, index });
    try {
      const view = await views.get('assets.json');
      assert.ok(view, 'the index is ready, so there is a view');
      const hash = index.hashOf(rel);
      assert.match(view.body.toString('utf8'), new RegExp(`/assets/~${hash}/char/avatar/avatar-assets-dir-test\.png`));
      const srv = await serve({ assetsDir: art, assetIndex: index });
      try {
        const hashed = await get(srv, `/assets/~${hash}/char/avatar/avatar-assets-dir-test.png`);
        assert.equal(hashed.status, 200);
        assert.equal(hashed.body, 'indexed art');
        assert.match(hashed.cache, /immutable/, 'a URL naming the current bytes is cached for good');
        const stale = await get(srv, '/assets/~0123456789abcdef/char/avatar/avatar-assets-dir-test.png');
        assert.equal(stale.status, 200, 'another hash still serves the file');
        assert.doesNotMatch(stale.cache, /immutable/, 'but not as immutable');
      } finally {
        await new Promise((resolve) => srv.close(resolve));
      }
    } finally {
      index.close();
      removeCreated();
      pruneEmptyDirs();
    }
  });
});
