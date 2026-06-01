import { defineStore } from 'pinia'
import { shallowRef, computed, watch } from 'vue'
import { debouncedSave, loadStore, clearPersistedStore } from '../utils/persist'

const PERSIST_KEY = 'bleDevices'

export const useBleStore = defineStore('ble', () => {
  const devices = shallowRef(new Map())

  const sortedDevices = computed(() => {
    return Array.from(devices.value.values())
      .sort((a, b) => (b.rssi || -999) - (a.rssi || -999))
  })

  const deviceCount = computed(() => devices.value.size)

  function updateOrAddDevice(dev) {
    const now = new Date()
    const newMap = new Map(devices.value)
    const existing = newMap.get(dev.mac)
    newMap.set(dev.mac, {
      mac: dev.mac,
      name: dev.name || existing?.name || 'Unknown',
      rssi: dev.rssi ?? existing?.rssi,
      channel: dev.channel || existing?.channel,
      manufacturer: dev.manufacturer || existing?.manufacturer || '',
      services: dev.services || existing?.services || [],
      isAirtag: dev.isAirtag ?? existing?.isAirtag ?? false,
      firstSeen: existing?.firstSeen || now,
      lastSeen: dev.lastSeen || now,
      packetCount: (existing?.packetCount || 0) + 1
    })
    const cutoff = Date.now() - 300000
    for (const [mac, d] of newMap.entries()) {
      if (d.lastSeen.getTime() < cutoff) newMap.delete(mac)
    }
    devices.value = newMap
  }

  function clearDevices() {
    devices.value = new Map()
    clearPersistedStore(PERSIST_KEY)
  }

  const airtagCount = computed(() => {
    let count = 0
    devices.value.forEach(d => { if (d.isAirtag) count++ })
    return count
  })

  watch(devices, (map) => {
    const items = []
    for (const [key, dev] of map.entries()) {
      items.push({ ...dev, mac: key })
    }
    debouncedSave(PERSIST_KEY, items)
  }, { deep: false })

  async function hydrate() {
    const saved = await loadStore(PERSIST_KEY)
    if (!saved || saved.length === 0) return
    const existing = devices.value
    const merged = existing.size > 0 ? new Map(existing) : new Map()
    for (const dev of saved) {
      const key = dev.mac || dev.id
      if (!key) continue
      if (merged.has(key)) continue
      const restored = {
        ...dev,
        firstSeen: dev.firstSeen ? new Date(dev.firstSeen) : new Date(),
        lastSeen: dev.lastSeen ? new Date(dev.lastSeen) : new Date()
      }
      delete restored.id
      merged.set(key, restored)
    }
    devices.value = merged
  }

  return {
    devices, sortedDevices, deviceCount, airtagCount,
    updateOrAddDevice, clearDevices, hydrate
  }
})
