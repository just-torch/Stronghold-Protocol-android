// android/scripts/lib/download.mjs — resumable HTTPS downloader used by the Android build scripts.
//
// Why a custom downloader instead of curl/PowerShell: this machine's DSH sandbox runs child processes under a
// token where Windows Schannel cannot acquire TLS credentials (SEC_E_NO_CREDENTIALS / CRYPT_E_NO_REVOCATION_CHECK),
// so curl.exe and Invoke-WebRequest fail for every https:// URL. Node's own TLS stack (OpenSSL) is unaffected.
//
// Usage (CLI):  node android/scripts/lib/download.mjs <url> <destFile> [--sha1 <hex>]
// Usage (API):  const { download } = await import('./lib/download.mjs'); await download(url, dest, { sha1 });

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const RETRIES = 5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Size of a file, or 0 when it does not exist. */
async function sizeOf(file) {
  try { return (await fsp.stat(file)).size; } catch { return 0; }
}

/** sha1 of a file as lowercase hex. */
export async function sha1File(file) {
  const hash = crypto.createHash('sha1');
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest('hex');
}

function human(bytes) {
  if (bytes >= 1 << 30) return `${(bytes / (1 << 30)).toFixed(2)} GiB`;
  if (bytes >= 1 << 20) return `${(bytes / (1 << 20)).toFixed(1)} MiB`;
  if (bytes >= 1 << 10) return `${(bytes / (1 << 10)).toFixed(1)} KiB`;
  return `${bytes} B`;
}

/**
 * Download `url` to `dest`, resuming a previous partial download when the server supports ranges.
 * Verifies `opts.sha1` when given. Returns `dest`.
 */
export async function download(url, dest, opts = {}) {
  const { sha1, log = console.log } = opts;
  await fsp.mkdir(path.dirname(dest), { recursive: true });

  // Already complete?
  if (sha1 && (await sizeOf(dest)) > 0) {
    const have = await sha1File(dest);
    if (have === sha1.toLowerCase()) { log(`  ✓ cached  ${path.basename(dest)} (${human(await sizeOf(dest))})`); return dest; }
    log(`  ! checksum mismatch on ${path.basename(dest)}, re-downloading`);
    await fsp.rm(dest, { force: true });
  }

  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const have = await sizeOf(dest);
      const headers = {};
      if (have > 0) headers.Range = `bytes=${have}-`;

      const res = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(30 * 60 * 1000) });
      if (res.status === 416) {
        // The partial file is longer than the resource. dl.google.com advertises a stale Content-Length that is
        // *smaller* than the real archive, so a "complete" download can look over-long and poison the next resume.
        await fsp.rm(dest, { force: true });
        throw new Error('range not satisfiable — discarding the partial file and starting over');
      }
      if (have > 0 && res.status === 200) {
        // Server ignored the range (or the file changed): start over.
        await fsp.rm(dest, { force: true });
      }
      if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const total = (() => {
        const cr = res.headers.get('content-range');
        if (cr) { const m = /\/(\d+)$/.exec(cr); if (m) return Number(m[1]); }
        const cl = res.headers.get('content-length');
        return cl ? Number(cl) + (res.status === 206 ? have : 0) : 0;
      })();

      const mode = res.status === 206 && have > 0 ? 'a' : 'w';
      const start = mode === 'a' ? have : 0;
      log(`  ↓ ${path.basename(dest)}${mode === 'a' ? ` (resume @ ${human(start)})` : ''}${total ? ` of ${human(total)}` : ''}`);

      let received = start;
      let lastTick = 0;
      const out = fs.createWriteStream(dest, { flags: mode });
      const body = Readable.fromWeb(res.body);
      body.on('data', (chunk) => {
        received += chunk.length;
        const now = Date.now();
        if (total && now - lastTick > 2000) {
          lastTick = now;
          const pct = ((received / total) * 100).toFixed(1);
          log(`     ${pct}%  ${human(received)} / ${human(total)}`);
        }
      });
      await pipeline(body, out);

      const finalSize = await sizeOf(dest);
      // Content-Length is advisory only: several dl.google.com endpoints report a value that does not match the
      // bytes they actually send. A short read always means truncation; an over-long read is only accepted when a
      // checksum confirms the content.
      if (total && finalSize < total) throw new Error(`incomplete: ${finalSize} of ${total} bytes`);
      if (total && finalSize > total) {
        log(`     note: got ${finalSize} bytes but Content-Length said ${total}; verifying another way`);
      }

      if (sha1) {
        const got = await sha1File(dest);
        if (got !== sha1.toLowerCase()) throw new Error(`sha1 mismatch: got ${got}, want ${sha1}`);
      } else if (total && finalSize > total) {
        throw new Error(`size ${finalSize} exceeds the advertised ${total} and no checksum was supplied to confirm it`);
      }
      log(`  ✓ ${path.basename(dest)}  (${human(finalSize)})`);
      return dest;
    } catch (e) {
      lastErr = e;
      if (attempt === RETRIES) break;
      const wait = Math.min(30_000, 2000 * attempt);
      log(`  ! attempt ${attempt}/${RETRIES} failed: ${e.message} — retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  throw new Error(`failed to download ${url}: ${lastErr?.message}`);
}

// ---------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------
const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href;
if (isMain) {
  const [url, dest] = process.argv.slice(2);
  const sha1Idx = process.argv.indexOf('--sha1');
  const sha1 = sha1Idx > 0 ? process.argv[sha1Idx + 1] : undefined;
  if (!url || !dest) {
    console.error('usage: node android/scripts/lib/download.mjs <url> <destFile> [--sha1 <hex>]');
    process.exit(2);
  }
  try {
    await download(url, path.resolve(dest), { sha1 });
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
  }
}
