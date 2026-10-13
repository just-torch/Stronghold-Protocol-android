// The repository's own file list, for the tests that ask what a release ships.
//
// tools/package.mjs takes *tracked* files (`git ls-files`) because the player zip is built from the index. This fork's
// working tree carries no `.git` (see test/docs-paths.test.js repoFiles), so those tests would throw before checking
// anything; the directory walk below stands in, skipping exactly what a release does not ship. Keep this in one place
// so a new upstream test can reuse it instead of failing on the missing checkout.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SKIP_DIRS = new Set(['node_modules', '.git', '.cache', 'logs', 'build', '.gradle', '.build', '.cxx', 'dist',
  'screenshot', '.scratch']);
const SKIP_PATHS = ['public/assets/', 'public/fonts/', 'public/vendor/', 'android/.build/', 'android/dist/',
  'android/web/nodejs/', 'android/web/vendor/', 'android/node_modules/', 'android/android/build/',
  'android/android/app/build/', 'android/android/app/src/main/assets/public/'];

/** Walk the working tree, posix relative paths, skipping build output and downloaded art. */
export function walkFiles(root = ROOT) {
  const out = [];
  const walk = (dir, rel = '') => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || SKIP_PATHS.some((p) => (r + '/').startsWith(p))) continue;
        walk(path.join(dir, e.name), r);
      } else out.push(r);
    }
  };
  walk(root);
  return out;
}

/**
 * The files a release would take: `git ls-files --cached --others --exclude-standard` in a checkout, else the walk.
 * @returns {string[]} posix relative paths
 */
export function shippedFileList(root = ROOT) {
  try {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
      .split('\n').filter(Boolean);
  } catch {
    return walkFiles(root);
  }
}
