import { describe, it, expect, beforeEach } from 'vitest'
import { lookupVendor, lookupVendorAsync, loadDB } from '../oui'
import { OUI_DATA } from '../ouiData'

describe('OUI lookup - Performance and Edge Cases', () => {
beforeEach(async () => {
    // Clear cache before each test
    await loadDB()
    
    // Mock console.warn to check for error logging
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('Memory usage', () => {
    it('does not leak memory with repeated lookups', () => {
      const iterations = 1000
      const mac = '00:00:0C:11:22:33'
      
      // Clear initial cache
      const { _vendorCache } = require('../oui')
      const initialSize = _vendorCache.size
      
      // Perform many lookups
      for (let i = 0; i < iterations; i++) {
        lookupVendor(mac)
      }
      
      // Cache should still be small (only one entry)
      expect(_vendorCache.size).toBe(1)
    })

    it('handles large numbers of unique prefixes efficiently', () => {
      const uniqueMacs = Object.keys(OUI_DATA).slice(0, 500).map(prefix => 
        `${prefix}:11:22:33`
      )
      
      const start = performance.now()
      const results = uniqueMacs.map(mac => lookupVendor(mac))
      const end = performance.now()
      
      expect(results.length).toBe(500)
      expect(results.every(result => result !== '')).toBe(true)
      expect(end - start).toBeLessThan(100) // Should be fast
    })
  })

  describe('Concurrent access', () => {
    it('handles concurrent lookups correctly', async () => {
      const testMacs = [
        '00:00:0C:11:22:33',
        '00:01:42:11:22:33',
        '00:02:6D:11:22:33',
        '00:03:93:11:22:33',
        '00:04:76:11:22:33',
      ]
      
      // Run concurrent lookups
      const promises = testMacs.map(mac => lookupVendorAsync(mac))
      const results = await Promise.all(promises)
      
      expect(results).toEqual(['Cisco', 'HTC', 'HTC', 'Apple', 'Samsung'])
    })

    it('handles mixed concurrent sync and async calls', async () => {
      const mac = '00:00:0C:11:22:33'
      
      // Mix of sync and async calls
      const syncPromise1 = Promise.resolve(lookupVendor(mac))
      const syncPromise2 = Promise.resolve(lookupVendor(mac))
      const asyncPromise = lookupVendorAsync(mac)
      
      const results = await Promise.all([syncPromise1, syncPromise2, asyncPromise])
      
      expect(results).toEqual(['Cisco', 'Cisco', 'Cisco'])
    })
  })

  describe('Boundary conditions', () => {
    it('handles MAC addresses at the edge of valid ranges', () => {
      const edgeCases = [
        '00:00:00:11:22:33', // Minimum valid
        'FF:FF:FF:11:22:33', // Maximum valid (unknown vendor)
        '00:00:0C:FF:FF:FF', // Maximum valid for known vendor
      ]
      
      for (const mac of edgeCases) {
        expect(() => lookupVendor(mac)).not.toThrow()
        const result = lookupVendor(mac)
        expect(typeof result).toBe('string')
      }
    })

    it('handles MAC addresses with all possible character combinations', () => {
      const validChars = '0123456789ABCDEF'
      const testMac = '00:00:0C:11:22:33'
      
      // Test with all valid characters
      for (const char of validChars) {
        const modifiedMac = testMac.replace('33', char + char)
        const result = lookupVendor(modifiedMac)
        expect(typeof result).toBe('string')
      }
    })

    it('handles MAC addresses with maximum length', () => {
      const maxLengthMac = '00:00:0C:11:22:33'
      expect(maxLengthMac.length).toBe(17)
      
      const result = lookupVendor(maxLengthMac)
      expect(result).toBe('Cisco')
    })
  })

  describe('Data integrity', () => {
    it('maintains data consistency across multiple calls', () => {
      const mac = '00:00:0C:11:22:33'
      const iterations = 100
      
      for (let i = 0; i < iterations; i++) {
        const result = lookupVendor(mac)
        expect(result).toBe('Cisco')
      }
    })

    it('returns consistent results for the same MAC', () => {
      const mac = '00:00:0C:11:22:33'
      const results = []
      
      for (let i = 0; i < 10; i++) {
        results.push(lookupVendor(mac))
      }
      
      expect(results.every(result => result === 'Cisco')).toBe(true)
    })

    it('handles database corruption gracefully', () => {
      // Simulate database corruption
      const { _db } = require('../oui')
      const originalData = { ..._db }
      
      // Corrupt the database
      _db.corrupted = true
      
      // Should still work without throwing
      const result = lookupVendor('00:00:0C:11:22:33')
      expect(result).toBe('')
      
      // Restore original data
      Object.assign(_db, originalData)
    })
  })

  describe('Error recovery', () => {
    it('recovers from invalid MAC format errors', () => {
      const invalidMacs = [
        '00:00:0C:11:22:33', // Valid
        'invalid-mac',         // Invalid
        '00:00:0C:11:22:33', // Valid again
      ]
      
      for (const mac of invalidMacs) {
        expect(() => lookupVendor(mac)).not.toThrow()
      }
    })

    it('continues working after cache clear', () => {
      const mac = '00:00:0C:11:22:33'
      
      // First lookup
      lookupVendor(mac)
      
      // Clear cache
      const { _vendorCache } = require('../oui')
      _vendorCache.clear()
      
      // Should still work
      const result = lookupVendor(mac)
      expect(result).toBe('Cisco')
    })
  })

  describe('Special scenarios', () => {
    it('handles MAC addresses with leading/trailing spaces', () => {
      const testCases = [
        { mac: '00:00:0C:11:22:33', vendor: 'Cisco' },
        { mac: ' 00:00:0C:11:22:33', vendor: 'Cisco' },
        { mac: '00:00:0C:11:22:33 ', vendor: 'Cisco' },
        { mac: ' 00:00:0C:11:22:33 ', vendor: 'Cisco' },
      ]
      
      for (const testCase of testCases) {
        expect(lookupVendor(testCase.mac)).toBe(testCase.vendor)
      }
    })

    it('handles MAC addresses with internal spaces', () => {
      const mac = '00:00:0C:11:22:33'
      const spacedMac = '00:00:0C :11:22:33' // Invalid format
      
      expect(lookupVendor(mac)).toBe('Cisco')
      expect(lookupVendor(spacedMac)).toBe('')
    })

    it('handles Unicode characters in MAC addresses', () => {
      const unicodeMacs = [
        '00:00:0C:11:22:33', // Normal
        '００:００:０Ｃ:11:22:33', // Full-width digits
        '00:00:0C:11:22:３３', // Mixed
      ]
      
      for (const mac of unicodeMacs) {
        const result = lookupVendor(mac)
        expect(typeof result).toBe('string')
      }
    })
  })

  describe('Regression tests', () => {
it('regression test for known issue #1 - memory leak', () => {
    const iterations = 1000
    const mac = '00:00:0C:11:22:33'
    
    // Perform many lookups
    for (let i = 0; i < iterations; i++) {
      lookupVendor(mac)
    }
    
    // Should still work correctly
    expect(lookupVendor(mac)).toBe('Cisco')
  })

    it('regression test for known issue #2 - case sensitivity', () => {
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

    it('regression test for known issue #3 - null handling', () => {
      expect(() => lookupVendor(null)).not.toThrow()
      expect(lookupVendor(null)).toBe('')
    })
  })
})