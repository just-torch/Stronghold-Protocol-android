// android/test/art-pack.test.js — checks for the art pack tooling (SPART1 container, art set, packer).
//
// Run directly:  cd android && node test/art-pack.test.js
//
// Everything here runs on a small temporary fixture tree (a few files, a few kB): the real art is 660 MB and must
// never be packed by a test. The fixture exercises the container's edge cases — several records, an empty file, a
// unicode/space name, a multi-chunk record and a record whose payload ends exactly on a chunk boundary — and then
// the packer's plumbing (index/manifest vs. the parts actually on disk, three-digit part names, the plan's part
// limit) through the same exported functions the CLI calls.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

import {
  CONTAINER, HEADER_BYTES, DEFAULT_CODEC, writePart, readPart,
} from '../scripts/nodejs-template/art-container.mjs';
import { ASSETS_REL, isPrunedAsset, listArtFiles } from '../scripts/art-set.mjs';
import {
  buildArtPack, planParts, parseArgs, writeAssetPackJson, readAppVersion, pointerPayload, readArtId,
} from '../scripts/pack-art.mjs';
import { canonicalJson, artIdFrom } from '../scripts/nodejs-template/art-id.mjs';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(APP, '..');
const PACKER = path.join(APP, 'scripts', 'pack-art.mjs');

/** Sizes chosen around the 1 MiB defaults of the chunked writer/reader. */
const SIZE = {
  small: 137,
  medium: 900,
  multiChunk: 1_300_000, // spans several 1 MiB reads on the way out
  boundary: 4096,
};

/** Deterministic, incompressible-ish bytes: a gzip stream must not be able to hide a truncation. */
function pattern(seed, size) {
  const buf = Buffer.alloc(size);
  let x = (seed * 2654435761) >>> 0;
  for (let i = 0; i < size; i++) {
    x = (x * 1664525 + 1013904223) >>> 0;
    buf[i] = (x >>> 24) & 0xff;
  }
  return buf;
}

async function mkFixture(root) {
  const assets = path.join(root, 'assets');
  const files = [
    { rel: 'band/band_amiya.png', data: pattern(1, SIZE.small) },
    { rel: 'char/char 001/立绘 阿米娅.webp', data: pattern(2, SIZE.medium) },
    { rel: 'local/scene/lm0.png', data: pattern(3, 10_000) }, // pruned: a lightmap source beside the .webp
    { rel: 'local/scene/act1autochess_m01/lm0.png', data: pattern(4, 4096) }, // pruned
    { rel: 'local/scene/act1autochess_m01/lm0.webp', data: pattern(5, 2048) },
    { rel: 'ui/empty.bin', data: Buffer.alloc(0) },
    { rel: 'ui/多字节名称.bin', data: pattern(6, SIZE.multiChunk) },
    { rel: 'ui/boundary.bin', data: pattern(7, SIZE.boundary) },
    { rel: 'enemy/nested/deep/leaf.dat', data: pattern(8, SIZE.small) },
  ];
  for (const file of files) {
    const abs = path.join(assets, file.rel);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, file.data);
  }
  return { assets, files };
}

const byRel = (files) => new Map(files.map((f) => [f.rel, f.data]));

/** Write a part and read it straight back, asserting the payloads byte for byte. */
async function roundTrip(outPath, entries) {
  const written = await writePart(outPath, entries.map(({ rel, data }) => ({ name: rel, abs: data })));
  const read = [];
  for await (const record of readPart(outPath)) read.push(record);
  return { written, read };
}

describe('art container (SPART1)', () => {
  let root;
  let assets;
  let files;
  let parts;

  before(async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), 'sp-art-test-'));
    parts = path.join(root, 'parts');
    await fsp.mkdir(parts, { recursive: true });
    ({ assets, files } = await mkFixture(root));
  });

  after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  test('constants are the frozen format', () => {
    assert.equal(CONTAINER, 'SPART1');
    assert.equal(HEADER_BYTES, 20);
    assert.equal(DEFAULT_CODEC, 'gzip');
  });

  test('round-trips several records, an empty file and a unicode name byte for byte', async () => {
    const all = files.map((f) => ({ rel: f.rel, data: path.join(assets, f.rel) }));
    const part = path.join(parts, 'roundtrip.part');
    const { written, read } = await roundTrip(part, [{ rel: 'band/band_amiya.png', data: path.join(assets, 'band/band_amiya.png') }]);

    // Single file first: the digest and the byte count describe the file on disk.
    assert.equal(written.files, 1);
    assert.equal(written.rawBytes, SIZE.small);
    assert.equal(written.bytes, (await fsp.stat(part)).size);
    assert.equal(written.sha256, createHash('sha256').update(await fsp.readFile(part)).digest('hex'));
    assert.equal(written.sha256, await sha256Of(part));

    // Now all of them, in the same order listArtFiles would produce, including the multi-chunk record.
    const multi = path.join(parts, 'all.part');
    const expected = new Map(files.map((f) => [f.rel, f.data]));
    const result = await roundTrip(multi, all);
    assert.equal(result.written.files, all.length);
    assert.equal(result.written.rawBytes, files.reduce((sum, f) => sum + f.data.length, 0));
    assert.equal(result.read.length, all.length);
    for (let i = 0; i < all.length; i++) {
      assert.equal(result.read[i].name, all[i].rel, `record ${i} name`);
      assert.deepEqual(result.read[i].data, expected.get(all[i].rel), `record ${i} payload`);
    }
    assert.equal(result.written.bytes, (await fsp.stat(multi)).size);

    // The large record read back whole, not truncated by the 1 MiB chunking.
    const big = result.read.find((r) => r.name === 'ui/多字节名称.bin');
    assert.equal(big.data.length, SIZE.multiChunk);
    assert.equal(big.data.length, expected.get('ui/多字节名称.bin').length);
  });

  test('an empty file is a valid record of length 0', async () => {
    const part = path.join(parts, 'empty.part');
    const abs = path.join(assets, 'ui/empty.bin');
    const { written, read } = await roundTrip(part, [{ rel: 'ui/empty.bin', data: abs }]);
    assert.equal(written.rawBytes, 0);
    assert.equal(read.length, 1);
    assert.equal(read[0].data.length, 0);
  });

  test('a record bigger than the reader’s internal chunk (8 MiB) is reassembled exactly', async () => {
    // The reader assembles a payload from 8 MiB pieces, so a >8 MiB record is its own case (kept out of the shared
    // fixture: it is the one big file in the whole suite, and it is deleted again right away).
    const big = 9 * 1024 * 1024 + 7;
    const dir = path.join(root, 'big');
    await fsp.mkdir(dir, { recursive: true });
    const abs = path.join(dir, 'big.bin');
    const data = pattern(99, big);
    await fsp.writeFile(abs, data);
    const part = path.join(dir, 'big.part');
    const written = await writePart(part, [{ name: 'ui/big.bin', abs }]);
    assert.equal(written.rawBytes, big);
    const records = [];
    for await (const record of readPart(part)) records.push(record);
    assert.equal(records.length, 1);
    assert.equal(records[0].data.length, big);
    assert.ok(records[0].data.equals(data), 'the >8 MiB payload survives the chunked read');
    await fsp.rm(dir, { recursive: true, force: true });
  });

  test('the written bytes are one gzip member around the documented record stream', async () => {
    const part = path.join(parts, 'empty.part');
    const plain = gunzipSync(await fsp.readFile(part));
    assert.equal(plain.subarray(0, 6).toString('latin1'), 'SPART1');
    assert.equal(plain.readUInt16LE(6), 1);
    assert.equal(plain.readUInt32LE(8), 1); // fileCount
    assert.equal(plain.readUInt32LE(12), 0); // rawBytes
    assert.equal(plain.readUInt32LE(16), 0); // flags
    assert.equal(plain.readUInt32LE(HEADER_BYTES), Buffer.byteLength('ui/empty.bin'));
    const nameStart = HEADER_BYTES + 4;
    const nameEnd = nameStart + Buffer.byteLength('ui/empty.bin');
    assert.equal(plain.subarray(nameStart, nameEnd).toString('utf8'), 'ui/empty.bin');
    assert.equal(plain.readUInt32LE(nameEnd), 0); // dataLen
    assert.equal(plain.readUInt32LE(nameEnd + 4), 0); // end marker
    assert.equal(plain.length, nameEnd + 8, 'nothing after the end marker');
  });

  test('a record payload ending exactly on a chunk boundary survives the round trip', async () => {
    const part = path.join(parts, 'boundary.part');
    const entries = [
      { rel: 'ui/boundary.bin', data: path.join(assets, 'ui/boundary.bin') },
      { rel: 'enemy/nested/deep/leaf.dat', data: path.join(assets, 'enemy/nested/deep/leaf.dat') },
      { rel: 'ui/empty.bin', data: path.join(assets, 'ui/empty.bin') },
    ];
    const { read } = await roundTrip(part, entries);
    for (let i = 0; i < entries.length; i++) {
      assert.equal(read[i].name, entries[i].rel);
      assert.deepEqual(read[i].data, await fsp.readFile(entries[i].data));
    }
  });

  test('a header only part (no records) reads back as empty', async () => {
    const part = path.join(parts, 'none.part');
    await writePart(part, []);
    const read = [];
    for await (const record of readPart(part)) read.push(record);
    assert.deepEqual(read, []);
  });

  test('a truncated record throws a descriptive error', async () => {
    const part = path.join(parts, 'truncated.part');
    const nameLen = Buffer.byteLength('x/y.bin');
    await writePart(part, [{ name: 'x/y.bin', abs: path.join(assets, 'band/band_amiya.png') }]);
    const plain = gunzipSync(await fsp.readFile(part));
    plain.writeUInt32LE(9999, HEADER_BYTES + 4 + nameLen); // claim more data than the part holds
    await fsp.writeFile(part, gzipSync(plain));
    await assert.rejects(collect(readPart(part)), /truncated/i);
  });

  test('a declared record count larger than the stream throws', async () => {
    const part = path.join(parts, 'mismatch.part');
    await writePart(part, [{ name: 'x/y.bin', abs: path.join(assets, 'band/band_amiya.png') }]);
    const plain = gunzipSync(await fsp.readFile(part));
    plain.writeUInt32LE(7, 8); // fileCount = 7, but only one record follows
    await fsp.writeFile(part, gzipSync(plain));
    await assert.rejects(collect(readPart(part)), /truncated/i);
  });

  test('a part whose records end without the end marker throws', async () => {
    const part = path.join(parts, 'noend.part');
    const nameLen = Buffer.byteLength('x/y.bin');
    await writePart(part, [{ name: 'x/y.bin', abs: path.join(assets, 'band/band_amiya.png') }]);
    const plain = gunzipSync(await fsp.readFile(part));
    // Drop the end marker: the stream ends right after the last record's payload.
    const cut = HEADER_BYTES + 4 + nameLen + 4 + SIZE.small;
    assert.equal(plain.length, cut + 4);
    await fsp.writeFile(part, gzipSync(plain.subarray(0, cut)));
    await assert.rejects(collect(readPart(part)), /truncated|end marker/i);
  });

  test('a corrupt magic throws', async () => {
    const part = path.join(parts, 'magic.part');
    await writePart(part, [{ name: 'x/y.bin', abs: path.join(assets, 'band/band_amiya.png') }]);
    const plain = gunzipSync(await fsp.readFile(part));
    plain.write('XX', 0, 'latin1');
    await fsp.writeFile(part, gzipSync(plain));
    await assert.rejects(collect(readPart(part)), /magic/i);
  });

  test('trailing bytes after the end marker throw', async () => {
    const part = path.join(parts, 'trailing.part');
    await writePart(part, [{ name: 'x/y.bin', abs: path.join(assets, 'band/band_amiya.png') }]);
    const plain = gunzipSync(await fsp.readFile(part));
    await fsp.writeFile(part, gzipSync(Buffer.concat([plain, Buffer.from([0, 0, 0, 0])])));
    await assert.rejects(collect(readPart(part)), /trailing/i);
  });

  test('an unsupported version or codec throws', async () => {
    const part = path.join(parts, 'version.part');
    await writePart(part, [{ name: 'x/y.bin', abs: path.join(assets, 'band/band_amiya.png') }]);
    const plain = gunzipSync(await fsp.readFile(part));
    plain.writeUInt16LE(2, 6);
    await fsp.writeFile(part, gzipSync(plain));
    await assert.rejects(collect(readPart(part)), /version 2/i);

    await assert.rejects(
      writePart(path.join(parts, 'codec.part'), [], { codec: 'zstd' }),
      /unsupported codec "zstd"/,
    );
    await assert.rejects(collect(readPart(part, { codec: 'zstd' })), /unsupported codec "zstd"/);
  });
});

/** Consume an async generator, returning its values (its throw propagates to assert.rejects). */
async function collect(gen) {
  const out = [];
  for await (const value of gen) out.push(value);
  return out;
}

async function sha256Of(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

describe('art set', () => {
  let root;
  let assets;

  before(async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), 'sp-art-set-'));
    ({ assets } = await mkFixture(root));
  });

  after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  test('ASSETS_REL is the repository path of the art', () => {
    assert.equal(ASSETS_REL, 'public/assets');
  });

  test('the prune rule drops exactly the local/scene lightmap .png sources', () => {
    assert.equal(isPrunedAsset('local/scene/lm0.png'), true);
    assert.equal(isPrunedAsset('local/scene/act1autochess_m01/lm1.png'), true);
    assert.equal(isPrunedAsset('local/scene/act1autochess_m01/LM1.PNG'), true);
    assert.equal(isPrunedAsset('local/scene\\act1autochess_m01\\lm1.png'), true);
    assert.equal(isPrunedAsset('local/scene/act1autochess_m01/lm0.webp'), false);
    assert.equal(isPrunedAsset('local/scene/act1autochess_m01/mesh.bin'), false);
    assert.equal(isPrunedAsset('band/band_amiya.png'), false);
    assert.equal(isPrunedAsset('local/scenePNG/lm0.png'), false);
    assert.equal(isPrunedAsset('local/other/lm0.png'), false);
    assert.equal(isPrunedAsset('lm0.png'), false);
  });

  test('listArtFiles returns every unpruned regular file, sorted by rel, with sizes', async () => {
    const list = await listArtFiles(assets);
    const rels = list.map((f) => f.rel);
    assert.deepEqual(rels, [...rels].sort());
    assert.ok(!rels.some((rel) => isPrunedAsset(rel)), 'pruned files must not be listed');
    assert.ok(rels.includes('local/scene/act1autochess_m01/lm0.webp'));
    assert.ok(rels.includes('char/char 001/立绘 阿米娅.webp'));
    for (const file of list) {
      assert.equal(file.abs, path.join(assets, ...file.rel.split('/')));
      assert.equal(file.size, (await fsp.stat(file.abs)).size);
    }
    // The fixture has 9 files, 2 of them pruned.
    assert.equal(list.length, 7);
  });

  test('a missing directory is an error, not an empty list', async () => {
    await assert.rejects(listArtFiles(path.join(root, 'nope')), /no such directory/);
  });
});

describe('art packer', () => {
  let root;
  let assets;
  let outDir;
  let fixtureFiles;

  before(async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), 'sp-art-pack-'));
    outDir = path.join(root, 'out');
    ({ assets, files: fixtureFiles } = await mkFixture(root));
  });

  after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  test('the part plan fills up to the limit and gives a big file a part of its own', () => {
    const f = (rel, size) => ({ rel, abs: rel, size });
    const parts = planParts([f('a', 10), f('b', 10), f('c', 10), f('d', 10)], 25);
    assert.deepEqual(parts.map((p) => p.files.map((x) => x.rel)), [['a', 'b'], ['c', 'd']]);
    assert.deepEqual(parts.map((p) => p.rawBytes), [20, 20]);

    const big = planParts([f('a', 10), f('huge', 100), f('b', 10)], 25);
    assert.deepEqual(big.map((p) => p.files.map((x) => x.rel)), [['a'], ['huge'], ['b']]);

    assert.deepEqual(planParts([], 25), []);
    // A file larger than the limit is the only member of its part, even as the first file.
    assert.deepEqual(planParts([f('huge', 100), f('a', 1)], 25).map((p) => p.rawBytes), [100, 1]);
  });

  test('CLI parsing takes repeated --base, both spellings, and rejects junk', () => {
    assert.deepEqual(parseArgs(['--out', 'x', '--part-bytes=1234', '--base', 'a', '--base', 'b,c', '--dry-run']), {
      out: 'x', 'part-bytes': '1234', base: 'a,b,c', 'dry-run': true,
    });
    assert.throws(() => parseArgs(['nope']), /unexpected argument/);
    assert.throws(() => parseArgs(['--dry-run=1']), /does not take a value/);
    assert.throws(() => parseArgs(['--out']), /needs a value/);
  });

  test('the app version comes from android/package.json', async () => {
    const version = await readAppVersion();
    const pkg = JSON.parse(await fsp.readFile(path.join(APP, 'package.json'), 'utf8'));
    assert.equal(version, String(pkg.version));
  });

  test('a tiny pack: index and manifest agree with the parts on disk', async () => {
    const { manifest } = await buildArtPack({
      assetsRoot: assets,
      outDir,
      app: '9.9.9',
      partBytes: 4096,
      manifestName: 'assets-pack-9.9.9.json',
    });

    const shipped = await listArtFiles(assets);
    const rawTotal = shipped.reduce((sum, f) => sum + f.size, 0);

    // file names: three digits from 000, index/manifest named after the app
    assert.equal(manifest.format, 1);
    assert.equal(manifest.app, '9.9.9');
    assert.equal(manifest.container, 'SPART1');
    assert.equal(manifest.codec, 'gzip');
    assert.equal(manifest.fileCount, shipped.length);
    assert.equal(manifest.rawBytes, rawTotal);
    assert.equal(manifest.parts[0].name, 'assets-pack-9.9.9-000.part');
    assert.equal(manifest.index.name, 'assets-index-9.9.9.json');
    assert.ok(manifest.parts.length > 1, 'a 4 kB limit must split this fixture into several parts');
    for (const [i, part] of manifest.parts.entries()) {
      assert.equal(part.name, `assets-pack-9.9.9-${String(i).padStart(3, '0')}.part`);
      assert.ok(part.bytes > 0, `${part.name} has bytes`);
      assert.ok(part.rawBytes > 0, `${part.name} has a raw size`);
      assert.ok(part.files >= 1, `${part.name} has a file count`);
    }
    // A part may exceed the limit only when it is a single file.
    for (const part of manifest.parts) {
      if (part.rawBytes > 4096) assert.equal(part.files, 1, 'only a single oversized file may exceed --part-bytes');
    }
    assert.equal(manifest.partBytes, manifest.parts.reduce((sum, p) => sum + p.bytes, 0));

    // the manifest file on disk is what we validated
    const onDisk = JSON.parse(await fsp.readFile(path.join(outDir, 'assets-pack-9.9.9.json'), 'utf8'));
    assert.deepEqual(onDisk, manifest);

    // the index lists exactly the shipped files, with the real size and sha256
    const index = JSON.parse(await fsp.readFile(path.join(outDir, manifest.index.name), 'utf8'));
    assert.equal(index.format, 1);
    assert.equal(index.app, '9.9.9');
    assert.equal(index.count, shipped.length);
    assert.equal(index.rawBytes, rawTotal);
    assert.deepEqual(Object.keys(index.files), shipped.map((f) => f.rel));
    for (const file of shipped) {
      const [size, sha] = index.files[file.rel];
      assert.equal(size, file.size, `${file.rel} size`);
      assert.equal(sha, await sha256Of(file.abs), `${file.rel} sha256`);
    }
    assert.equal(await sha256Of(path.join(outDir, manifest.index.name)), manifest.index.sha256);
    assert.equal((await fsp.stat(path.join(outDir, manifest.index.name))).size, manifest.index.bytes);

    // every part: hash it, read it back and check every record against the index
    const seen = new Set();
    let partRaw = 0;
    let partFiles = 0;
    for (const part of manifest.parts) {
      const abs = path.join(outDir, part.name);
      assert.equal((await fsp.stat(abs)).size, part.bytes, `${part.name} size`);
      assert.equal(await sha256Of(abs), part.sha256, `${part.name} sha256`);
      let files = 0;
      for await (const record of readPart(abs)) {
        files++;
        partRaw += record.data.length;
        const entry = index.files[record.name];
        assert.ok(entry, `${record.name} is listed in the index`);
        assert.equal(record.data.length, entry[0], `${record.name} size matches the index`);
        assert.equal(createHash('sha256').update(record.data).digest('hex'), entry[1], `${record.name} sha256 matches the index`);
        assert.ok(!seen.has(record.name), `${record.name} appears in only one part`);
        seen.add(record.name);
        const onDiskBytes = await fsp.readFile(path.join(assets, ...record.name.split('/')));
        assert.deepEqual(record.data, onDiskBytes, `${record.name} content is byte-identical`);
      }
      assert.equal(files, part.files, `${part.name} file count`);
      partFiles += files;
    }
    assert.equal(seen.size, shipped.length, 'every shipped file came out of exactly one part');
    assert.equal(partRaw, rawTotal, 'the parts hold exactly the raw bytes the manifest claims');
    assert.equal(partFiles, manifest.fileCount);

    // Nothing that should have been pruned is in the index or in the parts.
    for (const rel of Object.keys(index.files)) assert.ok(!isPrunedAsset(rel), `${rel} must not ship`);
    assert.ok(!seen.has('local/scene/lm0.png'));
  });

  test('asset-pack.json is static apart from the fields it is given', async () => {
    const file = path.join(root, 'asset-pack.json');
    const { payload } = await writeAssetPackJson({ app: '9.9.9', bases: ['https://a.invalid/', 'https://b.invalid/'], manifestName: 'assets-pack-9.9.9.json', file });
    assert.deepEqual(payload, { format: 1, app: '9.9.9', manifest: 'assets-pack-9.9.9.json', bases: ['https://a.invalid/', 'https://b.invalid/'], pointers: [] });
    assert.deepEqual(JSON.parse(await fsp.readFile(file, 'utf8')), payload);

    // The pointer URLs the app reads before it uses the baked-in bases (moving the parts without a new APK).
    const withPointers = await writeAssetPackJson({
      app: '9.9.9', bases: ['https://a.invalid/'], manifestName: 'assets-pack-9.9.9.json', file,
      pointers: ['https://p.invalid/pack.json', 'https://q.invalid/pack.json'],
    });
    assert.deepEqual(withPointers.payload.pointers, ['https://p.invalid/pack.json', 'https://q.invalid/pack.json']);
  });

  test('the pack names the art it holds, and the pointer payload is the small subset the app reads', async () => {
    const { manifest } = await buildArtPack({ assetsRoot: assets, outDir, app: '9.9.9', partBytes: 1 << 20, artId: 'abcdef123456', log: () => {} });
    assert.equal(manifest.artId, 'abcdef123456', 'the art id lands in the manifest');
    assert.equal(manifest.app, '9.9.9', 'and the app version stays as information');
    const index = JSON.parse(await fsp.readFile(path.join(outDir, manifest.index.name), 'utf8'));
    assert.equal(index.artId, 'abcdef123456', 'and in the index too');
    assert.deepEqual(pointerPayload({ app: '9.9.9', manifestName: manifest.index.name, bases: ['https://a.invalid/'] }), {
      format: 1, app: '9.9.9', manifest: manifest.index.name, bases: ['https://a.invalid/'],
    });
  });

  test('the art id ignores formatting, follows content, and covers the local overlay', () => {
    // Same documents, different key order / whitespace → same id (a reformat must not invalidate a pack on phones).
    const a = artIdFrom({ assets: { hash: 'aaa111bbb222' }, local: { count: 2, groups: { scene: { a: { path: '/x' }, b: { path: '/y' } } } } });
    const b = artIdFrom({ assets: { hash: 'aaa111bbb222' }, local: { groups: { scene: { b: { path: '/y' }, a: { path: '/x' } } }, count: 2 } });
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{12}$/);
    // A different official manifest, or a different local overlay, is a different art set.
    assert.notEqual(a, artIdFrom({ assets: { hash: 'aaa111bbb223' }, local: { count: 2, groups: { scene: { a: { path: '/x' }, b: { path: '/y' } } } } }));
    assert.notEqual(a, artIdFrom({ assets: { hash: 'aaa111bbb222' }, local: { count: 3, groups: { scene: { a: { path: '/x' }, b: { path: '/y' } } } } }));
    assert.notEqual(a, artIdFrom({ assets: { hash: 'aaa111bbb222' }, local: { count: 2, groups: { scene: { a: { path: '/x' } } } } }));
    // No manifest at all → no id (the app then falls back to comparing app versions).
    assert.equal(artIdFrom({}), '');
    assert.equal(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}');
    // The repository's own manifests have one, and it is what pack-art writes.
    const real = readArtId(REPO);
    assert.match(real, /^[0-9a-f]{12}$/, `data/assets.json + data/local-assets.json must yield an art id, got ${real}`);
  });

  test('the CLI --help path works end to end', () => {
    const res = spawnSync(process.execPath, [PACKER, '--help'], { cwd: REPO, encoding: 'utf8' });
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /--part-bytes/);
    assert.match(res.stdout, /--manifest-name/);
  });

  test('the real repository layout is what the packer assumes', () => {
    // public/assets exists in a prepared checkout; the packer resolves it from its own location.
    assert.equal(path.resolve(REPO, ASSETS_REL), path.join(REPO, 'public', 'assets'));
    assert.ok(fs.existsSync(path.join(APP, 'scripts', 'nodejs-template', 'art-container.mjs')));
  });
});
