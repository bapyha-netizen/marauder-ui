import { defineStore } from 'pinia'
import { shallowRef, triggerRef, computed } from 'vue'

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
  }

  return { probes, reversedProbes, probeCount, uniqueClients, addProbe, clearProbes }
})