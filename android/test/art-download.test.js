// android/test/art-download.test.js — the first-launch art download (nodejs-template/assets.mjs), against a tiny real
// pack served by a local HTTP server. Run directly:  node android/test/art-download.test.js
//
// What this pins down, all of it found the hard way while building the slim variant:
//   * a pointer (`pack.json`) overrides the baked-in addresses, and every pointer failing is not an error;
//   * a pack is accepted by ART ID (`art-id.mjs`), not by app version — an app keeps the pack it already has when a
//     release only changed code — and a pack without an id falls back to the app version;
//   * a part is resumed with `Range`, and a server that ignores `Range` still ends with a correct part (the bug the
//     first version had: the wrong bytes were reported as a corrupt source and the part failed for good);
//   * a truncated part, a file that contradicts the index, and an index that contradicts the manifest are E_CORRUPT;
//   * a complete tree short-circuits the whole thing, and a wrong art id makes it download again instead of trusting it.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

import { buildArtPack } from '../scripts/pack-art.mjs';
import { writePart } from '../scripts/nodejs-template/art-container.mjs';
import { artIdFrom } from '../scripts/nodejs-template/art-id.mjs';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = path.join(APP, 'scripts', 'nodejs-template');
const {
  ensureArt, artComplete, resolvePackSource, readArtId, readPackConfig, ArtError, STATE_FILE,
} = await import(pathToFileURL(path.join(TEMPLATE, 'assets.mjs')).href);

const ART_ID = 'abcdef123456';

/** An E_CORRUPT whose message matches, with the real error printed when it does not (these are the interesting ones). */
const corrupt = (pattern) => (err) => {
  const ok = err instanceof ArtError && err.code === 'E_CORRUPT' && pattern.test(err.message);
  if (!ok) console.error('    unexpected error:', err?.code, '|', err?.message);
  return ok;
};

/**
 * A tiny art tree: enough files to make several parts, one of them large enough to be split across chunks.
 * @param {string} root
 */
async function mkArt(root) {
  // Random bytes on purpose: filler compresses to nothing, which would make the parts smaller than the resume prefix
  // this suite writes, and the truncation check meaningless.
  const files = {
    'audio/bgm/a.mp3': randomBytes(4096),
    'char/avatar/x.png': randomBytes(12288),
    'local/scene/s/scene.bin': randomBytes(20000),
    'spine/op/y.skel': randomBytes(6000),
    'ui/icon.svg': randomBytes(300),
  };
  for (const [rel, buf] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split('/'));
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, buf);
  }
  return files;
}

/**
 * A static file server for the pack directory. `ignoreRange` answers 200 with the whole body even when a Range header
 * asks for less (what a stripping proxy does); `truncate` cuts that many bytes off every part it serves.
 */
function serve(dir, { ignoreRange = false, truncate = 0, override = new Map() } = {}) {
  const state = { requests: [] };
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent((req.url || '/').split('?')[0].replace(/^\//, ''));
    state.requests.push({ name, range: req.headers.range || null });
    let body;
    if (override.has(name)) {
      const o = override.get(name);
      body = typeof o === 'string' ? Buffer.from(o, 'utf8') : o;
    } else {
      try { body = fs.readFileSync(path.join(dir, ...name.split('/'))); } catch { res.writeHead(404).end('not found'); return; }
    }
    if (truncate && name.endsWith('.part')) body = body.subarray(0, Math.max(0, body.length - truncate));
    const range = ignoreRange ? null : /bytes=(\d+)-/.exec(req.headers.range || '');
    const start = range ? Number(range[1]) : 0;
    const headers = { 'content-length': String(body.length - start), 'accept-ranges': ignoreRange ? 'none' : 'bytes' };
    if (range) headers['content-range'] = `bytes ${start}-${body.length - 1}/${body.length}`;
    res.writeHead(range ? 206 : 200, headers);
    res.end(body.subarray(start));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}/`,
        state,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

describe('art download (assets.mjs)', () => {
  let root;
  let artRoot;
  let packDir;
  let manifest;         // the pack's manifest, with artId
  let manifestNoId;     // the same pack, built without an art id
  let modDir;           // a staged-looking directory (asset-pack.json + data/*.json) for readPackConfig/readArtId

  before(async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), 'sp-art-dl-'));
    artRoot = path.join(root, 'art');
    packDir = path.join(root, 'pack');
    await mkArt(artRoot);
    ({ manifest } = await buildArtPack({ assetsRoot: artRoot, outDir: packDir, app: '0.2.5', partBytes: 8192, artId: ART_ID, log: () => {} }));
    ({ manifest: manifestNoId } = await buildArtPack({ assetsRoot: artRoot, outDir: path.join(root, 'pack-noid'), app: '0.2.5', partBytes: 8192, artId: '', log: () => {} }));

    // What a staged APK looks like to readPackConfig/readArtId.
    modDir = path.join(root, 'public');
    await fsp.mkdir(path.join(modDir, 'data'), { recursive: true });
    await fsp.writeFile(path.join(modDir, 'data', 'assets.json'), JSON.stringify({ hash: 'aaa111bbb222' }));
    await fsp.writeFile(path.join(modDir, 'data', 'local-assets.json'), JSON.stringify({ count: 1, groups: { scene: { s: { path: '/x' } } } }));
    await fsp.writeFile(path.join(modDir, 'asset-pack.json'), JSON.stringify({
      format: 1, app: '0.2.5', manifest: 'assets-pack-0.2.5.json',
      bases: ['https://baked.invalid/'], pointers: ['https://pointer.invalid/pack.json'],
    }));
  });

  after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  test('the pack describes itself: art id, parts, index', () => {
    assert.equal(manifest.artId, ART_ID);
    assert.equal(manifest.container, 'SPART1');
    assert.ok(manifest.parts.length >= 2, `several parts, got ${manifest.parts.length}`);
    assert.equal(manifest.fileCount, 5);
  });

  test('readPackConfig reads bases and pointers, readArtId the two manifests', () => {
    const cfg = readPackConfig({ dir: modDir });
    assert.deepEqual(cfg.bases, ['https://baked.invalid/']);
    assert.deepEqual(cfg.pointers, ['https://pointer.invalid/pack.json']);
    assert.equal(cfg.manifest, 'assets-pack-0.2.5.json');
    // The app-side reader must agree with the shared algorithm (and therefore with pack-art.mjs).
    assert.equal(readArtId(modDir), artIdFrom({ assets: { hash: 'aaa111bbb222' }, local: { count: 1, groups: { scene: { s: { path: '/x' } } } } }));
    assert.match(readArtId(modDir), /^[0-9a-f]{12}$/);
  });

  test('a pointer names where the parts are now; a dead pointer falls back to the baked list', async () => {
    const good = await serve(packDir);
    try {
      const body = JSON.stringify({ format: 1, manifest: 'assets-pack-0.2.5.json', bases: [good.url] });
      const pointer = await serve(path.join(root, 'nothing'), { override: new Map([['pack.json', body]]) });
      const viaPointer = await resolvePackSource({ pointers: [pointer.url + 'pack.json'], bases: ['https://baked.invalid/'], manifestName: 'assets-pack-0.2.5.json' });
      assert.deepEqual(viaPointer.bases, [good.url]);
      assert.equal(viaPointer.source, pointer.url + 'pack.json');
      // A pointer that 404s, one that holds nonsense, and one that hangs all end in the baked list.
      const bad = await serve(path.join(root, 'nothing'));
      const nonsense = await serve(path.join(root, 'nothing'), { override: new Map([['pack.json', '{"format":1,"bases":[]}']]) });
      const viaBaked = await resolvePackSource({ pointers: [bad.url + 'pack.json', nonsense.url + 'pack.json'], bases: ['https://baked.invalid/'], manifestName: 'assets-pack-0.2.5.json' });
      assert.deepEqual(viaBaked.bases, ['https://baked.invalid/']);
      assert.equal(viaBaked.source, 'built in');
      await pointer.close(); await bad.close(); await nonsense.close();
    } finally {
      await good.close();
    }
  });

  test('a matching art id downloads and verifies every file; a second run does nothing', async () => {
    const server = await serve(packDir);
    const artDir = path.join(root, 'art-dl');
    try {
      const res = await ensureArt({ artDir, bases: [server.url], manifestName: 'assets-pack-0.2.5.json', app: '0.2.5', artId: ART_ID, log: () => {} });
      assert.equal(res.status, 'downloaded');
      assert.equal(res.files, 5);
      for (const rel of ['audio/bgm/a.mp3', 'local/scene/s/scene.bin', 'ui/icon.svg']) {
        assert.deepEqual(await fsp.readFile(path.join(artDir, ...rel.split('/'))), await fsp.readFile(path.join(artRoot, ...rel.split('/'))), rel);
      }
      const state = JSON.parse(await fsp.readFile(path.join(artDir, STATE_FILE), 'utf8'));
      assert.equal(state.artId, ART_ID, 'the state file remembers which art it holds');
      assert.equal(state.complete, true);

      const before = server.state.requests.length;
      const again = await ensureArt({ artDir, bases: [server.url], manifestName: 'assets-pack-0.2.5.json', app: '0.2.5', artId: ART_ID, log: () => {} });
      assert.equal(again.status, 'complete');
      assert.equal(again.bytes, 0);
      // The fast path: a complete tree costs no request at all (a build that now needs the index for verification can
      // still ask for it — SP_ART_VERIFY=1).
      assert.equal(server.state.requests.length, before, 'not a single request for a complete tree');
      assert.ok(await artComplete({ artDir, app: '0.2.5', artId: ART_ID }));
    } finally {
      await server.close();
    }
  });

  test('the art id decides, not the app version', async () => {
    const server = await serve(packDir);
    const artDir = path.join(root, 'art-dl');
    try {
      // Another app version, same art: the pack on the phone is reused as it is.
      const sameArt = await ensureArt({ artDir, bases: [server.url], manifestName: 'assets-pack-0.2.5.json', app: '0.2.6', artId: ART_ID, log: () => {} });
      assert.equal(sameArt.status, 'complete');
      // Another art set: refused, and the tree is not trusted any more either.
      await assert.rejects(
        () => ensureArt({ artDir, bases: [server.url], manifestName: 'assets-pack-0.2.5.json', app: '0.2.5', artId: 'ffffffffffff', log: () => {} }),
        (err) => err instanceof ArtError && err.code === 'E_CORRUPT' && /holds art abcdef123456, this build ships ffffffffffff/.test(err.message),
      );
      assert.equal(await artComplete({ artDir, app: '0.2.5', artId: 'ffffffffffff' }), false, 'a different art set is not complete');
      assert.equal(await artComplete({ artDir, artId: ART_ID }), true);
    } finally {
      await server.close();
    }
  });

  test('a pack without an art id falls back to the app version', async () => {
    const server = await serve(path.join(root, 'pack-noid'));
    try {
      const ok = await ensureArt({ artDir: path.join(root, 'art-noid'), bases: [server.url], manifestName: 'assets-pack-0.2.5.json', app: '0.2.5', artId: ART_ID, log: () => {} });
      assert.equal(ok.status, 'downloaded');
      await assert.rejects(
        () => ensureArt({ artDir: path.join(root, 'art-noid2'), bases: [server.url], manifestName: 'assets-pack-0.2.5.json', app: '9.9.9', artId: ART_ID, log: () => {} }),
        (err) => err instanceof ArtError && err.code === 'E_CORRUPT' && /names no art/.test(err.message),
      );
    } finally {
      await server.close();
    }
  });

  test('a part with bytes on disk resumes, even against a server that ignores Range', async () => {
    for (const ignoreRange of [false, true]) {
      const server = await serve(packDir, { ignoreRange });
      const artDir = path.join(root, ignoreRange ? 'art-resume-norange' : 'art-resume');
      try {
        await fsp.rm(artDir, { recursive: true, force: true });
        const part = manifest.parts[0];
        await fsp.mkdir(path.join(artDir, '.sp-tmp'), { recursive: true });
        const whole = await fsp.readFile(path.join(packDir, part.name));
        await fsp.writeFile(path.join(artDir, '.sp-tmp', part.name), whole.subarray(0, 3000));
        const res = await ensureArt({ artDir, bases: [server.url], manifestName: 'assets-pack-0.2.5.json', app: '0.2.5', artId: ART_ID, log: () => {} });
        assert.equal(res.status, 'downloaded', `ignoreRange=${ignoreRange}`);
        assert.deepEqual(await fsp.readFile(path.join(artDir, 'local', 'scene', 's', 'scene.bin')), await fsp.readFile(path.join(artRoot, 'local', 'scene', 's', 'scene.bin')));
        assert.deepEqual(await fsp.readFile(path.join(artDir, 'char', 'avatar', 'x.png')), await fsp.readFile(path.join(artRoot, 'char', 'avatar', 'x.png')));
        if (ignoreRange) assert.ok(server.state.requests.some((r) => r.range), 'it still asked for a range first');
      } finally {
        await server.close();
      }
    }
  });

  test('a truncated part, a wrong index and a wrong file are E_CORRUPT after the retry budget', async () => {
    // Truncated part.
    {
      const server = await serve(packDir, { truncate: 1000 });
      try {
        await assert.rejects(
          () => ensureArt({ artDir: path.join(root, 'art-trunc'), bases: [server.url], manifestName: 'assets-pack-0.2.5.json', app: '0.2.5', artId: ART_ID, retries: 2, log: () => {} }),
          corrupt(/expected/),
          'a part that never reaches its size must end as E_CORRUPT',
        );
        const first = server.state.requests.filter((r) => r.name === manifest.parts[0].name).length;
        assert.ok(first > 1, `the broken part is retried (${first} requests)`);
        assert.ok(server.state.requests.some((r) => r.range), 'and the retry resumes from what is on disk');
      } finally {
        await server.close();
      }
    }
    // An index whose bytes do not match the manifest's sha256.
    {
      const server = await serve(packDir, { override: new Map([['assets-index-0.2.5.json', Buffer.from('{"files":{}}')]]) });
      try {
        await assert.rejects(
          () => ensureArt({ artDir: path.join(root, 'art-badindex'), bases: [server.url], manifestName: 'assets-pack-0.2.5.json', app: '0.2.5', artId: ART_ID, log: () => {} }),
          corrupt(/index/),
        );
      } finally {
        await server.close();
      }
    }
    // A part that unpacks a file whose hash the index disagrees with.
    {
      const scratch = path.join(root, 'pack-badfile');
      await fsp.rm(scratch, { recursive: true, force: true });
      await fsp.mkdir(scratch, { recursive: true });
      const bogus = path.join(scratch, 'bogus.bin');
      const bogusBytes = Buffer.from('not the art');   // 11 B
      await fsp.writeFile(bogus, bogusBytes);
      const fake = JSON.parse(JSON.stringify(manifest));
      fake.rawBytes = bogusBytes.length;
      fake.fileCount = 1;
      fake.parts = [{ name: 'bad.part', files: 1, rawBytes: bogusBytes.length }];
      const stats = await writePart(path.join(scratch, 'bad.part'), [{ name: 'ui/icon.svg', abs: bogus }]);
      fake.parts[0].bytes = stats.bytes;
      fake.parts[0].sha256 = stats.sha256;
      const indexText = `${JSON.stringify({ format: 1, app: '0.2.5', artId: ART_ID, count: 1, rawBytes: bogusBytes.length, files: { 'ui/icon.svg': [bogusBytes.length, 'f'.repeat(64)] } })}\n`;
      await fsp.writeFile(path.join(scratch, 'assets-pack-0.2.5.json'), JSON.stringify(fake));
      await fsp.writeFile(path.join(scratch, 'assets-index-0.2.5.json'), indexText);
      fake.index = { name: 'assets-index-0.2.5.json', bytes: Buffer.byteLength(indexText), sha256: null };
      await fsp.writeFile(path.join(scratch, 'assets-pack-0.2.5.json'), JSON.stringify(fake));
      const server = await serve(scratch);
      try {
        await assert.rejects(
          () => ensureArt({ artDir: path.join(root, 'art-badfile'), bases: [server.url], manifestName: 'assets-pack-0.2.5.json', app: '0.2.5', artId: ART_ID, retries: 1, log: () => {} }),
          corrupt(/wrong sha256/),
        );
      } finally {
        await server.close();
      }
    }
  });

  test('an unreachable source is E_NETWORK, and a missing config is E_CONFIG', async () => {
    await assert.rejects(
      () => ensureArt({ artDir: path.join(root, 'art-dead'), bases: ['http://127.0.0.1:9/'], manifestName: 'assets-pack-0.2.5.json', app: '0.2.5', artId: ART_ID, retries: 1, log: () => {} }),
      (err) => err instanceof ArtError && err.code === 'E_NETWORK',
    );
    await assert.rejects(() => ensureArt({ artDir: path.join(root, 'art-cfg'), bases: [], manifestName: 'x.json' }), (err) => err.code === 'E_CONFIG');
    await assert.rejects(() => ensureArt({ artDir: '', bases: ['http://127.0.0.1:9/'], manifestName: 'x.json' }), (err) => err.code === 'E_CONFIG');
  });
});
