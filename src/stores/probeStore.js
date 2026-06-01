import { defineStore } from 'pinia'
import { shallowRef, triggerRef, computed, watch } from 'vue'
import { debouncedSave, loadStore, clearPersistedStore } from '../utils/persist'

const PERSIST_KEY = 'probes'

export const useProbeStore = defineStore('probe', () => {
  const probes = shallowRef([])

  const probeCount = computed(() => probes.value.length)

  const reversedProbes = computed(() => {
    const p = probes.value
    const res = new Array(p.length)
    for (let i = 0; i < p.length; i++) res[i] = p[p.length - 1 - i]
    return res
  })

  const uniqueClients = computed(() => {
    const s = new Set(probes.value.map(p => p.clientMac))
    return s.size
  })

  function addProbe(rssi, ch, clientMac, ssid) {
    probes.value.push({ rssi, ch, clientMac: clientMac.toUpperCase(), ssid, time: new Date() })
    if (probes.value.length > 500) probes.value.shift()
    triggerRef(probes)
  }

  function clearProbes() {
    probes.value = []
    clearPersistedStore(PERSIST_KEY)
  }

  let _probeCounter = 0
  watch(probes, (arr) => {
    const items = arr.map((p, idx) => ({
      id: `${p.clientMac}-${p.time?.getTime?.() || idx}`,
      rssi: p.rssi,
      ch: p.ch,
      clientMac: p.clientMac,
      ssid: p.ssid,
      time: p.time
    }))
    debouncedSave(PERSIST_KEY, items)
  }, { deep: false })

  async function hydrate() {
    const saved = await loadStore(PERSIST_KEY)
    if (!saved || saved.length === 0) return
    const restored = saved.map(p => ({
      rssi: p.rssi,
      ch: p.ch,
      clientMac: p.clientMac,
      ssid: p.ssid,
      time: p.time ? new Date(p.time) : new Date()
    }))
    const existing = probes.value || []
    const existingIds = new Set(existing.map(p => `${p.clientMac}-${p.time?.getTime?.()}`))
    const merged = [...existing]
    for (const p of restored) {
      const id = `${p.clientMac}-${p.time?.getTime?.()}`
      if (!existingIds.has(id)) merged.push(p)
    }
    merged.sort((a, b) => a.time - b.time)
    probes.value = merged.slice(-500)
    triggerRef(probes)
  }

  return { probes, reversedProbes, probeCount, uniqueClients, addProbe, clearProbes, hydrate }
})