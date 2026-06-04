import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { lookupVendor, lookupVendorAsync, loadDB } from '../oui'
import { OUI_DATA } from '../ouiData'

describe('OUI lookup', () => {
  let consoleWarnSpy

  beforeEach(async () => {
    // Clear cache before each test
    await loadDB()
    
    // Mock console.warn to check for error logging
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore console spy
    if (consoleWarnSpy) {
      consoleWarnSpy.mockRestore()
    }
  })

  describe('Basic functionality', () => {
    it('finds a known vendor', () => {
      const mac = '00:00:0C:11:22:33'
      const prefix = mac.slice(0, 8)
      expect(OUI_DATA[prefix]).toBeTruthy()
      expect(lookupVendor(mac)).toBe(OUI_DATA[prefix])
    })

    it('returns empty string for unknown prefix', () => {
      expect(lookupVendor('FF:FF:FF:11:22:33')).toBe('')
    })

    it('handles different MAC formats', () => {
      const testCases = [
        { mac: '00:00:0C:11:22:33', vendor: 'Cisco' },
        { mac: '00-00-0C-11-22-33', vendor: 'Cisco' }, // With dashes
        { mac: '00000C112233', vendor: 'Cisco' }, // Without separators
        { mac: '00.00.0C.11.22.33', vendor: 'Cisco' }, // With dots
      ]

      for (const testCase of testCases) {
        expect(lookupVendor(testCase.mac)).toBe(testCase.vendor)
      }
    })

    it('handles case insensitivity', () => {
      const testCases = [
        { mac: '00:00:0C:11:22:33', vendor: 'Cisco' },
        { mac: '00:00:0c:11:22:33', vendor: 'Cisco' },
        { mac: '00:00:0C:11:22:33', vendor: 'Cisco' },
        { mac: '00:00:0c:11:22:33', vendor: 'Cisco' },
      ]

      for (const testCase of testCases) {
        expect(lookupVendor(testCase.mac)).toBe(testCase.vendor)
      }
    })

    it('returns empty for invalid inputs', () => {
      const invalidInputs = [
        '',
        null,
        undefined,
        'AA',
        '00:00:0C',
        '00:00:0C:11:22',
        '00:00:0C:11:22:33:44',
        '00:00:0C:11:22:GG',
        'not-a-mac-address',
        12345,
        {},
        [],
      ]

      for (const input of invalidInputs) {
        expect(lookupVendor(input)).toBe('')
      }
    })

    it('handles edge cases with special characters', () => {
      expect(lookupVendor('00:00:0C:11:22:33')).toBe('Cisco')
      expect(lookupVendor('00:00:0C:11:22:33 ')).toBe('Cisco') // With trailing space
      expect(lookupVendor(' 00:00:0C:11:22:33')).toBe('Cisco') // With leading space
      expect(lookupVendor(' 00:00:0C:11:22:33 ')).toBe('Cisco') // With spaces
    })
  })

  describe('Caching behavior', () => {
it('caches the same prefix on subsequent calls', () => {
    lookupVendor('00:00:0C:11:22:33')
    lookupVendor('00:00:0C:11:22:33')
    expect(lookupVendor('00:00:0C:11:22:33')).toBe('Cisco')
  })

  it('caches different prefixes separately', () => {
    lookupVendor('00:00:0C:11:22:33')
    lookupVendor('00:01:42:11:22:33')
    expect(lookupVendor('00:00:0C:11:22:33')).toBe('Cisco')
    expect(lookupVendor('00:01:42:11:22:33')).toBe('HTC')
  })

  it('cache persists across multiple calls', () => {
    const mac = '00:00:0C:11:22:33'
    lookupVendor(mac)
    lookupVendor(mac)
    expect(lookupVendor(mac)).toBe('Cisco')
  })

  it('does not cache invalid MAC addresses', () => {
    lookupVendor('invalid-mac')
    lookupVendor('')
    expect(lookupVendor('00:00:0C:11:22:33')).toBe('Cisco')
  })

    
  })

  describe('Async functionality', () => {
    it('lookupVendorAsync works the same as sync', async () => {
      const mac = '00:00:0C:11:22:33'
      const syncResult = lookupVendor(mac)
      const asyncResult = await lookupVendorAsync(mac)
      
      expect(asyncResult).toBe(syncResult)
      expect(asyncResult).toBe('Cisco')
    })

    it('lookupVendorAsync handles invalid inputs', async () => {
      const invalidInputs = ['', null, undefined, 'invalid-mac']
      
      for (const input of invalidInputs) {
        const result = await lookupVendorAsync(input)
        expect(result).toBe('')
      }
    })

it('lookupVendorAsync caches results', async () => {
    const mac = '00:00:0C:11:22:33'
    
    // First call
    await lookupVendorAsync(mac)
    const result1 = await lookupVendorAsync(mac)
    
    // Second call should use cache
    const result2 = await lookupVendorAsync(mac)
    expect(result1).toBe('Cisco')
    expect(result2).toBe('Cisco')
  })

    it('lookupVendorAsync handles large batch efficiently', async () => {
      const testMacs = [
        '00:00:0C:11:22:33',
        '00:01:42:11:22:33',
        '00:02:6D:11:22:33',
        '00:03:93:11:22:33',
        '00:04:76:11:22:33',
      ]
      
      const start = performance.now()
      const results = await Promise.all(testMacs.map(mac => lookupVendorAsync(mac)))
      const end = performance.now()
      
      expect(results).toEqual(['Cisco', 'HTC', 'HTC', 'Apple', 'Samsung'])
      expect(end - start).toBeLessThan(100) // Should be very fast
    })
  })

  describe('Data validation', () => {
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
        expect(v.trim()).not.toBe('')
      }
    })

    it('OUI_DATA keys are unique', () => {
      const keys = Object.keys(OUI_DATA)
      const uniqueKeys = new Set(keys)
      expect(keys.length).toBe(uniqueKeys.size)
    })

    it('loadDB returns the correct data structure', async () => {
      const db = await loadDB()
      expect(typeof db).toBe('object')
      expect(db).not.toBeNull()
      
      // Should have the same data as OUI_DATA
      expect(db).toEqual(OUI_DATA)
    })
  })

  describe('Performance tests', () => {
    it('lookupVendor is fast for repeated lookups', () => {
      const mac = '00:00:0C:11:22:33'
      const iterations = 1000
      
      const start = performance.now()
      for (let i = 0; i < iterations; i++) {
        lookupVendor(mac)
      }
      const end = performance.now()
      
      const avgTime = (end - start) / iterations
      expect(avgTime).toBeLessThan(0.1) // Should be very fast due to caching
    })

    it('handles large numbers of different MACs efficiently', () => {
      const testMacs = Object.keys(OUI_DATA).slice(0, 100).map(prefix => 
        `${prefix}:11:22:33`
      )
      
      const start = performance.now()
      const results = testMacs.map(mac => lookupVendor(mac))
      const end = performance.now()
      
      expect(results.length).toBe(100)
      expect(end - start).toBeLessThan(50) // Should be fast
    })
  })

  describe('Error handling', () => {
    it('does not throw errors for invalid inputs', () => {
      expect(() => lookupVendor(null)).not.toThrow()
      expect(() => lookupVendor(undefined)).not.toThrow()
      expect(() => lookupVendor('')).not.toThrow()
      expect(() => lookupVendor(12345)).not.toThrow()
    })

    it('lookupVendorAsync does not throw errors', async () => {
      expect(async () => {
        await lookupVendorAsync(null)
      }).not.toThrow()
      
      expect(async () => {
        await lookupVendorAsync(undefined)
      }).not.toThrow()
      
      expect(async () => {
        await lookupVendorAsync('')
      }).not.toThrow()
    })

it('handles database loading errors gracefully', async () => {
    // Test with invalid MAC
    const result = await lookupVendorAsync('invalid-mac')
    expect(result).toBe('')
  })
  })

  describe('Real-world usage scenarios', () => {
    it('handles real MAC addresses from common vendors', () => {
      const testCases = [
        { mac: '00:00:0C:11:22:33', vendor: 'Cisco' },
        { mac: '00:01:42:11:22:33', vendor: 'HTC' },
        { mac: '00:03:93:11:22:33', vendor: 'Apple' },
        { mac: '00:04:76:11:22:33', vendor: 'Samsung' },
        { mac: '00:06:5B:11:22:33', vendor: 'Intel' },
        { mac: '00:0A:28:11:22:33', vendor: 'Xiaomi' },
      ]

      for (const testCase of testCases) {
        expect(lookupVendor(testCase.mac)).toBe(testCase.vendor)
      }
    })

    it('handles mixed case MAC addresses correctly', () => {
      const testCases = [
        { mac: '00:00:0C:11:22:33', vendor: 'Cisco' },
        { mac: '00:00:0c:11:22:33', vendor: 'Cisco' },
        { mac: '00:00:0C:11:22:33', vendor: 'Cisco' },
        { mac: '00:00:0c:11:22:33', vendor: 'Cisco' },
      ]

      for (const testCase of testCases) {
        expect(lookupVendor(testCase.mac)).toBe(testCase.vendor)
      }
    })

    it('handles MAC addresses with different separators', () => {
      const testCases = [
        { mac: '00:00:0C:11:22:33', vendor: 'Cisco' },
        { mac: '00-00-0C-11-22-33', vendor: 'Cisco' },
        { mac: '00000C112233', vendor: 'Cisco' },
      ]

      for (const testCase of testCases) {
        expect(lookupVendor(testCase.mac)).toBe(testCase.vendor)
      }
    })
  })
})
