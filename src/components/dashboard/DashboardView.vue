<template>
  <div class="h-full flex gap-3">
    <!-- Left: Real-time terminal (1/3) -->
    <div class="w-1/3 flex flex-col min-h-0 min-w-0">
      <div class="bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col h-full">
        <div class="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Output</h3>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-[11px] text-slate-500">{{ serialStore.terminalOutput.length }} lines</span>
            <button @click="paused = !paused"
              :class="paused ? 'bg-amber-600/50 text-amber-200' : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'"
              class="px-1.5 py-0.5 text-[10px] rounded-md transition-colors"
              :title="paused ? 'Resume terminal output' : 'Pause terminal output'">
              {{ paused ? '▶ Resume' : '⏸ Pause' }}
            </button>
            <button @click="autoScroll = !autoScroll"
              :class="!autoScroll ? 'bg-amber-600/50 text-amber-200' : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'"
              class="px-1.5 py-0.5 text-[10px] rounded-md transition-colors"
              :title="autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'">
              {{ autoScroll ? '⤓ Auto' : '⊘ Manual' }}
            </button>
            <button @click="copyTerminal" v-if="serialStore.terminalOutput.length"
              class="px-1.5 py-0.5 text-[10px] rounded-md bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-slate-200 transition-colors">Copy</button>
            <button @click="serialStore.clearOutput()"
              class="px-1.5 py-0.5 text-[10px] rounded-md bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-slate-200 transition-colors">Clear</button>
          </div>
        </div>
        <div ref="liveRef" @scroll="onTerminalScroll"
          class="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed scrollbar-thin bg-black/30">
          <div v-for="(line, i) in serialStore.terminalOutput" :key="i" v-html="line"
            class="hover:bg-white/5 rounded px-1 -mx-1"></div>
          <div v-if="!serialStore.terminalOutput.length" class="text-slate-600 text-center py-8">
            Waiting for data...
          </div>
        </div>
      </div>
    </div>

    <!-- Right: Main dashboard (2/3) -->
    <div class="w-2/3 flex flex-col gap-3 min-h-0 min-w-0">
      <!-- Stats cards -->
      <div class="grid grid-cols-4 gap-3 flex-shrink-0">
        <div class="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">APs</span>
            <span class="text-2xl font-bold text-indigo-400">{{ apStore.apCount }}</span>
          </div>
        </div>
        <div class="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Stations</span>
            <span class="text-2xl font-bold text-cyan-400">{{ apStore.totalStations }}</span>
          </div>
        </div>
        <div class="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">BLE</span>
            <span class="text-2xl font-bold text-emerald-400">{{ bleStore.deviceCount }}</span>
          </div>
        </div>
        <div class="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pkts</span>
            <span class="text-2xl font-bold text-amber-400">{{ dashStore.packetsCaptured }}</span>
          </div>
        </div>
      </div>

      <!-- Dashboard panels -->
      <div class="grid grid-cols-3 gap-3 flex-1 min-h-0">
        <div class="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3 flex flex-col min-h-0">
          <h3 class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Top APs</h3>
          <div class="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
            <div v-for="ap in topAPs" :key="ap.bssid"
              class="flex items-center space-x-2 p-1.5 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors">
              <div class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="dotClass(ap.rssi)"></div>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-medium text-slate-200 truncate">{{ ap.essid }}</div>
                <div class="text-[10px] text-slate-500">CH {{ ap.channel }}</div>
              </div>
              <div class="text-xs font-mono font-semibold" :class="signalClass(ap.rssi)">{{ ap.rssi }}</div>
            </div>
            <div v-if="!topAPs.length" class="text-xs text-slate-600 text-center py-6">No APs yet.</div>
          </div>
        </div>

        <div class="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3 flex flex-col min-h-0">
          <h3 class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Packet Breakdown</span>
            <span v-if="!totalPackets" class="text-[10px] text-slate-600 font-normal">Run packetcount</span>
          </h3>
          <div class="flex-1 flex flex-col gap-2">
            <div v-if="totalPackets" class="flex justify-center py-1">
              <svg width="64" height="64" viewBox="0 0 64 64" class="flex-shrink-0">
                <circle cx="32" cy="32" r="30" fill="none" stroke="rgb(51 65 85)" stroke-width="2"/>
                <path v-for="(slice, i) in pieSlices" :key="i" :d="slice.d" :fill="slice.fill" stroke="rgb(15 23 42)" stroke-width="1"/>
              </svg>
            </div>
            <div class="flex-1 space-y-2 overflow-y-auto">
              <div v-for="pk in packetTypes" :key="pk.key" class="space-y-0.5">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="text-slate-400">{{ pk.label }}</span>
                  <span class="font-mono text-slate-300">{{ dashStore.packetCounts[pk.key] }}</span>
                </div>
                <div class="w-full h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-300" :style="{ width: (totalPackets ? (dashStore.packetCounts[pk.key] / totalPackets * 100) : 0) + '%' }" :class="pk.color"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3 flex flex-col min-h-0">
          <h3 class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Channel Utilization</span>
            <span v-if="!chs.length" class="text-[10px] text-slate-600 font-normal">Run channelanalyzer</span>
          </h3>
          <div class="flex-1 space-y-1 overflow-y-auto">
            <div v-for="ch in chs" :key="ch.ch" class="flex items-center space-x-2 text-[11px]">
              <span class="text-slate-500 w-4 font-mono">#{{ ch.ch }}</span>
              <div class="flex-1 h-2 rounded-full bg-slate-700/50 overflow-hidden">
                <div class="h-full rounded-full transition-all duration-300 bg-indigo-400" :style="{ width: (ch.count / maxChUtil * 100) + '%' }"></div>
              </div>
              <span class="font-mono text-slate-400 w-8 text-right">{{ ch.count }}</span>
            </div>
            <div v-if="!chs.length" class="flex items-center justify-center py-4 text-xs text-slate-600">
              No channel data yet
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom bar -->
      <div class="bg-slate-800/50 rounded-xl border border-slate-700/50 p-2 flex-shrink-0">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4 text-[11px]">
            <span class="text-slate-500">Avg: <span class="font-semibold" :class="signalClass(apStore.avgSignal)">{{ apStore.avgSignal }} dBm</span></span>
            <span class="text-slate-500">Session: <span class="font-semibold text-slate-200">{{ dashStore.sessionDuration }}</span></span>
          </div>
          <div class="flex space-x-2">
            <button @click="serialStore.clearListAndScan()" class="btn-primary btn-sm">Clear & Scan</button>
            <button @click="handleClear" class="btn-ghost btn-sm">Clear All</button>
            <button @click="handleExport" class="btn-ghost btn-sm" title="Export session as JSON">Export</button>
            <button @click="importRef?.click()" class="btn-ghost btn-sm" title="Import session from JSON">Import</button>
            <input ref="importRef" type="file" accept=".json" @change="handleImport" class="hidden">
            <div class="relative" v-if="apStore.apCount > 0 || bleStore.deviceCount > 0 || probeStore.probeCount > 0">
              <button @click="wigleMenuOpen = !wigleMenuOpen" class="btn-ghost btn-sm" title="Export to Wigle.net format">Wigle ▾</button>
              <div v-if="wigleMenuOpen" class="absolute right-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-20 py-1" @click.stop>
                <button @click="exportWigleAPs" class="block w-full text-left px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-700">WiFi APs → Wigle CSV</button>
                <button @click="exportWigleBLE" class="block w-full text-left px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-700">BLE → Wigle CSV</button>
                <button @click="exportWigleProbes" class="block w-full text-left px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-700">Probes → Wigle CSV</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useSerialStore } from '../../stores/serialStore'
import { useApStore } from '../../stores/apStore'
import { useBleStore } from '../../stores/bleStore'
import { useDashboardStore } from '../../stores/dashboardStore'
import { useProbeStore } from '../../stores/probeStore'
import { signalClass, dotClass } from '../../utils/format'
import { useToast } from '../../utils/toast'
import { apsToWigle, bleToWigle, probesToWigle, downloadWigle } from '../../utils/wigle'
import { copyToClipboard } from '../../utils/clipboard'

const { show: toastShow } = useToast()

const serialStore = useSerialStore()
const apStore = useApStore()
const bleStore = useBleStore()
const dashStore = useDashboardStore()
const probeStore = useProbeStore()

const liveRef = ref(null)
const wigleMenuOpen = ref(false)
const paused = ref(false)
const autoScroll = ref(true)

const topAPs = computed(() => apStore.sortedAPs.slice(0, 10))

const packetTypes = [
  { key: 'beacon', label: 'Beacon', color: 'bg-blue-400' },
  { key: 'probe', label: 'Probe', color: 'bg-cyan-400' },
  { key: 'deauth', label: 'Deauth', color: 'bg-red-400' },
  { key: 'eapol', label: 'EAPOL', color: 'bg-purple-400' },
  { key: 'data', label: 'Data', color: 'bg-emerald-400' },
  { key: 'management', label: 'Mgmt', color: 'bg-amber-400' },
]

const totalPackets = computed(() => Object.values(dashStore.packetCounts).reduce((a, b) => a + b, 0))

const chs = computed(() => Object.entries(dashStore.channelUtilization)
  .map(([ch, count]) => ({ ch: parseInt(ch), count }))
  .sort((a, b) => a.ch - b.ch))

const maxChUtil = computed(() => Math.max(...chs.value.map(c => c.count), 1))

const pieSlices = computed(() => {
  const total = totalPackets.value
  if (!total) return []
  const cx = 32, cy = 32, r = 30
  let startAngle = -Math.PI / 2
  const colors = ['#60a5fa', '#22d3ee', '#f87171', '#a78bfa', '#34d399', '#fbbf24']
  return packetTypes.map((pk, i) => {
    const val = dashStore.packetCounts[pk.key] || 0
    const angle = (val / total) * Math.PI * 2
    const endAngle = startAngle + angle
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const large = angle > Math.PI ? 1 : 0
    const d = `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`
    startAngle = endAngle
    return { d, fill: colors[i] }
  })
})

watch(() => serialStore.terminalOutput.length, () => {
  if (paused.value) return
  if (!autoScroll.value) return
  nextTick(() => {
    if (liveRef.value) liveRef.value.scrollTop = liveRef.value.scrollHeight
  })
})

const onTerminalScroll = () => {
  if (!liveRef.value) return
  const dist = liveRef.value.scrollHeight - (liveRef.value.scrollTop + liveRef.value.clientHeight)
  if (dist > 60) autoScroll.value = false
  else if (dist < 6) autoScroll.value = true
}

const handleClear = () => { apStore.clearAPs(); bleStore.clearDevices(); dashStore.resetStats() }

const importRef = ref(null)

const handleExport = () => {
  const data = {
    version: '0.2.0',
    exportedAt: new Date().toISOString(),
    apCount: apStore.apCount,
    bleCount: bleStore.deviceCount,
    aps: Array.from(apStore.accessPoints.values()).map(ap => ({
      index: ap.index, essid: ap.essid, bssid: ap.bssid,
      channel: ap.channel, rssi: ap.rssi, encryption: ap.encryption,
      isHidden: ap.isHidden, isSelected: ap.isSelected,
      vendor: ap.vendor, lastSeen: ap.lastSeen,
      rssiHistory: ap.rssiHistory,
      stations: ap.stations?.map(s => ({ id: s.id, mac: s.mac, vendor: s.vendor, lastSeen: s.lastSeen }))
    })),
    ble: Array.from(bleStore.devices.values()).map(d => ({
      mac: d.mac, name: d.name, rssi: d.rssi,
      isAirtag: d.isAirtag, manufacturer: d.manufacturer, lastSeen: d.lastSeen
    })),
    packetCounts: { ...dashStore.packetCounts },
    channelUtilization: { ...dashStore.channelUtilization },
    stats: { commandsSent: dashStore.commandsSent, packetsCaptured: dashStore.packetsCaptured }
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `marauder-session-${new Date().toISOString().slice(0, 10)}.json`
  a.click(); URL.revokeObjectURL(url)
}

const exportWigleAPs = () => {
  wigleMenuOpen.value = false
  const aps = Array.from(apStore.accessPoints.values())
  if (aps.length === 0) { toastShow('No APs to export', 'warning'); return }
  const csv = apsToWigle(aps)
  const date = new Date().toISOString().slice(0, 10)
  downloadWigle(`wigle-wifi-${date}.csv`, csv)
  toastShow(`Exported ${aps.length} APs to Wigle CSV`, 'success')
}

const exportWigleBLE = () => {
  wigleMenuOpen.value = false
  const devs = Array.from(bleStore.devices.values())
  if (devs.length === 0) { toastShow('No BLE devices to export', 'warning'); return }
  const csv = bleToWigle(devs)
  const date = new Date().toISOString().slice(0, 10)
  downloadWigle(`wigle-ble-${date}.csv`, csv)
  toastShow(`Exported ${devs.length} BLE devices to Wigle CSV`, 'success')
}

const exportWigleProbes = () => {
  wigleMenuOpen.value = false
  if (probeStore.probes.length === 0) { toastShow('No probes to export', 'warning'); return }
  const csv = probesToWigle(probeStore.probes)
  const date = new Date().toISOString().slice(0, 10)
  downloadWigle(`wigle-probes-${date}.csv`, csv)
  toastShow(`Exported ${probeStore.probes.length} probes to Wigle CSV`, 'success')
}

const copyTerminal = async () => {
  const text = serialStore.terminalOutput
    .map(line => line.replace(/<[^>]+>/g, ''))
    .join('\n')
  if (!text) return
  const ok = await copyToClipboard(text)
  toastShow(ok ? `Copied ${serialStore.terminalOutput.length} lines to clipboard` : 'Copy failed', ok ? 'success' : 'error')
}

const handleImport = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    apStore.clearAPs(); bleStore.clearDevices(); dashStore.resetStats()
    if (data.aps) data.aps.forEach(ap => apStore.updateOrAddAP(ap))
    if (data.ble) data.ble.forEach(d => bleStore.updateOrAddDevice(d))
    if (data.packetCounts) dashStore.setPacketCounts(data.packetCounts)
    if (data.channelUtilization) dashStore.setChannelUtilization(data.channelUtilization)
    if (data.stats) dashStore.setStats(data.stats)
    toastShow(`Session imported: ${data.apCount || 0} APs, ${data.bleCount || 0} BLE`, 'success')
  } catch (err) {
    toastShow(`Import failed: ${err.message}`, 'error')
  }
  e.target.value = ''
}
</script>
