/**
 * Centralized text sanitization for device data.
 *
 * Marauder firmware occasionally emits non-printable bytes, ANSI escape
 * sequences, or partial UTF-8 fragments. Anywhere user-visible text is
 * built from device output, it should pass through `sanitizeText` (or
 * the stricter `sanitizeAscii` for fields that are semantically
 * limited to printable ASCII such as MAC/BSSID/ESSID).
 */

const _CTRL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
const _ANSI = /\x1B\[[0-9;?]*[A-Za-z]/g
const _NON_PRINTABLE = /[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g

/**
 * Sanitize free-form text from the device.
 * - Strips ANSI escape sequences.
 * - Removes control characters except whitespace (\t, \n, \r).
 * - Replaces remaining non-printable unicode with '?'.
 * - Trims surrounding whitespace and collapses multiple internal blanks.
 *
 * @param {unknown} value
 * @param {object} [opts]
 * @param {number} [opts.maxLength=4096]
 * @returns {string}
 */
export function sanitizeText(value, opts = {}) {
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

/**
 * Strict sanitization for identifiers that must be printable ASCII
 * (MAC, BSSID, channel labels, hex strings).
 *
 * @param {unknown} value
 * @param {object} [opts]
 * @param {number} [opts.maxLength=128]
 * @returns {string}
 */
export function sanitizeAscii(value, opts = {}) {
  const { maxLength = 128 } = opts
  if (value == null) return ''
  return String(value)
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, maxLength)
}

/**
 * Normalize a MAC / BSSID string to upper-case, colon-separated form.
 * Accepts `aa:bb:cc:dd:ee:ff`, `aa-bb-cc-dd-ee-ff`, and `aabbccddeeff`.
 * Returns '' if the input is not a valid 6-byte MAC.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeMac(value) {
  if (value == null) return ''
  const ascii = sanitizeAscii(value, { maxLength: 32 })
  if (!ascii) return ''
  const compact = ascii.replace(/[:-]/g, '').toUpperCase()
  if (!/^[0-9A-F]{12}$/.test(compact)) return ''
  return compact.match(/.{2}/g).join(':')
}

/**
 * Parse an integer from raw device text, returning `fallback` if the
 * input does not look like a number. Useful for fields such as RSSI
 * and channel that are occasionally corrupted.
 *
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export function safeParseInt(value, fallback = 0) {
  if (value == null) return fallback
  const s = String(value).trim()
  if (!s) return fallback
  const m = s.match(/-?\d+/)
  if (!m) return fallback
  const n = parseInt(m[0], 10)
  return Number.isFinite(n) ? n : fallback
}
