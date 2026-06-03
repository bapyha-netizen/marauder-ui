let _native: (() => string) | null = null
try {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    _native = crypto.randomUUID.bind(crypto)
  }
} catch (_) {
  _native = null
}

function _fallback(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return (
    hex.slice(0, 8) + '-' +
    hex.slice(8, 12) + '-' +
    hex.slice(12, 16) + '-' +
    hex.slice(16, 20) + '-' +
    hex.slice(20)
  )
}

export function uuid(): string {
  return _native ? _native() : _fallback()
}

export function recordKey(item: Record<string, unknown> | null | undefined): string {
  if (!item) return uuid()
  if (typeof item.id === 'string' && item.id) return item.id
  if (typeof item.bssid === 'string' && item.bssid) return item.bssid
  if (typeof item.mac === 'string' && item.mac) return item.mac
  return uuid()
}
