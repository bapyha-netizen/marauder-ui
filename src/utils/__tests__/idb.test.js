import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import { putItem, getItem, getAll, clearStore, clearAll, putAll, IDB_STORES, _resetDbPromise } from '../idb'

describe('idb wrapper', () => {
  beforeEach(async () => {
    _resetDbPromise()
    await clearAll()
  })

  afterEach(() => {
    _resetDbPromise()
  })

  it('exports the list of store names', () => {
    expect(IDB_STORES).toContain('accessPoints')
    expect(IDB_STORES).toContain('bleDevices')
    expect(IDB_STORES).toContain('probes')
    expect(IDB_STORES).toContain('preferences')
    expect(IDB_STORES).toContain('stats')
  })

  it('putItem/getItem round-trips data with a string key', async () => {
    await putItem('preferences', { id: 'theme', value: 'dark' })
    const result = await getItem('preferences', 'theme')
    expect(result).toBeTruthy()
    expect(result.value).toBe('dark')
  })

  it('getItem returns null for missing key', async () => {
    const result = await getItem('preferences', 'nope')
    expect(result).toBeNull()
  })

  it('putAll + getAll returns all items', async () => {
    await putAll('accessPoints', [
      { id: 'AA:BB:CC:11:22:33', bssid: 'AA:BB:CC:11:22:33', essid: 'Home' },
      { id: '11:22:33:44:55:66', bssid: '11:22:33:44:55:66', essid: 'Work' }
    ])
    const all = await getAll('accessPoints')
    expect(all).toHaveLength(2)
    expect(all.map(a => a.essid).sort()).toEqual(['Home', 'Work'])
  })

  it('putAll with empty array resolves immediately', async () => {
    await expect(putAll('accessPoints', [])).resolves.toBeUndefined()
  })

  it('clearStore empties only the specified store', async () => {
    await putAll('accessPoints', [{ id: 'A', bssid: 'A' }])
    await putAll('bleDevices', [{ id: 'B', mac: 'B' }])
    await clearStore('accessPoints')
    expect(await getAll('accessPoints')).toHaveLength(0)
    expect(await getAll('bleDevices')).toHaveLength(1)
  })

  it('clearAll empties every store', async () => {
    await putAll('accessPoints', [{ id: 'A' }])
    await putAll('bleDevices', [{ id: 'B' }])
    await putAll('probes', [{ id: 'C' }])
    await clearAll()
    for (const s of IDB_STORES) {
      expect(await getAll(s)).toHaveLength(0)
    }
  })

  it('putItem overwrites existing value at the same key', async () => {
    await putItem('preferences', { id: 'k', value: 'v1' })
    await putItem('preferences', { id: 'k', value: 'v2' })
    const r = await getItem('preferences', 'k')
    expect(r.value).toBe('v2')
  })

  it('handles many items in a single putAll transaction', async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: `K${i}`, data: i }))
    await putAll('accessPoints', items)
    const all = await getAll('accessPoints')
    expect(all).toHaveLength(100)
  })
})
