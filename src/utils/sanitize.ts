const _CTRL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
const _ANSI = /\x1B\[[0-9;?]*[A-Za-z]/g
const _NON_PRINTABLE = /[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g

export function sanitizeText(value: unknown, opts: { maxLength?: number } = {}): string {
  const { maxLength = 4096 } = opts
  if (value == null) return ''
  const raw = String(value)
  if (!raw) return ''
  return raw
    .replace(_ANSI, '')
    .replace(_CTRL, '')
    .replace(_NON_PRINTABLE, '?')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, maxLength)
}

export function sanitizeAscii(value: unknown, opts: { maxLength?: number } = {}): string {
  const { maxLength = 128 } = opts
  if (value == null) return ''
  return String(value)
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, maxLength)
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
