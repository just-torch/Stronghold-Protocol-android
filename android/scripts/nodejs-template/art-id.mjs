// android/scripts/nodejs-template/art-id.mjs — the identity of an *art set* (not of an app version).
//
// The downloaded art pack must be accepted by an app that ships exactly the same art and refused by one that does not,
// and an app release that only changed code must keep the pack already on the phone — otherwise every release means
// re-uploading and re-downloading 502 MB. The app version cannot decide that, so both sides compute this id:
//
//   * `data/assets.json` — the official art, identified by the manifest's own `hash` (tools/assets/manifest.mjs
//     contentHash over the entries, so it ignores the build fields and survives a reformat);
//   * `data/local-assets.json` — the local-client overlay (`public/assets/local/**`: the 3D battlefield scenes, mesh
//     materials, the extracted enemy/token models), identified by its `count` + `groups` (that file has no hash of its
//     own). The pack ships those files too, so leaving them out of the id would let an app accept a pack that is
//     missing a scene it needs.
//
// The id is `sha1` over a canonical JSON of those two pieces, first 12 hex characters — the same shape as
// `data/assets.json`'s own hash. Both files are shipped in the APK (`data/`), so the app can compute it offline.
//
// Used by android/scripts/pack-art.mjs (writes `artId` into the pack manifest) and by the staged entry point
// (nodejs-template/index.js, via assets.mjs readArtId). Node builtins only.

import { createHash } from 'node:crypto';

/**
 * JSON with object keys sorted and no whitespace, so two structurally equal documents hash the same whatever their
 * formatting. Arrays keep their order (the manifests' arrays carry meaning).
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * The art id of a pair of manifests.
 * @param {{ assets?: any, local?: any }} manifests
 * @returns {string} 12 hex characters ('' when neither manifest is usable)
 */
export function artIdFrom({ assets = null, local = null } = {}) {
  const payload = {
    a: typeof assets?.hash === 'string' ? assets.hash : '',
    l: local && typeof local === 'object' ? { count: local.count ?? null, groups: local.groups ?? null } : null,
  };
  if (!payload.a && !payload.l) return '';
  return createHash('sha1').update(canonicalJson(payload)).digest('hex').slice(0, 12);
}

export default { canonicalJson, artIdFrom };
