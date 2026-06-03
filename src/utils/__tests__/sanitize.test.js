import { describe, it, expect } from 'vitest'
import { sanitizeText, sanitizeAscii, normalizeMac, safeParseInt } from '../sanitize'

describe('sanitizeText', () => {
  it('returns empty string for null/undefined', () => {
    expect(sanitizeText(null)).toBe('')
    expect(sanitizeText(undefined)).toBe('')
  })

  it('strips ANSI escape sequences', () => {
    const input = '\x1B[31mred\x1B[0m text'
    expect(sanitizeText(input)).toBe('red text')
  })

  it('removes control characters but keeps tab/CR/LF spacing trimmed', () => {
    const input = 'hello\x00\x01world'
    expect(sanitizeText(input)).toBe('helloworld')
  })

  it('collapses multiple internal blanks', () => {
    expect(sanitizeText('a    b\t\tc')).toBe('a b c')
  })

  it('respects maxLength', () => {
    expect(sanitizeText('abcdefghij', { maxLength: 5 })).toBe('abcde')
  })

  it('trims surrounding whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello')
  })
})

describe('sanitizeAscii', () => {
  it('keeps only printable ASCII', () => {
    expect(sanitizeAscii('a\x01b\x1Bc')).toBe('abc')
  })
  it('truncates to maxLength', () => {
    expect(sanitizeAscii('abcdef', { maxLength: 3 })).toBe('abc')
  })
})

describe('normalizeMac', () => {
  it('accepts colon form', () => {
    expect(normalizeMac('aa:bb:cc:dd:ee:ff')).toBe('AA:BB:CC:DD:EE:FF')
  })
  it('accepts dash form', () => {
    expect(normalizeMac('aa-bb-cc-dd-ee-ff')).toBe('AA:BB:CC:DD:EE:FF')
  })
  it('accepts compact form', () => {
    expect(normalizeMac('aabbccddeeff')).toBe('AA:BB:CC:DD:EE:FF')
  })
  it('returns empty string on invalid input', () => {
    expect(normalizeMac('not-a-mac')).toBe('')
    expect(normalizeMac(null)).toBe('')
  })
})

describe('safeParseInt', () => {
  it('parses valid integers', () => {
    expect(safeParseInt('42')).toBe(42)
    expect(safeParseInt('-7')).toBe(-7)
  })
  it('extracts first integer from noisy text', () => {
    expect(safeParseInt('RSSI: -65 dBm')).toBe(-65)
  })
  it('returns fallback for invalid input', () => {
    expect(safeParseInt('nope', 99)).toBe(99)
    expect(safeParseInt(null, 5)).toBe(5)
  })
})
