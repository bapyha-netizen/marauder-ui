import { describe, it, expect } from 'vitest'
import { uuid, recordKey } from '../uuid'

describe('uuid', () => {
  it('returns a string', () => {
    const id = uuid()
    expect(typeof id).toBe('string')
  })

  it('returns a v4 UUID with correct shape', () => {
    const id = uuid()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('produces unique values across calls', () => {
    const a = new Set()
    for (let i = 0; i < 1000; i++) a.add(uuid())
    expect(a.size).toBe(1000)
  })
})

describe('recordKey', () => {
  it('prefers id', () => {
    expect(recordKey({ id: 'foo' })).toBe('foo')
  })
  it('falls back to bssid', () => {
    expect(recordKey({ bssid: 'AA:BB:CC:DD:EE:FF' })).toBe('AA:BB:CC:DD:EE:FF')
  })
  it('falls back to mac', () => {
    expect(recordKey({ mac: '11:22:33:44:55:66' })).toBe('11:22:33:44:55:66')
  })
  it('mints a UUID when no identifier present', () => {
    const key = recordKey({ name: 'anon' })
    expect(key).toMatch(/^[0-9a-f]{8}-/)
  })
  it('handles null/undefined input', () => {
    expect(recordKey(null)).toMatch(/^[0-9a-f]{8}-/)
  })
})
