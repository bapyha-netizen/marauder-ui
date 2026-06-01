import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { debouncedSave, loadStore, clearPersistedStore, savePref, loadPref, cancelPendingSaves } from '../persist'
import { clearAll, getAll, _resetDbPromise } from '../idb'

const wait = (ms) => new Promise(r => setTimeout(r, ms))

describe('persist utility', () => {
  beforeEach(async () => {
    _resetDbPromise()
    await clearAll()
    cancelPendingSaves()
  })

  afterEach(() => {
    cancelPendingSaves()
    _resetDbPromise()
  })

  it('debouncedSave persists items after debounce window', async () => {
    debouncedSave('accessPoints', [
      { bssid: 'AA:BB:CC:11:22:33', essid: 'Home' },
      { bssid: '11:22:33:44:55:66', essid: 'Work' }
    ])
    expect(await getAll('accessPoints')).toHaveLength(0)
    await wait(1100)
    const saved = await getAll('accessPoints')
    expect(saved).toHaveLength(2)
    expect(saved.map(s => s.essid).sort()).toEqual(['Home', 'Work'])
  })

  it('debouncedSave collapses multiple calls within the window', async () => {
    debouncedSave('accessPoints', [{ bssid: 'A', v: 1 }])
    debouncedSave('accessPoints', [{ bssid: 'A', v: 2 }])
    debouncedSave('accessPoints', [{ bssid: 'A', v: 3 }])
    await wait(1100)
    const saved = await getAll('accessPoints')
    expect(saved).toHaveLength(1)
    expect(saved[0].v).toBe(3)
  })

  it('loadStore returns empty array on fresh store', async () => {
    const result = await loadStore('accessPoints')
    expect(result).toEqual([])
  })

  it('loadStore returns previously saved items', async () => {
    debouncedSave('accessPoints', [{ bssid: 'X', essid: 'Test' }])
    await wait(1100)
    const result = await loadStore('accessPoints')
    expect(result.length).toBe(1)
    expect(result[0].essid).toBe('Test')
  })

  it('clearPersistedStore removes data', async () => {
    debouncedSave('accessPoints', [{ bssid: 'X' }])
    await wait(1100)
    await clearPersistedStore('accessPoints')
    expect(await getAll('accessPoints')).toHaveLength(0)
  })

  it('savePref + loadPref round-trips', async () => {
    await savePref('theme', 'dark')
    const v = await loadPref('theme')
    expect(v).toBe('dark')
  })

  it('loadPref returns null for missing key', async () => {
    const v = await loadPref('nope')
    expect(v).toBeNull()
  })

  it('cancelPendingSaves stops pending writes', async () => {
    debouncedSave('accessPoints', [{ bssid: 'X' }])
    cancelPendingSaves()
    await wait(1100)
    expect(await getAll('accessPoints')).toHaveLength(0)
  })

  it('handles items with custom keys (probe pattern)', async () => {
    debouncedSave('probes', [
      { id: 'AA-BB-12345', rssi: -50, ssid: 'Test' }
    ])
    await wait(1100)
    const saved = await getAll('probes')
    expect(saved).toHaveLength(1)
    expect(saved[0].id).toBe('AA-BB-12345')
  })
})
