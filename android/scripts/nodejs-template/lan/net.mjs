// android/scripts/nodejs-template/lan/net.mjs — IPv4 broadcast address helpers shared by the announcer (inside the
// APK) and by the PC-side tools in android/scripts/.
//
// Both the limited broadcast (255.255.255.255) and each interface's subnet-directed broadcast are used, because
// which of the two survives a given Wi-Fi access point or Android build is not something we can rely on.

import os from 'node:os';

/**
 * Dotted-quad IPv4 → unsigned 32-bit integer, or null when it is not IPv4.
 * @param {string} address
 * @returns {number | null}
 */
export function ipv4ToInt(address) {
  const parts = String(address).split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255 || part === '') return null;
    out = (out * 256) + n;
  }
  return out >>> 0;
}

/** @param {number} value @returns {string} */
export function intToIpv4(value) {
  const v = value >>> 0;
  return `${(v >>> 24) & 255}.${(v >>> 16) & 255}.${(v >>> 8) & 255}.${v & 255}`;
}

/**
 * The subnet-directed broadcast address of an interface (e.g. 192.168.1.23/24 → 192.168.1.255), or null when the
 * pair is unusable or the broadcast would just be the interface's own address.
 * @param {string} address @param {string} netmask
 * @returns {string | null}
 */
export function directedBroadcast(address, netmask) {
  const ip = ipv4ToInt(address);
  const mask = ipv4ToInt(netmask);
  if (ip == null || mask == null) return null;
  // /32 has no broadcast address, and a /0 netmask's "broadcast" is the limited broadcast we send anyway.
  if (mask === 0xffffffff || mask === 0) return null;
  const broadcast = (((ip & mask) | (~mask >>> 0)) >>> 0);
  if (broadcast === ip) return null;
  return intToIpv4(broadcast);
}

/**
 * Every address a `here` packet should be sent to (and a `who` should be sent to).
 * @param {ReturnType<typeof os.networkInterfaces>} [interfaces]
 * @returns {string[]}
 */
export function broadcastAddresses(interfaces = os.networkInterfaces()) {
  const out = new Set(['255.255.255.255']);
  for (const list of Object.values(interfaces || {})) {
    for (const entry of list || []) {
      if (!entry || entry.internal) continue;
      if (entry.family !== 'IPv4' && entry.family !== 4) continue;
      const directed = directedBroadcast(entry.address, entry.netmask);
      if (directed) out.add(directed);
    }
  }
  return [...out];
}
