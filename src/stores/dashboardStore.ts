import { defineStore } from 'pinia'
import { ref, shallowRef, triggerRef, computed } from 'vue'
import type { DashboardEvent, PacketCounts, ChannelUtilization, IPListEntry } from '../types'

export const useDashboardStore = defineStore('dashboard', () => {
  const commandsSent = ref(0)
  const packetsCaptured = ref(0)
  const sessionStart = ref(new Date())
  const events = shallowRef<DashboardEvent[]>([])
  const tick = ref(0)
  const lastStationAPIndex = ref<number | null>(null)
  const lastStationAPName = ref('')
  const packetCounts = shallowRef<PacketCounts>({ beacon: 0, probe: 0, deauth: 0, eapol: 0, data: 0, management: 0 })
  const channelUtilization = shallowRef<ChannelUtilization>({})
  const ipList = shallowRef<IPListEntry[]>([])

  const sessionDuration = computed(() => {
    void tick.value
    const diff = Date.now() - sessionStart.value.getTime()
    const m = Math.floor(diff / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return `${m}m ${s}s`
  })

  const eventsReversed = computed(() => {
    const ev = events.value
    const res = new Array(ev.length)
    for (let i = 0; i < ev.length; i++) res[i] = ev[ev.length - 1 - i]
    return res
  })

  let tickInterval: ReturnType<typeof setInterval> | null = null

  function startTick() {
    if (tickInterval) return
    tickInterval = setInterval(() => { tick.value++ }, 1000)
  }

  function stopTick() {
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null }
  }

  function incrementCommands() {
    commandsSent.value++
  }

  function incrementPackets(n = 1) {
    packetsCaptured.value += n
  }

  function addEvent(type: string, data: string) {
    events.value.push({ type, data, time: new Date() })
    if (events.value.length > 200) events.value.shift()
    triggerRef(events)
  }

  function setPacketCounts(counts: Partial<PacketCounts>) {
    packetCounts.value = { ...packetCounts.value, ...counts }
  }

  function setChannelUtilization(util: ChannelUtilization) {
    if (util && Object.keys(util).length === 0) {
      channelUtilization.value = {}
    } else {
      channelUtilization.value = { ...channelUtilization.value, ...util }
    }
  }

  function setStats(stats: { commandsSent?: number; packetsCaptured?: number }) {
    commandsSent.value = stats.commandsSent || 0
    packetsCaptured.value = stats.packetsCaptured || 0
  }

  function setIPList(list: IPListEntry[]) {
    ipList.value = list
  }

  function setLastStationAP(index: number, name: string) {
    lastStationAPIndex.value = index
    lastStationAPName.value = name
  }

  function resetStats() {
    commandsSent.value = 0
    packetsCaptured.value = 0
    sessionStart.value = new Date()
    events.value = []
    packetCounts.value = { beacon: 0, probe: 0, deauth: 0, eapol: 0, data: 0, management: 0 }
    channelUtilization.value = {}
  }

  return {
    commandsSent, packetsCaptured, sessionStart, events, eventsReversed,
    sessionDuration, lastStationAPIndex, lastStationAPName,
    packetCounts, channelUtilization, ipList,
    incrementCommands, incrementPackets,
    addEvent, setPacketCounts, setChannelUtilization, setIPList, setStats,
    setLastStationAP, resetStats, startTick, stopTick
  }
})
