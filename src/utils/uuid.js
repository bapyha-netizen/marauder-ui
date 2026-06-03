/**
 * RFC 4122 v4 UUID generator.
 *
 * `crypto.randomUUID()` is available in modern browsers and Node 19+,
 * but we wrap it to:
 *   1. Provide a single import path for tests.
 *   2. Fall back to a Math.random()-based implementation in
 *      environments that lack the Web Crypto API.
 *
 * Used as the canonical ID for IndexedDB records, decoupling
 * persistence from item properties (BSSID/MAC) which can be missing
 * or duplicated across firmware versions.
 */

let _native = null
try {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    _native = crypto.randomUUID.bind(crypto)
  }
} catch (_) {
  _native = null
}

function _fallback() {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0F) | 0x40
  bytes[8] = (bytes[8] & 0x3F) | 0x80
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return (
    hex.slice(0, 8) + '-' +
    hex.slice(8, 12) + '-' +
    hex.slice(12, 16) + '-' +
    hex.slice(16, 20) + '-' +
    hex.slice(20)
  )
}

/**
 * Returns a new RFC 4122 v4 UUID string.
 * @returns {string}
 */
export function uuid() {
  return _native ? _native() : _fallback()
}

/**
 * Stable key for an arbitrary record. Prefers existing `id`/`bssid`/`mac`
 * properties, then falls back to a freshly-minted UUID. This avoids the
 * cost (and surprise of object-graph serialization) of `JSON.stringify`
 * for ad-hoc key generation.
 *
 * @param {object} item
 * @returns {string}
 */
export function recordKey(item) {
  if (!item) return uuid()
  if (typeof item.id === 'string' && item.id) return item.id
  if (typeof item.bssid === 'string' && item.bssid) return item.bssid
  if (typeof item.mac === 'string' && item.mac) return item.mac
  return uuid()
}
