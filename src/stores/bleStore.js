import { defineStore } from 'pinia'
import { shallowRef, computed } from 'vue'

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
  }

  const airtagCount = computed(() => {
    let count = 0
    devices.value.forEach(d => { if (d.isAirtag) count++ })
    return count
  })

  return {
    devices, sortedDevices, deviceCount, airtagCount,
    updateOrAddDevice, clearDevices
  }
})
