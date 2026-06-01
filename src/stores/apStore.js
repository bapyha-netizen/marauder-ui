import { defineStore } from 'pinia'
import { shallowRef, triggerRef, computed } from 'vue'

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

  const avgSignal = computed(() => {
    const aps = Array.from(accessPoints.value.values()).filter(ap => ap.rssi)
    if (!aps.length) return 0
    return Math.round(aps.reduce((s, ap) => s + ap.rssi, 0) / aps.length)
  })

  function _findExisting(ap) {
    if (ap.bssid) {
      const upper = ap.bssid.toUpperCase()
      for (const [k, v] of accessPoints.value.entries()) {
        if (v.bssid && v.bssid.toUpperCase() === upper) return k
      }
    }
    if (ap.index !== undefined && ap.index !== null) {
      for (const [k, v] of accessPoints.value.entries()) {
        if (v.index === ap.index) return k
      }
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
    const newMap = new Map(accessPoints.value)
    if (existingKey && existingKey !== newKey) newMap.delete(existingKey)
    newMap.set(newKey, newAP)
    accessPoints.value = newMap
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
    updateOrAddAP({ ...ap, stations })
  }

  function clearAPs() {
    accessPoints.value = new Map()
  }

  function clearSelected() {
    const newMap = new Map(accessPoints.value)
    for (const [key, ap] of newMap.entries()) {
      newMap.set(key, { ...ap, isSelected: false })
    }
    accessPoints.value = newMap
  }

  function updateAP(index, data) {
    for (const [key, ap] of accessPoints.value.entries()) {
      if (ap.index === index) {
        const newMap = new Map(accessPoints.value)
        newMap.set(key, { ...ap, ...data })
        accessPoints.value = newMap
        return
      }
    }
  }

  function removeOldAPs(maxAgeMs = 300000) {
    const now = Date.now()
    const newMap = new Map(accessPoints.value)
    let changed = false
    for (const [key, ap] of newMap.entries()) {
      if (now - new Date(ap.lastSeen).getTime() > maxAgeMs) {
        newMap.delete(key)
        changed = true
      }
    }
    if (changed) accessPoints.value = newMap
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
    for (const [key, ap] of accessPoints.value.entries()) {
      if (ap.bssid && ap.bssid.toUpperCase() === upper) return { key, ap }
    }
    return null
  }

  return {
    accessPoints, sortedAPs, apCount, totalStations,
    apByChannel, avgSignal,
    updateOrAddAP, addStation, clearAPs, clearSelected,
    updateAP, removeOldAPs, exportData, findAPByBSSID
  }
})