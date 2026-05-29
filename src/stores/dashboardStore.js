import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useDashboardStore = defineStore('dashboard', () => {
  const commandsSent = ref(0)
  const packetsCaptured = ref(0)
  const sessionStart = ref(new Date())
  const events = ref([])
  const tick = ref(0)
  const lastStationAPIndex = ref(null)
  const lastStationAPName = ref('')
  const packetCounts = ref({ beacon: 0, probe: 0, deauth: 0, eapol: 0, data: 0, management: 0 })
  const channelUtilization = ref({})
  const ipList = ref([])

  const sessionDuration = computed(() => {
    void tick.value
    const diff = Date.now() - sessionStart.value.getTime()
    const m = Math.floor(diff / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return `${m}m ${s}s`
  })

  let tickInterval = null

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

  function addEvent(type, data) {
    events.value = [{ type, data, time: new Date() }, ...events.value].slice(0, 200)
  }

  function setPacketCounts(counts) {
    packetCounts.value = { ...packetCounts.value, ...counts }
  }

  function setChannelUtilization(util) {
    channelUtilization.value = { ...channelUtilization.value, ...util }
  }

  function setIPList(list) {
    ipList.value = list
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
    commandsSent, packetsCaptured, sessionStart, events,
    sessionDuration, lastStationAPIndex, lastStationAPName,
    packetCounts, channelUtilization, ipList,
    incrementCommands, incrementPackets,
    addEvent, setPacketCounts, setChannelUtilization, setIPList,
    resetStats, startTick, stopTick
  }
})
