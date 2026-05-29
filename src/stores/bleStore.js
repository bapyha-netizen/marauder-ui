import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useBleStore = defineStore('ble', () => {
  const devices = ref(new Map())

  const sortedDevices = computed(() => {
    return Array.from(devices.value.values())
      .sort((a, b) => (b.rssi || -999) - (a.rssi || -999))
  })

  const deviceCount = computed(() => devices.value.size)

  function updateOrAddDevice(dev) {
    const existing = devices.value.get(dev.mac)
    const now = new Date()
    const updated = {
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
    }
    const newMap = new Map(devices.value)
    newMap.set(dev.mac, updated)
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
