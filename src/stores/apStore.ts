import { defineStore } from 'pinia'
import { shallowRef, triggerRef, computed, watch, ref } from 'vue'
import { debouncedSave, loadStore, clearPersistedStore } from '../utils/persist'
import type { AccessPoint, Station } from '../types'

const PERSIST_KEY = 'accessPoints'

interface StationRecord extends Station {
  lastSeen?: Date
  vendor?: string
}

interface APOpaque extends AccessPoint {
  rssiHistory: number[]
  frameCount: number
  stations: StationRecord[]
}

export const useApStore = defineStore('ap', () => {
  const accessPoints = shallowRef<Map<string, APOpaque>>(new Map())

  const sortedAPs = computed(() => {
    void accessPoints.value
    return Array.from(accessPoints.value.values())
      .sort((a, b) => (b.rssi || -999) - (a.rssi || -999))
  })

  const apCount = computed(() => accessPoints.value.size)

  const _totalStations = shallowRef(0)
  const _apByChannel = shallowRef<Record<number, number>>({})
  const _signalSum = shallowRef(0)
  const _signalCount = shallowRef(0)
  const avgSignal = computed(() => _signalCount.value > 0 ? Math.round(_signalSum.value / _signalCount.value) : 0)

  const totalStations = computed(() => _totalStations.value)
  const apByChannel = computed(() => _apByChannel.value)

  const _byBssid = shallowRef<Map<string, string>>(new Map())
  const _byIndex = shallowRef<Map<number, string>>(new Map())

  function _rebuildIndexes() {
    const bssidMap = new Map<string, string>()
    const indexMap = new Map<number, string>()
    for (const [key, ap] of accessPoints.value.entries()) {
      if (ap.bssid) {
        bssidMap.set(ap.bssid.toUpperCase(), key)
      }
      if (ap.index !== undefined && ap.index !== null) {
        indexMap.set(ap.index, key)
      }
    }
    _byBssid.value = bssidMap
    _byIndex.value = indexMap
  }

  function _validateAndFixIndexes() {
    // D-03: Validate and fix orphaned or conflicting indexes
    const indexMap = new Map(_byIndex.value)
    const bssidMap = new Map(_byBssid.value)
    const usedIndexes = new Set<number>()
    const fixedAPs = new Map<string, APOpaque>()
    
    // First pass: find all valid index references
    for (const [key, ap] of accessPoints.value.entries()) {
      if (ap.index !== undefined && ap.index !== null) {
        if (indexMap.get(ap.index) !== key) {
          // This index points to a different key or is missing
          indexMap.delete(ap.index)
          fixedAPs.set(key, { ...ap, index: undefined })
        } else {
          usedIndexes.add(ap.index)
        }
      }
    }
    
    // Second pass: resolve conflicts and fix orphaned references
    for (const [key, ap] of accessPoints.value.entries()) {
      if (ap.index !== undefined && ap.index !== null) {
        if (usedIndexes.has(ap.index) && indexMap.get(ap.index) !== key) {
          // Index conflict found, find next available index
          let newIndex = 0
          while (usedIndexes.has(newIndex)) {
            newIndex++
          }
          ap.index = newIndex
          usedIndexes.add(newIndex)
          indexMap.set(newIndex, key)
          fixedAPs.set(key, ap)
        }
      }
    }
    
    // Apply fixes
    if (fixedAPs.size > 0) {
      for (const [key, ap] of fixedAPs) {
        accessPoints.value.set(key, ap)
      }
      _rebuildIndexes()
      return fixedAPs.size
    }
    
    return 0
  }

  function _updateIndexesForKey(key: string, ap: APOpaque) {
    const newBssid = new Map(_byBssid.value)
    const newIndex = new Map(_byIndex.value)
    // Q-10: always delete the previous bssid mapping for this key to avoid
    // stale entries when an AP loses its BSSID. Look up the existing entry
    // first so we know which key to drop.
    const prevAp = accessPoints.value.get(key)
    if (prevAp?.bssid) {
      newBssid.delete(prevAp.bssid.toUpperCase())
    }
    if (prevAp?.index !== undefined && prevAp?.index !== null) {
      newIndex.delete(prevAp.index)
    }
    if (ap.bssid) {
      newBssid.set(ap.bssid.toUpperCase(), key)
    }
    if (ap.index !== undefined && ap.index !== null) {
      // D-03: Check for index conflicts and resolve them
      const existingKeyForIndex = newIndex.get(ap.index)
      if (existingKeyForIndex && existingKeyForIndex !== key) {
        // Another AP already has this index, resolve the conflict
        const conflictingAp = accessPoints.value.get(existingKeyForIndex)
        if (conflictingAp) {
          // Find the next available index
          let newIndexValue = ap.index
          while (newIndex.has(newIndexValue)) {
            newIndexValue++
          }
          // Update the conflicting AP to use the new index
          conflictingAp.index = newIndexValue
          _updateIndexesForKey(existingKeyForIndex, conflictingAp)
        }
      }
      newIndex.set(ap.index, key)
    }
    _byBssid.value = newBssid
    _byIndex.value = newIndex
  }

  function _removeIndexesForKey(key: string) {
    // D-03: always scrub the index maps for the given key, even if the AP
    // record is no longer in the main map. The caller is signaling "this
    // key is gone"; partial cleanup leaves stale lookups behind.
    const ap = accessPoints.value.get(key)
    const prevBssid = ap?.bssid
    const prevIndex = ap?.index
    const newBssid = new Map(_byBssid.value)
    const newIndex = new Map(_byIndex.value)
    if (prevBssid) newBssid.delete(prevBssid.toUpperCase())
    if (prevIndex !== undefined && prevIndex !== null) newIndex.delete(prevIndex)
    // Defensive: also drop any map entries that point back to this key.
    for (const [b, k] of newBssid.entries()) {
      if (k === key) newBssid.delete(b)
    }
    for (const [i, k] of newIndex.entries()) {
      if (k === key) newIndex.delete(i)
    }
    _byBssid.value = newBssid
    _byIndex.value = newIndex
  }

  function _isValidRssi(rssi: unknown): rssi is number {
    return typeof rssi === 'number' && !Number.isNaN(rssi)
  }

  function _recomputeStats() {
    let total = 0
    const ch: Record<number, number> = {}
    let rssiSum = 0
    let rssiCount = 0
    for (const ap of accessPoints.value.values()) {
      total += (ap.stations?.length || 0)
      const c = ap.channel || 0
      if (c !== 0) ch[c] = (ch[c] || 0) + 1
      if (_isValidRssi(ap.rssi)) {
        rssiSum += ap.rssi
        rssiCount++
      }
    }
    _totalStations.value = total
    _apByChannel.value = ch
    _signalSum.value = rssiSum
    _signalCount.value = rssiCount
  }

  function _statsForAP(ap: APOpaque) {
    return {
      stations: ap.stations?.length || 0,
      channel: ap.channel || 0,
      rssi: _isValidRssi(ap.rssi) ? ap.rssi : null
    }
  }

  function _applyStatsDelta(prev: ReturnType<typeof _statsForAP> | null, next: ReturnType<typeof _statsForAP> | null) {
    if (prev?.stations !== next?.stations) {
      const delta = (next?.stations || 0) - (prev?.stations || 0)
      _totalStations.value = Math.max(0, _totalStations.value + delta)
    }
    if (prev?.channel !== next?.channel) {
      const ch = { ..._apByChannel.value }
      if (prev && prev.channel !== 0) {
        ch[prev.channel] = Math.max(0, (ch[prev.channel] || 0) - 1)
        if (ch[prev.channel] === 0) delete ch[prev.channel]
      }
      if (next && next.channel !== 0) {
        ch[next.channel] = (ch[next.channel] || 0) + 1
      }
      _apByChannel.value = ch
    }
    if ((prev?.rssi ?? null) !== (next?.rssi ?? null)) {
      if (prev && prev.rssi != null) {
        _signalSum.value -= prev.rssi
        _signalCount.value = Math.max(0, _signalCount.value - 1)
      }
      if (next && next.rssi != null) {
        _signalSum.value += next.rssi
        _signalCount.value += 1
      }
    }
  }

  function _removeAPStats(ap: APOpaque) {
    _applyStatsDelta(_statsForAP(ap), null)
  }

  function _findExisting(ap: Partial<APOpaque>): string | null {
    if (ap.bssid) {
      const upper = ap.bssid.toUpperCase()
      const key = _byBssid.value.get(upper)
      if (key) return key
      if (accessPoints.value.has(upper)) return upper
    }
    if (ap.index !== undefined && ap.index !== null) {
      const key = _byIndex.value.get(ap.index)
      if (key) return key
    }
    return null
  }

  const MAX_APS = 1000

  function _newAnonymousKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `_ap:${crypto.randomUUID()}`
    }
    return `_ap:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }

  function updateOrAddAP(ap: Partial<APOpaque>) {
    const existingKey = _findExisting(ap)
    const existing = existingKey ? accessPoints.value.get(existingKey) : null
    const newKey = ap.bssid ? ap.bssid.toUpperCase()
      : existingKey || _newAnonymousKey()
    const now = new Date()
    if (existing && existingKey === newKey) {
      const merged: APOpaque = {
        ...existing,
        index: ap.index ?? existing.index,
        essid: ap.essid || existing.essid,
        bssid: ap.bssid || existing.bssid,
        channel: ap.channel ?? existing.channel,
        rssi: ap.rssi !== undefined ? ap.rssi : existing.rssi,
        encryption: ap.encryption || existing.encryption || '',
        isHidden: ap.isHidden ?? existing.isHidden ?? false,
        isSelected: ap.isSelected ?? existing.isSelected ?? false,
        lastSeen: ap.lastSeen || now,
        stations: ap.stations
          ? [...existing.stations, ...ap.stations].filter((s, i, arr) =>
              arr.findIndex(x => x.mac === s.mac) === i
            )
          : existing.stations,
        vendor: ap.vendor || existing.vendor || '',
        frameCount: (existing.frameCount || 0) + (ap.frameCount || 0)
      }
      if (existing.rssi != null) {
        const newHistory = [...existing.rssiHistory, existing.rssi]
        if (newHistory.length > 20) newHistory.shift()
        merged.rssiHistory = newHistory
      }
      _updateIndexesForKey(newKey, merged)
      accessPoints.value.set(newKey, merged)
      triggerRef(accessPoints)
      return
    }
    const newAP: APOpaque = {
      index: ap.index ?? existing?.index,
      essid: ap.essid || existing?.essid || '(hidden)',
      bssid: ap.bssid || existing?.bssid || '',
      channel: ap.channel ?? existing?.channel ?? 0,
      rssi: ap.rssi !== undefined ? ap.rssi : existing?.rssi ?? null,
      encryption: ap.encryption || existing?.encryption || '',
      isHidden: ap.isHidden ?? existing?.isHidden ?? false,
      isSelected: ap.isSelected ?? existing?.isSelected ?? false,
      lastSeen: ap.lastSeen || now,
      stations: existing?.stations || [],
      vendor: ap.vendor || existing?.vendor || '',
      frameCount: (existing?.frameCount || 0) + (ap.frameCount || 0),
      rssiHistory: existing?.rssiHistory ? [...existing.rssiHistory] : []
    }
    _updateIndexesForKey(newKey, newAP)
    accessPoints.value.set(newKey, newAP)
    if (accessPoints.value.size > MAX_APS) {
      const it = accessPoints.value.keys()
      let oldestKey = it.next().value
      let oldestTime = Infinity
      for (const [k, ap] of accessPoints.value) {
        const t = ap.lastSeen?.getTime() || 0
        if (t < oldestTime) { oldestTime = t; oldestKey = k }
      }
      if (oldestKey) {
        const oldestAp = accessPoints.value.get(oldestKey)
        if (oldestAp) _removeAPStats(oldestAp)
        _removeIndexesForKey(oldestKey)
        accessPoints.value.delete(oldestKey)
      }
    }
    triggerRef(accessPoints)
  }

  function addStation(apKey: string, station: StationRecord) {
    const ap = accessPoints.value.get(apKey)
    if (!ap) return
    const stations = [...(ap.stations || [])]
    const idx = stations.findIndex(s => s.mac === station.mac)
    if (idx >= 0) {
      stations[idx] = { ...stations[idx], ...station, lastSeen: new Date() }
    } else {
      stations.push({ ...station, lastSeen: new Date() })
    }
    // D-04: station id may legitimately be 0; use stable sort by ID with fallback
    // to insertion order. Pre-compute fallback indices to avoid O(n²) performance.
    const stationsWithFallback = stations.map((station, index) => ({
      ...station,
      _fallbackIndex: index
    }))
    stationsWithFallback.sort((a, b) => {
      const aId = a.id ?? a._fallbackIndex
      const bId = b.id ?? b._fallbackIndex
      return aId - bId
    })
    const updatedStations = stationsWithFallback.map(s => ({ 
      id: s.id, 
      mac: s.mac, 
      vendor: s.vendor, 
      lastSeen: s.lastSeen, 
      isSelected: s.isSelected 
    }))
    const updated: APOpaque = { ...ap, stations: updatedStations }
    accessPoints.value.set(apKey, updated)
    triggerRef(accessPoints)
  }

  function clearAPs() {
    accessPoints.value = new Map()
    _byBssid.value = new Map()
    _byIndex.value = new Map()
    _totalStations.value = 0
    _apByChannel.value = {}
    _signalSum.value = 0
    _signalCount.value = 0
    clearPersistedStore(PERSIST_KEY)
  }

  function clearSelected() {
    // Use immutable updates for consistency
    const updates: Array<[string, APOpaque]> = []
    for (const [key, ap] of accessPoints.value.entries()) {
      if (ap.isSelected) {
        updates.push([key, { ...ap, isSelected: false }])
      }
    }
    if (updates.length === 0) return
    for (const [key, updatedAp] of updates) {
      accessPoints.value.set(key, updatedAp)
    }
    triggerRef(accessPoints)
  }

  function updateAP(index: number, data: Partial<APOpaque>) {
    const key = _byIndex.value.get(index)
    if (!key) return
    const ap = accessPoints.value.get(key)
    if (!ap) return
    const next: APOpaque = { ...ap, ...data }
    _updateIndexesForKey(key, next)
    accessPoints.value.set(key, next)
  }

  function removeOldAPs(maxAgeMs = 300000) {
    const now = Date.now()
    let changed = false
    for (const [key, ap] of accessPoints.value.entries()) {
      if (now - new Date(ap.lastSeen).getTime() > maxAgeMs) {
        _removeIndexesForKey(key)
        accessPoints.value.delete(key)
        changed = true
      }
    }
    if (changed) {
      // Sorted APs are computed, no need to manually update
    }
  }

  function exportData() {
    return Array.from(accessPoints.value.values()).map(ap => ({
      index: ap.index, essid: ap.essid, bssid: ap.bssid,
      channel: ap.channel, rssi: ap.rssi, encryption: ap.encryption,
      isHidden: ap.isHidden, isSelected: ap.isSelected,
      vendor: ap.vendor, lastSeen: ap.lastSeen,
      rssiHistory: ap.rssiHistory,
      stations: ap.stations?.map((s: StationRecord) => ({ id: s.id, mac: s.mac, vendor: s.vendor, lastSeen: s.lastSeen }))
    }))
  }

  function findAPByBSSID(bssid: string) {
    const upper = bssid.toUpperCase()
    const key = _byBssid.value.get(upper)
    if (key) {
      const ap = accessPoints.value.get(key)
      if (ap) return { key, ap }
    }
    if (accessPoints.value.has(upper)) {
      return { key: upper, ap: accessPoints.value.get(upper)! }
    }
    return null
  }

  function findAPByIndex(index: number) {
    const key = _byIndex.value.get(index)
    if (!key) return null
    const ap = accessPoints.value.get(key)
    return ap ? { key, ap } : null
  }

  watch(accessPoints, (map) => {
    _rebuildIndexes()
    _recomputeStats()
    const items: Record<string, unknown>[] = []
    for (const [, ap] of map.entries()) {
      items.push({ ...ap })
    }
    debouncedSave(PERSIST_KEY, items)
  }, { deep: false })

  async function hydrate() {
    const saved = await loadStore(PERSIST_KEY)
    if (!saved || saved.length === 0) {
      _rebuildIndexes()
      _recomputeStats()
      return
    }
    const current = accessPoints.value
    let changed = false
    for (const ap of saved) {
      if (!ap || typeof ap !== 'object') continue
      const key = (typeof ap.bssid === 'string' ? ap.bssid : null) || (typeof ap.id === 'string' ? ap.id : null)
      if (!key) continue
      if (current.has(key)) continue
      const stations = ap.stations && Array.isArray(ap.stations)
        ? ap.stations.map(s => ({
            ...s,
            lastSeen: s.lastSeen ? new Date(s.lastSeen) : new Date()
          }))
        : []
      const restored: APOpaque = {
        ...(ap as unknown as APOpaque),
        lastSeen: ap.lastSeen ? new Date(ap.lastSeen as string) : new Date(),
        stations,
        rssiHistory: Array.isArray(ap.rssiHistory) ? [...ap.rssiHistory] : [],
        frameCount: typeof ap.frameCount === 'number' ? ap.frameCount : 0
      }
      delete (restored as unknown as Record<string, unknown>).id
      current.set(key, restored)
      changed = true
    }
    if (changed) _rebuildIndexes()
    if (changed) {
      // D-03: Validate and fix any orphaned indexes after hydration
      const fixedCount = _validateAndFixIndexes()
      if (fixedCount > 0) {
        console.log(`Fixed ${fixedCount} orphaned indexes during hydration`)
      }
      _recomputeStats()
      triggerRef(accessPoints)
    }
  }

  return {
    accessPoints, sortedAPs, apCount, totalStations,
    apByChannel, avgSignal,
    updateOrAddAP, addStation, clearAPs, clearSelected,
    updateAP, removeOldAPs, exportData, findAPByBSSID, findAPByIndex,
    hydrate
  }
})
