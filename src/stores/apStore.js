import { defineStore } from 'pinia'
import { shallowRef, triggerRef, computed, watch } from 'vue'
import { debouncedSave, loadStore, clearPersistedStore } from '../utils/persist'

const PERSIST_KEY = 'accessPoints'

export const useApStore = defineStore('ap', () => {
  const accessPoints = shallowRef(new Map())

  const sortedAPs = computed(() => {
    return Array.from(accessPoints.value.values())
      .sort((a, b) => (b.rssi || -999) - (a.rssi || -999))
  })

  const apCount = computed(() => accessPoints.value.size)

  const totalStations = computed(() => {
    let count = 0
    accessPoints.value.forEach(ap => {
      count += (ap.stations?.length || 0)
    })
    return count
  })

  const apByChannel = computed(() => {
    const ch = {}
    accessPoints.value.forEach(ap => {
      const c = ap.channel || 0
      ch[c] = (ch[c] || 0) + 1
    })
    return ch
  })

  const _byBssid = shallowRef(new Map())
  const _byIndex = shallowRef(new Map())

  function _rebuildIndexes() {
    const bssidMap = new Map()
    const indexMap = new Map()
    accessPoints.value.forEach((ap, key) => {
      if (ap.bssid) bssidMap.set(ap.bssid.toUpperCase(), key)
      if (ap.index !== undefined && ap.index !== null) indexMap.set(ap.index, key)
    })
    _byBssid.value = bssidMap
    _byIndex.value = indexMap
  }

  function _updateIndexesForKey(key, ap) {
    if (ap.bssid) _byBssid.value.set(ap.bssid.toUpperCase(), key)
    else _byBssid.value.delete(ap.bssid?.toUpperCase() || '')

    if (ap.index !== undefined && ap.index !== null) _byIndex.value.set(ap.index, key)
    else _byIndex.value.delete(ap.index)
  }

  function _removeIndexesForKey(key) {
    const ap = accessPoints.value.get(key)
    if (ap) {
      if (ap.bssid) _byBssid.value.delete(ap.bssid.toUpperCase())
      if (ap.index !== undefined && ap.index !== null) _byIndex.value.delete(ap.index)
    }
  }

  const avgSignal = computed(() => {
    const aps = Array.from(accessPoints.value.values()).filter(ap => ap.rssi)
    if (!aps.length) return 0
    return Math.round(aps.reduce((s, ap) => s + ap.rssi, 0) / aps.length)
  })

  function _findExisting(ap) {
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
    if (ap.channel !== undefined && ap.essid) {
      const fk = `${ap.channel}-${ap.essid}`
      if (accessPoints.value.has(fk)) return fk
    }
    return null
  }

  function updateOrAddAP(ap) {
    const existingKey = _findExisting(ap)
    const existing = existingKey ? accessPoints.value.get(existingKey) : null
    const newKey = ap.bssid ? ap.bssid.toUpperCase()
      : existingKey || `_ap:${ap.channel ?? '?'}:${ap.essid || ''}:${ap.index ?? Date.now()}`
    const now = new Date()
    if (existing && existingKey === newKey) {
      Object.assign(existing, {
        index: ap.index ?? existing.index,
        essid: ap.essid || existing.essid,
        bssid: ap.bssid || existing.bssid,
        channel: ap.channel ?? existing.channel,
        rssi: ap.rssi !== undefined ? ap.rssi : existing.rssi,
        encryption: ap.encryption || existing.encryption || '',
        isHidden: ap.isHidden ?? existing.isHidden ?? false,
        isSelected: ap.isSelected ?? existing.isSelected ?? false,
        lastSeen: ap.lastSeen || now,
        stations: ap.stations || existing.stations,
        vendor: ap.vendor || existing.vendor || '',
        frameCount: (existing.frameCount || 0) + (ap.frameCount || 0)
      })
      _updateIndexesForKey(newKey, existing)
      if (existing.rssi != null) {
        existing.rssiHistory.push(existing.rssi)
        if (existing.rssiHistory.length > 20) existing.rssiHistory.shift()
      }
      triggerRef(accessPoints)
      return
    }
    const newAP = {
      index: ap.index ?? existing?.index,
      essid: ap.essid || existing?.essid || '(hidden)',
      bssid: ap.bssid || existing?.bssid || '',
      channel: ap.channel ?? existing?.channel,
      rssi: ap.rssi !== undefined ? ap.rssi : existing?.rssi,
      encryption: ap.encryption || existing?.encryption || '',
      isHidden: ap.isHidden ?? existing?.isHidden ?? false,
      isSelected: ap.isSelected ?? existing?.isSelected ?? false,
      lastSeen: ap.lastSeen || now,
      stations: existing?.stations || [],
      vendor: ap.vendor || existing?.vendor || '',
      frameCount: (existing?.frameCount || 0) + (ap.frameCount || 0),
      rssiHistory: existing?.rssiHistory ? [...existing.rssiHistory] : []
    }
    if (newAP.rssi != null) {
      newAP.rssiHistory.push(newAP.rssi)
      if (newAP.rssiHistory.length > 20) newAP.rssiHistory.shift()
    }
    if (existingKey && existingKey !== newKey) {
      _removeIndexesForKey(existingKey)
      accessPoints.value.delete(existingKey)
    }
    accessPoints.value.set(newKey, newAP)
    _updateIndexesForKey(newKey, newAP)
    triggerRef(accessPoints)
  }

  function addStation(apKey, station) {
    const ap = accessPoints.value.get(apKey)
    if (!ap) return
    const stations = [...(ap.stations || [])]
    const idx = stations.findIndex(s => s.mac === station.mac)
    if (idx >= 0) {
      stations[idx] = { ...stations[idx], ...station, lastSeen: new Date() }
    } else {
      stations.push({ ...station, lastSeen: new Date() })
    }
    stations.sort((a, b) => (a.id || 0) - (b.id || 0))
    Object.assign(ap, { stations })
    triggerRef(accessPoints)
  }

  function clearAPs() {
    accessPoints.value = new Map()
    _byBssid.value = new Map()
    _byIndex.value = new Map()
    clearPersistedStore(PERSIST_KEY)
  }

  function clearSelected() {
    for (const [key, ap] of accessPoints.value.entries()) {
      accessPoints.value.set(key, { ...ap, isSelected: false })
    }
    triggerRef(accessPoints)
  }

  function updateAP(index, data) {
    const key = _byIndex.value.get(index)
    if (!key) return
    const ap = accessPoints.value.get(key)
    if (!ap) return
    Object.assign(ap, data)
    _updateIndexesForKey(key, ap)
    triggerRef(accessPoints)
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
    if (changed) triggerRef(accessPoints)
  }

  function exportData() {
    return Array.from(accessPoints.value.values()).map(ap => ({
      index: ap.index, essid: ap.essid, bssid: ap.bssid,
      channel: ap.channel, rssi: ap.rssi, encryption: ap.encryption,
      isHidden: ap.isHidden, isSelected: ap.isSelected,
      vendor: ap.vendor, lastSeen: ap.lastSeen,
      rssiHistory: ap.rssiHistory,
      stations: ap.stations?.map(s => ({ id: s.id, mac: s.mac, vendor: s.vendor, lastSeen: s.lastSeen }))
    }))
  }

  function findAPByBSSID(bssid) {
    const upper = bssid.toUpperCase()
    const key = _byBssid.value.get(upper)
    if (key) {
      const ap = accessPoints.value.get(key)
      if (ap) return { key, ap }
    }
    if (accessPoints.value.has(upper)) {
      return { key: upper, ap: accessPoints.value.get(upper) }
    }
    return null
  }

  function findAPByIndex(index) {
    const key = _byIndex.value.get(index)
    if (!key) return null
    const ap = accessPoints.value.get(key)
    return ap ? { key, ap } : null
  }

  watch(accessPoints, (map) => {
    _rebuildIndexes()
    const items = []
    for (const [key, ap] of map.entries()) {
      items.push({ ...ap, bssid: key })
    }
    debouncedSave(PERSIST_KEY, items)
  }, { deep: false })

  async function hydrate() {
    const saved = await loadStore(PERSIST_KEY)
    if (!saved || saved.length === 0) {
      _rebuildIndexes()
      return
    }
    const current = accessPoints.value
    let changed = false
    for (const ap of saved) {
      const key = ap.bssid || ap.id
      if (!key) continue
      if (current.has(key)) continue
      const restored = { ...ap, lastSeen: ap.lastSeen ? new Date(ap.lastSeen) : new Date() }
      if (restored.stations) {
        restored.stations = restored.stations.map(s => ({
          ...s,
          lastSeen: s.lastSeen ? new Date(s.lastSeen) : new Date()
        }))
      }
      if (restored.rssiHistory) {
        restored.rssiHistory = [...restored.rssiHistory]
      }
      delete restored.id
      current.set(key, restored)
      changed = true
    }
    if (changed) _rebuildIndexes()
    if (changed) triggerRef(accessPoints)
  }

  return {
    accessPoints, sortedAPs, apCount, totalStations,
    apByChannel, avgSignal,
    updateOrAddAP, addStation, clearAPs, clearSelected,
    updateAP, removeOldAPs, exportData, findAPByBSSID, findAPByIndex,
    hydrate
  }
})