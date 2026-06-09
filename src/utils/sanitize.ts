const _CTRL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
const _ANSI = /\x1B\[[0-9;?]*[A-Za-z]/g
const _NON_PRINTABLE = /[^\x09\x0A\x0D\x20-\x7E\u00A0-\u{10FFFF}]/gu
const _INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\uFFF9-\uFFFB]/g
const _HTML_TAGS = /<[^>]*>/g
const _HTML_ENTITIES = /&[a-zA-Z0-9#]+;/g
const _JS_PROTOCOL = /javascript:/gi
const _DATA_PROTOCOL = /data:/gi

export function sanitizeText(value: unknown, opts: { maxLength?: number } = {}): string {
  const { maxLength = 4096 } = opts
  if (value == null) return ''
  const raw = String(value)
  if (!raw) return ''
  
  let sanitized = raw
  
  sanitized = sanitized
    .replace(_ANSI, '')
    .replace(_CTRL, '')
    .replace(_NON_PRINTABLE, '')
    .replace(_INVISIBLE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\u00A0/g, ' ')
    .trim()
  
  sanitized = sanitized
    .replace(_HTML_TAGS, '')
    .replace(_HTML_ENTITIES, '')
    .replace(_JS_PROTOCOL, '')
    .replace(_DATA_PROTOCOL, '')
  
  return sanitized.slice(0, maxLength)
}

export function sanitizeAscii(value: unknown, opts: { maxLength?: number } = {}): string {
  const { maxLength = 128 } = opts
  if (value == null) return ''
  return String(value)
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, maxLength)
}

export function sanitizeHtml(value: unknown, opts: { maxLength?: number } = {}): string {
  const { maxLength = 4096 } = opts
  if (value == null) return ''
  const raw = String(value)
  if (!raw) return ''
  
  // Basic HTML escaping to prevent XSS
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
  
  // Remove control characters and ANSI codes
  const sanitized = escaped
    .replace(_ANSI, '')
    .replace(_CTRL, '')
    .replace(_NON_PRINTABLE, '')
    .replace(_INVISIBLE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\u00A0/g, ' ')
    .trim()
    .slice(0, maxLength)
  
  return sanitized
}

export function normalizeMac(value: unknown): string {
  if (value == null) return ''
  const ascii = sanitizeAscii(value, { maxLength: 32 })
  if (!ascii) return ''
  const compact = ascii.replace(/[:-]/g, '').toUpperCase()
  if (!/^[0-9A-F]{12}$/.test(compact)) return ''
  return compact.match(/.{2}/g)!.join(':')
}

export function safeParseInt(value: unknown, fallback: number = 0): number {
  if (value == null) return fallback
  const s = String(value).trim()
  if (!s) return fallback
  const m = s.match(/-?\d+/)
  if (!m) return fallback
  const n = parseInt(m[0], 10)
  return Number.isFinite(n) ? n : fallback
}

export function sanitizeUrl(value: unknown): string {
  if (value == null) return ''
  const raw = String(value).trim()
  if (!raw) return ''
  
  // Remove potentially dangerous protocols
  const sanitized = raw
    .replace(_JS_PROTOCOL, '')
    .replace(_DATA_PROTOCOL, '')
    .replace(_CTRL, '')
    .replace(_ANSI, '')
  
  // Basic URL validation - only allow common safe schemes
  try {
    const url = new URL(sanitized)
    if (!['http:', 'https:', 'ftp:', 'ftps:'].includes(url.protocol)) {
      return ''
    }
    return sanitized
  } catch {
    // If it's not a valid URL, try to clean it up
    const clean = sanitized.replace(/[^\w\-_.~:/?#[\]@!$&'()*+,;=]/g, '')
    return clean || ''
  }
}
