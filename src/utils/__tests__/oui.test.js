import { describe, it, expect, beforeEach } from 'vitest'
import { lookupVendor, lookupVendorAsync, loadDB } from '../oui'
import { OUI_DATA } from '../ouiData'

describe('OUI lookup', () => {
  beforeEach(async () => {
    await loadDB()
  })

  it('finds a known vendor', () => {
    expect(lookupVendor('00:00:0C:11:22:33')).toBe('Cisco')
  })

  it('returns empty string for unknown prefix', () => {
    expect(lookupVendor('FF:FF:FF:11:22:33')).toBe('')
  })

  it('handles lowercase MAC', () => {
    expect(lookupVendor('00:00:0c:11:22:33')).toBe('Cisco')
  })

  it('returns empty for too-short input', () => {
    expect(lookupVendor('')).toBe('')
    expect(lookupVendor(null)).toBe('')
    expect(lookupVendor('AA')).toBe('')
  })

  it('caches the same prefix on subsequent calls', () => {
    lookupVendor('00:00:0C:11:22:33')
    lookupVendor('00:00:0C:11:22:33')
    expect(lookupVendor('00:00:0C:11:22:33')).toBe('Cisco')
  })

  it('lookupVendorAsync works the same as sync after first call', async () => {
    const v = await lookupVendorAsync('00:00:0C:11:22:33')
    expect(v).toBe('Cisco')
  })

  it('OUI_DATA has real prefixes (not empty)', () => {
    const keys = Object.keys(OUI_DATA)
    expect(keys.length).toBeGreaterThan(100)
    for (const k of keys.slice(0, 10)) {
      expect(k).toMatch(/^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/)
    }
  })

  it('all OUI_DATA values are non-empty strings', () => {
    for (const v of Object.values(OUI_DATA)) {
      expect(typeof v).toBe('string')
      expect(v.length).toBeGreaterThan(0)
    }
  })
})
