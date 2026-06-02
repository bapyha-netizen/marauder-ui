import { defineStore } from 'pinia'
import { shallowRef, triggerRef, computed, watch } from 'vue'
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
    const map = devices.value
    const existing = map.get(dev.mac)
    map.set(dev.mac, {
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
    for (const [mac, d] of map.entries()) {
      if (d.lastSeen.getTime() < cutoff) map.delete(mac)
    }
    triggerRef(devices)
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
    const current = devices.value
    let changed = false
    for (const dev of saved) {
      const key = dev.mac || dev.id
      if (!key) continue
      if (current.has(key)) continue
      const restored = {
        ...dev,
        firstSeen: dev.firstSeen ? new Date(dev.firstSeen) : new Date(),
        lastSeen: dev.lastSeen ? new Date(dev.lastSeen) : new Date()
      }
      delete restored.id
      current.set(key, restored)
      changed = true
    }
    if (changed) triggerRef(devices)
  }

  return {
    devices, sortedDevices, deviceCount, airtagCount,
    updateOrAddDevice, clearDevices, hydrate
  }
})
