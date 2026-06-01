import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { setActivePinia, createPinia } from 'pinia'

import { useApStore } from '../../stores/apStore'
import { useBleStore } from '../../stores/bleStore'
import { useProbeStore } from '../../stores/probeStore'
import { clearAll, getAll, _resetDbPromise } from '../../utils/idb'
import { debouncedSave, cancelPendingSaves } from '../../utils/persist'

const wait = (ms) => new Promise(r => setTimeout(r, ms))

describe('store persistence', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    _resetDbPromise()
    await clearAll()
    cancelPendingSaves()
  })

  afterEach(() => {
    cancelPendingSaves()
    _resetDbPromise()
  })

  describe('apStore', () => {
    it('persists AP after updateOrAddAP', async () => {
      const apStore = useApStore()
      apStore.updateOrAddAP({
        bssid: 'AA:BB:CC:11:22:33',
        essid: 'Home',
        channel: 6,
        rssi: -65
      })
      await wait(1100)
      const saved = await getAll('accessPoints')
      expect(saved).toHaveLength(1)
      expect(saved[0].bssid).toBe('AA:BB:CC:11:22:33')
      expect(saved[0].essid).toBe('Home')
    })

    it('hydrates from IndexedDB on demand', async () => {
      const apStore1 = useApStore()
      apStore1.updateOrAddAP({
        bssid: '11:22:33:44:55:66',
        essid: 'Persisted',
        channel: 11,
        rssi: -80
      })
      await wait(1100)

      _resetDbPromise()
      setActivePinia(createPinia())
      const apStore2 = useApStore()
      expect(apStore2.accessPoints.size).toBe(0)
      await apStore2.hydrate()
      expect(apStore2.accessPoints.size).toBe(1)
      const ap = apStore2.accessPoints.get('11:22:33:44:55:66')
      expect(ap.essid).toBe('Persisted')
      expect(ap.channel).toBe(11)
    })

    it('clearAPs also clears persisted data', async () => {
      const apStore = useApStore()
      apStore.updateOrAddAP({ bssid: 'A', essid: 'A' })
      await wait(1100)
      expect(await getAll('accessPoints')).toHaveLength(1)
      apStore.clearAPs()
      expect(await getAll('accessPoints')).toHaveLength(0)
    })
  })

  describe('bleStore', () => {
    it('persists BLE device after updateOrAddDevice', async () => {
      const bleStore = useBleStore()
      bleStore.updateOrAddDevice({
        mac: 'AA:BB:CC:11:22:33',
        name: 'iPhone',
        rssi: -55
      })
      await wait(1100)
      const saved = await getAll('bleDevices')
      expect(saved).toHaveLength(1)
      expect(saved[0].mac).toBe('AA:BB:CC:11:22:33')
      expect(saved[0].name).toBe('iPhone')
    })

    it('hydrates BLE devices', async () => {
      const bleStore1 = useBleStore()
      bleStore1.updateOrAddDevice({ mac: '11:22:33:44:55:66', name: 'Pixel', rssi: -60 })
      await wait(1100)

      _resetDbPromise()
      setActivePinia(createPinia())
      const bleStore2 = useBleStore()
      await bleStore2.hydrate()
      expect(bleStore2.devices.size).toBe(1)
      const dev = bleStore2.devices.get('11:22:33:44:55:66')
      expect(dev.name).toBe('Pixel')
    })
  })

  describe('probeStore', () => {
    it('persists probes', async () => {
      const probeStore = useProbeStore()
      probeStore.addProbe(-55, 6, 'AA:BB:CC:11:22:33', 'Home')
      probeStore.addProbe(-70, 1, '11:22:33:44:55:66', 'Work')
      await wait(1100)
      const saved = await getAll('probes')
      expect(saved).toHaveLength(2)
    })

    it('hydrates probes', async () => {
      const probeStore1 = useProbeStore()
      probeStore1.addProbe(-55, 6, 'AA:BB:CC:11:22:33', 'Home')
      await wait(1100)

      _resetDbPromise()
      setActivePinia(createPinia())
      const probeStore2 = useProbeStore()
      await probeStore2.hydrate()
      expect(probeStore2.probes.length).toBe(1)
      expect(probeStore2.probes[0].ssid).toBe('Home')
    })

    it('caps hydrated probes at 500', async () => {
      const probeStore1 = useProbeStore()
      for (let i = 0; i < 600; i++) {
        probeStore1.addProbe(-50 - i % 50, 6, `AA:BB:CC:11:22:${(i % 100).toString(16).padStart(2, '0')}`, `SSID${i}`)
      }
      await wait(1100)

      _resetDbPromise()
      setActivePinia(createPinia())
      const probeStore2 = useProbeStore()
      await probeStore2.hydrate()
      expect(probeStore2.probes.length).toBeLessThanOrEqual(500)
    })

    it('merge hydrate preserves in-memory probes', async () => {
      const probeStore1 = useProbeStore()
      probeStore1.addProbe(-55, 6, 'AA:BB:CC:11:22:33', 'Old')
      await wait(1100)

      _resetDbPromise()
      setActivePinia(createPinia())
      const probeStore2 = useProbeStore()
      probeStore2.addProbe(-70, 1, 'DD:EE:FF:11:22:33', 'New')
      await probeStore2.hydrate()
      expect(probeStore2.probes.length).toBe(2)
      const ssids = probeStore2.probes.map(p => p.ssid).sort()
      expect(ssids).toEqual(['New', 'Old'])
    })
  })
})
