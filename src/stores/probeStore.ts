import { defineStore } from 'pinia'
import { shallowRef, triggerRef, computed, watch } from 'vue'
import { debouncedSave, loadStore, clearPersistedStore } from '../utils/persist'
import { sanitizeText } from '../utils/sanitize'

const PERSIST_KEY = 'probes'

interface ProbeRecord {
  rssi: number
  ch: number
  clientMac: string
  ssid: string
  time: Date
}

export const useProbeStore = defineStore('probe', () => {
  const probes = shallowRef<ProbeRecord[]>([])

  const probeCount = computed(() => probes.value.length)

  const uniqueClients = computed(() => {
    const s = new Set(probes.value.map(p => p.clientMac))
    return s.size
  })

  function addProbe(rssi: number, ch: number, clientMac: string, ssid: string) {
    clientMac = sanitizeText(clientMac, { maxLength: 18 })
    ssid = sanitizeText(ssid, { maxLength: 64 })
    const next = [{ rssi, ch, clientMac: clientMac.toUpperCase(), ssid, time: new Date() }, ...probes.value]
    if (next.length > 500) next.length = 500
    probes.value = next
    triggerRef(probes)
  }

  function clearProbes() {
    probes.value = []
    triggerRef(probes)
    clearPersistedStore(PERSIST_KEY)
  }

  watch(probes, (arr) => {
    const items = new Array<Record<string, unknown>>(arr.length)
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i]
      items[i] = {
        id: `${p.clientMac}-${p.time?.getTime?.() || i}`,
        rssi: p.rssi,
        ch: p.ch,
        clientMac: p.clientMac,
        ssid: p.ssid,
        time: p.time
      }
    }
    debouncedSave(PERSIST_KEY, items)
  }, { deep: false })

  let _hydrated = false

  async function hydrate() {
    if (_hydrated) return
    _hydrated = true
    const saved = await loadStore(PERSIST_KEY)
    if (!saved || saved.length === 0) return
    const restored = saved.map((p: Record<string, unknown>): ProbeRecord => ({
      rssi: Number(p.rssi) || 0,
      ch: Number(p.ch) || 0,
      clientMac: String(p.clientMac) || '',
      ssid: String(p.ssid) || '',
      time: p.time && typeof p.time === 'string' || typeof p.time === 'number' ? new Date(p.time) : new Date()
    }))
    const existing = probes.value || []
    const existingIds = new Set(existing.map(p => `${p.clientMac}-${p.time?.getTime?.()}`))
    const merged = [...existing]
    for (const p of restored) {
      const id = `${p.clientMac}-${p.time?.getTime?.()}`
      if (!existingIds.has(id)) merged.push(p)
    }
    probes.value = merged.slice(-500)
    triggerRef(probes)
  }

  function removeOldProbes(maxAgeMs = 300000) {
    const now = Date.now()
    const filtered = probes.value.filter(p => now - new Date(p.time).getTime() <= maxAgeMs)
    if (filtered.length !== probes.value.length) {
      probes.value = filtered
      triggerRef(probes)
    }
  }

  return { probes, probeCount, uniqueClients, addProbe, clearProbes, hydrate, removeOldProbes }
})
