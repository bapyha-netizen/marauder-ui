import { defineStore } from 'pinia'
import { shallowRef, triggerRef, computed, watch, ref } from 'vue'
import { debouncedSave, loadStore, clearPersistedStore } from '../utils/persist'
import type { BLEDevice } from '../types'

const PERSIST_KEY = 'bleDevices'

interface BLEDeviceRecord extends BLEDevice {
  channel?: number
  services?: string[]
  firstSeen: Date
  packetCount: number
}

export const useBleStore = defineStore('ble', () => {
  const devices = shallowRef<Map<string, BLEDeviceRecord>>(new Map())
  const MAX_BLE_DEVICES = 2000
  let _evictionCounter = 0

  const sortedDevices = computed(() => {
    void devices.value
    return Array.from(devices.value.values())
      .sort((a, b) => (b.rssi || -999) - (a.rssi || -999))
  })

  const deviceCount = computed(() => devices.value.size)

  function updateOrAddDevice(dev: Partial<BLEDeviceRecord> & { mac: string }) {
    const now = new Date()
    const map = devices.value
    if (!map.has(dev.mac) && map.size >= MAX_BLE_DEVICES) {
      if (++_evictionCounter % 100 === 0) {
        const sorted = Array.from(map.entries())
          .sort((a, b) => a[1].lastSeen.getTime() - b[1].lastSeen.getTime())
        for (let i = 0; i < 100 && i < sorted.length; i++) {
          map.delete(sorted[i][0])
        }
      }
    }
    const existing = map.get(dev.mac)
    const nowMs = Date.now()
    const increment = existing && ((nowMs - existing.lastSeen.getTime()) > 100) ? 1 : 0
    map.set(dev.mac, {
      mac: dev.mac,
      name: dev.name || existing?.name || 'Unknown',
      rssi: dev.rssi ?? existing?.rssi ?? null,
      channel: dev.channel || existing?.channel,
      manufacturer: dev.manufacturer || existing?.manufacturer || '',
      services: dev.services || existing?.services || [],
      isAirtag: dev.isAirtag ?? existing?.isAirtag ?? false,
      firstSeen: existing?.firstSeen || now,
      lastSeen: dev.lastSeen || now,
      packetCount: (existing?.packetCount || 0) + increment
    })
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
    const items: Record<string, unknown>[] = []
    for (const [key, dev] of map.entries()) {
      items.push({ ...dev, mac: key })
    }
    debouncedSave(PERSIST_KEY, items)
  }, { deep: false })

  let _hydrated = false

  async function hydrate() {
    if (_hydrated) return
    _hydrated = true
    const saved = await loadStore(PERSIST_KEY)
    if (!saved || saved.length === 0) return
    const current = devices.value
    let changed = false
    for (const dev of saved) {
      if (!dev || typeof dev !== 'object') continue
      const key = (typeof dev.mac === 'string' ? dev.mac : null) || (typeof dev.id === 'string' ? dev.id : null)
      if (!key) continue
      if (current.has(key)) continue
      const restored: BLEDeviceRecord = {
        ...(dev as unknown as BLEDeviceRecord),
        firstSeen: dev.firstSeen ? new Date(dev.firstSeen as string) : new Date(),
        lastSeen: dev.lastSeen ? new Date(dev.lastSeen as string) : new Date()
      }
      delete (restored as unknown as Record<string, unknown>).id
      current.set(key, restored)
      changed = true
    }
    if (changed) {
      // Sorted devices are computed, no need to manually update
    }
  }

  return {
    devices, sortedDevices, deviceCount, airtagCount,
    updateOrAddDevice, clearDevices, hydrate
  }
})
