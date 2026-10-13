// android/scripts/nodejs-template/art-container.mjs — reader/writer for the SPART1 art container (frozen format).
//
// One container file = one .part of the downloadable art pack. The whole file is a single gzip member wrapping a
// record stream (no tar: no name-length limits, trivial to write and to stream back):
//
//   header:  "SPART1" (6) | u16le version=1 | u32le fileCount | u32le rawBytes | u32le flags=0        (20 bytes)
//   record:  u32le nameLen | name (utf8, '/'-separated path under assets/) | u32le dataLen | data
//   end:     u32le 0
//
// This file is copied verbatim into the app's staged tree by android/scripts/assemble-nodejs.mjs (the downloader
// unpacks the parts with readPart), so it must stay dependency-free: `node:` builtins only, no imports of anything
// else in this repository.
//
// Spec: .scratch/slim-art-design.md §2 (container), §3 (the downloader consumes exactly these bytes).

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { createGunzip, createGzip } from 'node:zlib';

/** Magic of the container's plaintext header. */
export const CONTAINER = 'SPART1';
/** Bytes of that header: 6 magic + u16le version + u32le fileCount + u32le rawBytes + u32le flags. */
export const HEADER_BYTES = 20;
/** Codec of the container. Only gzip is implemented (the embedded Node build may lack zstd). */
export const DEFAULT_CODEC = 'gzip';

const VERSION = 1;
const U32_MAX = 0xffffffff;
const MAGIC = Buffer.from(CONTAINER, 'latin1');
/**
 * Refuse records larger than this (a corrupt u32le could otherwise ask for 4 GiB). Parts hold 64 MiB of raw payload,
 * so a single-record part is at most that; the downloader streams such a record in `need()`'s chunks.
 */
const RECORD_LIMIT = 64 * 1024 * 1024;
/**
 * How much of a record is pulled from the decompressor at a time. Records are read (and written) in pieces so a
 * single large file never has to fit in memory whole.
 */
const CHUNK_BYTES = 8 * 1024 * 1024;
/** Names are paths under assets/; the filesystem cannot produce one anywhere near this. */
const MAX_NAME_BYTES = 64 * 1024;

/**
 * @typedef {{ name: string, abs: string }} PartEntry  one file to put into a part
 * @typedef {{ bytes: number, files: number, rawBytes: number, sha256: string }} PartStats  result of writePart()
 */

/** Reject anything but the one implemented codec, with a message the caller can act on. */
function checkCodec(codec) {
  if (codec !== DEFAULT_CODEC) {
    throw new Error(`art-container: unsupported codec ${JSON.stringify(codec)} — only ${JSON.stringify(DEFAULT_CODEC)} is implemented`);
  }
}

/** A 20-byte plaintext header for `fileCount` records carrying `rawBytes` payload bytes. */
function header(fileCount, rawBytes) {
  const buf = Buffer.alloc(HEADER_BYTES);
  MAGIC.copy(buf, 0);
  buf.writeUInt16LE(VERSION, 6);
  buf.writeUInt32LE(fileCount, 8);
  buf.writeUInt32LE(rawBytes, 12);
  buf.writeUInt32LE(0, 16); // flags
  return buf;
}

/**
 * Write `entries` into one container file at `outPath`.
 *
 * The file contents are streamed (a 64 MiB part never sits in memory whole) and the digest is computed over the
 * bytes actually written to disk, so the returned values describe the finished file.
 *
 * @param {string} outPath  part file to create/overwrite
 * @param {PartEntry[]} entries  files to store, in order; `name` is the stored '/'-separated path
 * @param {{ codec?: string }} [opts]
 * @returns {Promise<PartStats>}
 */
export async function writePart(outPath, entries, { codec = DEFAULT_CODEC } = {}) {
  checkCodec(codec);
  if (!Array.isArray(entries)) throw new Error('art-container: writePart() expects an array of { name, abs } entries');

  let rawBytes = 0;
  const sizes = [];
  for (const entry of entries) {
    const name = entry?.name;
    const abs = entry?.abs;
    if (typeof name !== 'string' || name === '') throw new Error('art-container: every entry needs a non-empty string name');
    const nameBytes = Buffer.byteLength(name, 'utf8');
    if (nameBytes > MAX_NAME_BYTES) throw new Error(`art-container: entry name is too long (${nameBytes} bytes): ${name}`);
    if (typeof abs !== 'string' || abs === '') throw new Error(`art-container: entry ${name} needs an absolute path`);
    const stat = await fsp.stat(abs);
    if (!stat.isFile()) throw new Error(`art-container: not a regular file: ${abs}`);
    if (stat.size > RECORD_LIMIT) throw new Error(`art-container: ${abs} is ${stat.size} bytes — a record cannot exceed ${RECORD_LIMIT}`);
    sizes.push(stat.size);
    rawBytes += stat.size;
    if (rawBytes > U32_MAX) throw new Error('art-container: a part cannot hold more than 4 GiB of raw payload (lower --part-bytes)');
  }

  // Header, records and the end marker go into one gzip member; the file gets nothing but that member's bytes.
  //
  // The pipeline is manual (not `.pipe()`) so that every stage can be awaited before returning: framing → gzip →
  // file. Each stage writes into the next one only after `drain`, so a 64 MiB part never sits in memory, and a
  // failure anywhere lands in one of the stage promises instead of becoming an unhandled 'error'.
  const out = fs.createWriteStream(outPath);
  const gzip = createGzip();
  const framing = new PassThrough();
  const digest = createHash('sha256');
  let bytes = 0;

  const pumpGzip = (async () => {
    for await (const chunk of gzip) {
      bytes += chunk.length; // exactly the bytes that end up in the file
      digest.update(chunk);
      if (!out.write(chunk)) await once(out, 'drain');
    }
    out.end();
    await once(out, 'close'); // the digest and `bytes` are only complete once the file is closed
  })().catch((err) => {
    framing.destroy();
    throw err;
  });
  const pumpFraming = (async () => {
    for await (const chunk of framing) {
      if (!gzip.write(chunk)) await once(gzip, 'drain');
    }
    gzip.end();
  })().catch((err) => {
    framing.destroy();
    throw err;
  });
  // `pumpFraming` awaits what it can; these keep a rejection from being reported as unhandled.
  pumpGzip.catch(() => {});
  pumpFraming.catch(() => {});
  out.on('error', () => framing.destroy()); // the write stage reports it; stop the producer too

  /** Hand one framing chunk to the pump, waiting for it when the compressor/disk is behind. */
  const emit = (chunk) => {
    if (framing.write(chunk)) return null;
    return Promise.race([once(framing, 'drain').then(() => null), pumpGzip, pumpFraming]);
  };

  /** Await a backpressure wait and rethrow whatever broke, if anything. */
  const settle = async (waiting) => {
    const err = waiting ? await waiting : null;
    if (err) throw err;
  };

  await settle(emit(header(entries.length, rawBytes)));
  for (let i = 0; i < entries.length; i++) {
    const name = entries[i].name;
    const nameBytes = Buffer.byteLength(name, 'utf8');
    const head = Buffer.alloc(8 + nameBytes);
    head.writeUInt32LE(nameBytes, 0);
    head.write(name, 4, 'utf8');
    head.writeUInt32LE(sizes[i], 4 + nameBytes);
    await settle(emit(head));
    if (sizes[i] > 0) {
      for await (const chunk of fs.createReadStream(entries[i].abs)) await settle(emit(chunk));
    }
  }
  await settle(emit(Buffer.alloc(4))); // u32le 0 — end marker
  framing.end(); // the two pumps flush gzip and close the file

  await pumpFraming;
  await pumpGzip;

  return { bytes, files: entries.length, rawBytes, sha256: digest.digest('hex') };
}

/**
 * Stream the records of a container file back out.
 *
 * Yields `{ name, data }` in stored order, with `data` a Buffer holding exactly that record's bytes. Nothing more
 * than the current record is held in memory. Throws a descriptive Error when the file is not a well-formed SPART1
 * container: bad magic, unsupported version, truncated record, record-count mismatch, missing end marker or
 * trailing bytes after the end marker.
 *
 * @param {string} partPath
 * @param {{ codec?: string }} [opts]
 * @returns {AsyncGenerator<{ name: string, data: Buffer }>}
 */
export async function* readPart(partPath, { codec = DEFAULT_CODEC } = {}) {
  checkCodec(codec);

  const src = fs.createReadStream(partPath);
  const gunzip = createGunzip();
  const stream = src.pipe(gunzip);

  let broken = null;
  src.on('error', (err) => { broken ??= err; });
  gunzip.on('error', (err) => { broken ??= err; });

  const it = stream[Symbol.asyncIterator]();

  /** Next decompressed chunk, or a hard failure (a broken gzip member is not a clean end of stream). */
  const pull = async () => {
    let next;
    try {
      next = await it.next();
    } catch (err) {
      broken ??= err;
      return null;
    }
    if (next.done) return null;
    return Buffer.from(next.value);
  };

  try {
    const first = await pull();
    if (first === null) {
      throw new Error(`art-container: ${partPath} is empty or not a gzip stream`, { cause: broken ?? undefined });
    }
    if (first.length < HEADER_BYTES) {
      throw new Error(`art-container: ${partPath} is too short to hold a header (${first.length} bytes)`);
    }
    if (!first.subarray(0, MAGIC.length).equals(MAGIC)) {
      const got = first.subarray(0, MAGIC.length).toString('latin1');
      throw new Error(`art-container: bad magic in ${partPath} — expected ${CONTAINER}, got ${JSON.stringify(got)}`);
    }
    const version = first.readUInt16LE(6);
    if (version !== VERSION) {
      throw new Error(`art-container: unsupported container version ${version} in ${partPath} — this build reads version ${VERSION}`);
    }
    const fileCount = first.readUInt32LE(8);
    const flags = first.readUInt32LE(16);
    if (flags !== 0) throw new Error(`art-container: unsupported flags 0x${flags.toString(16)} in ${partPath}`);

    let buf = first.subarray(HEADER_BYTES); // bytes of the current chunk not consumed yet

    /** Exactly `n` bytes of the record stream (small fields only: name lengths, data lengths, the end marker). */
    const need = async (n, what) => {
      if (n > MAX_NAME_BYTES) throw new Error(`art-container: ${partPath} declares an implausible ${what} of ${n} bytes`);
      while (buf.length < n) {
        const chunk = await pull();
        if (chunk === null) {
          throw new Error(`art-container: ${partPath} is truncated (${what} of ${n} bytes, only ${buf.length} available)`, { cause: broken ?? undefined });
        }
        buf = buf.length === 0 ? chunk : Buffer.concat([buf, chunk]);
      }
      const taken = buf.subarray(0, n);
      buf = buf.subarray(n);
      return taken;
    };

    /**
     * One record's payload of `n` bytes, assembled in `CHUNK_BYTES` pieces so a large file is never held twice.
     * `null` means the stream ended before `n` bytes arrived (a truncated part).
     */
    const readData = async (n, what) => {
      if (n > RECORD_LIMIT) throw new Error(`art-container: ${partPath} declares an implausible ${what} of ${n} bytes`);
      if (n === 0) return { data: Buffer.alloc(0), missing: 0 };
      const parts = [];
      let left = n;
      while (left > 0) {
        const want = Math.min(left, CHUNK_BYTES);
        while (buf.length < want) {
          const chunk = await pull();
          if (chunk === null) return { data: null, missing: left };
          buf = buf.length === 0 ? chunk : Buffer.concat([buf, chunk]);
        }
        parts.push(buf.subarray(0, want));
        buf = buf.subarray(want);
        left -= want;
      }
      return { data: parts.length === 1 ? Buffer.from(parts[0]) : Buffer.concat(parts, n), missing: 0 };
    };

    for (let i = 0; i < fileCount; i++) {
      const nameLen = (await need(4, `record ${i} name length`)).readUInt32LE(0);
      if (nameLen > MAX_NAME_BYTES) throw new Error(`art-container: ${partPath} record ${i} declares a ${nameLen}-byte name`);
      const name = (await need(nameLen, `record ${i} name`)).toString('utf8');
      const dataLen = (await need(4, `record ${i} data length`)).readUInt32LE(0);
      const { data, missing } = await readData(dataLen, `record ${i} data`);
      if (data === null) {
        throw new Error(`art-container: ${partPath} is truncated (record ${i} "${name}" needs ${dataLen} bytes, ${missing} missing)`, { cause: broken ?? undefined });
      }
      yield { name, data };
    }

    // The declared count is done: the stream must hold exactly one u32le 0 and nothing after it.
    const end = (await need(4, 'end marker')).readUInt32LE(0);
    if (end !== 0) {
      throw new Error(`art-container: ${partPath} holds more records than the header's ${fileCount} — expected the end marker, got a ${end}-byte name length`);
    }
    const extra = await pull();
    if (extra !== null || buf.length > 0) {
      // Either the same decompressed stream continued, or the reader had already buffered the surplus.
      throw new Error(`art-container: ${partPath} has trailing bytes after the end marker — the header declares ${fileCount} file(s)`);
    }
    if (broken) {
      // Syntactically complete, but the gzip member itself ended early (its trailer is missing/corrupt).
      throw new Error(`art-container: ${partPath} is truncated (its gzip stream ended early)`, { cause: broken });
    }
  } finally {
    src.destroy();
    gunzip.destroy();
  }
}
