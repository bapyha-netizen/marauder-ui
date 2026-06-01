<template>
  <div class="h-screen flex flex-col bg-slate-900">
    <MobileBlocker v-if="isMobile" />
    <template v-else>
    <!-- Header -->
    <header class="flex items-center justify-between px-5 py-3 bg-slate-800/90 border-b border-slate-700/50">
      <div class="flex items-center space-x-4">
        <div class="flex items-center space-x-2">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
            <span class="text-xs font-black text-white">M</span>
          </div>
          <h1 class="text-base font-bold text-white tracking-tight">marauder-ui</h1>
        </div>
        <div class="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
          :class="serialStore.isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'">
          <span class="w-1.5 h-1.5 rounded-full" :class="serialStore.isConnected ? 'bg-emerald-400' : 'bg-red-400'"></span>
          {{ serialStore.isConnected ? 'Connected' : 'Disconnected' }}
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <button v-if="!serialStore.isConnected" @click="toggleDemoMode"
          class="btn text-[11px]"
          :class="serialStore.isDemoMode ? 'btn-warning' : 'btn-ghost'">
          {{ serialStore.isDemoMode ? 'Exit Demo' : 'Try Demo' }}
        </button>
          <button @click="handleEmergencyStop" v-if="serialStore.isConnected"
            class="btn-emergency text-[11px]" title="Emergency stop all scans/attacks">
            ■ Stop
          </button>
        <button @click="handleConnect" v-if="!serialStore.isConnected" class="btn-success text-[11px]">
          Connect
        </button>
        <button @click="handleDisconnect" v-if="serialStore.isConnected" class="btn-danger text-[11px]">
          Disconnect
        </button>
      </div>
    </header>

    <!-- Main -->
    <div class="flex-1 flex flex-col min-h-0 p-4 gap-3">

      <!-- Tabs -->
      <nav class="flex space-x-1">
        <button v-for="tab in tabs" :key="tab.id" @click="activeTab = tab.id"
          class="px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-150"
          :class="activeTab === tab.id
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'">
          <span class="mr-1.5">{{ tab.icon }}</span>
          {{ tab.label }}
          <span v-if="tab.badge" class="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-white/20 text-white font-semibold">
            {{ tab.badge }}
          </span>
        </button>
      </nav>

      <!-- Command Bar -->
      <div class="panel px-3 py-2">
        <CommandBuilder />
      </div>

      <!-- Tab Content -->
      <div class="flex-1 panel p-0 min-h-0 flex flex-col">
        <div v-if="activeTab === 'dashboard'" class="flex-1 min-h-0 p-4"><DashboardView /></div>
        <div v-else-if="activeTab === 'ap'" class="flex-1 min-h-0 p-4"><APExplorer /></div>
        <div v-else-if="activeTab === 'ble'" class="flex-1 min-h-0 p-4"><BLEExplorer /></div>
        <div v-else-if="activeTab === 'probes'" class="flex-1 min-h-0 p-4"><ProbesView /></div>
        <div v-else-if="activeTab === 'scenarios'" class="flex-1 min-h-0 p-4"><WorkflowBuilder @navigate="(tab) => activeTab = tab" /></div>
        <div v-else-if="activeTab === 'help'" class="flex-1 min-h-0 p-4"><HelpGuide /></div>
      </div>



    </div>

    <!-- Status Bar -->
    <div v-if="serialStore.isConnected"
      class="flex items-center justify-between px-4 py-1.5 bg-slate-800/90 border-t border-slate-700/50 text-[10px] text-slate-500">
      <div class="flex items-center space-x-4">
        <span class="flex items-center space-x-1">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>Connected</span>
        </span>
        <span>APs: <span class="text-slate-300 font-semibold">{{ apStore.apCount }}</span></span>
        <span>BLE: <span class="text-slate-300 font-semibold">{{ bleStore.deviceCount }}</span></span>
        <span>Probes: <span class="text-slate-300 font-semibold">{{ probeStore.probeCount }}</span></span>
        <span>Pkts: <span class="text-slate-300 font-semibold">{{ dashStore.packetsCaptured }}</span></span>
      </div>
      <div class="flex items-center space-x-4">
        <span>Session: <span class="text-slate-300">{{ dashStore.sessionDuration }}</span></span>
      </div>
    </div>

    </template>

    <!-- Toasts -->
    <div class="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      <div v-for="t in toasts" :key="t.id"
        class="pointer-events-auto px-4 py-2 rounded-lg shadow-xl text-xs font-medium transition-all duration-300 cursor-pointer"
        :class="toastClass(t.type)" @click="toastRemove(t.id)">
        {{ t.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import MobileBlocker from './components/MobileBlocker.vue'
import CommandBuilder from './components/CommandBuilder.vue'
import DashboardView from './components/dashboard/DashboardView.vue'
import APExplorer from './components/ap/APExplorer.vue'
import BLEExplorer from './components/ble/BLEExplorer.vue'
import WorkflowBuilder from './components/workflow/WorkflowBuilder.vue'
import ProbesView from './components/probes/ProbesView.vue'
import HelpGuide from './components/help/HelpGuide.vue'
import { useSerialStore } from './stores/serialStore'
import { useApStore } from './stores/apStore'
import { useBleStore } from './stores/bleStore'
import { useDashboardStore } from './stores/dashboardStore'
import { useProbeStore } from './stores/probeStore'
import { parseLine, parseDemoAP, parseDemoBLE, startParser, stopParser } from './services/parserEngine'
import { generateDemoTerminalOutput } from './utils/demoData'
import { useToast } from './utils/toast'

const serialStore = useSerialStore()
const apStore = useApStore()
const bleStore = useBleStore()
const dashStore = useDashboardStore()
const probeStore = useProbeStore()

const { toasts, show: toastShow, remove: toastRemove } = useToast()

const toastClass = (type) => {
  const map = {
    info: 'bg-indigo-600/90 text-white border border-indigo-500/50',
    success: 'bg-emerald-600/90 text-white border border-emerald-500/50',
    error: 'bg-red-600/90 text-white border border-red-500/50',
    warning: 'bg-amber-600/90 text-white border border-amber-500/50'
  }
  return map[type] || map.info
}

const isMobile = ref(false)
const activeTab = ref('dashboard')
const demoInterval = ref(null)
let lastLength = 0

const checkMobile = () => {
  const ua = navigator.userAgent
  isMobile.value = (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) || window.innerWidth < 768
}

const tabs = computed(() => [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', badge: '' },
  { id: 'ap', label: 'APs', icon: '📶', badge: apStore.apCount || '' },
  { id: 'ble', label: 'BLE', icon: '🔵', badge: bleStore.deviceCount || '' },
  { id: 'probes', label: 'Probes', icon: '📱', badge: probeStore.probeCount || '' },
  { id: 'scenarios', label: 'Scenarios', icon: '⚡', badge: '' },
  { id: 'help', label: 'Help', icon: '❓', badge: '' },
])

onMounted(async () => {
  checkMobile()
  startParser()
  window.addEventListener('resize', checkMobile)
  window.addEventListener('beforeunload', sendStop)
  try {
    await Promise.all([
      apStore.hydrate?.(),
      bleStore.hydrate?.(),
      probeStore.hydrate?.()
    ])
  } catch (e) {
    console.warn('Hydrate failed:', e)
  }
})
onUnmounted(() => {
  stopParser()
  dashStore.stopTick()
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('beforeunload', sendStop)
  if (demoInterval.value) clearInterval(demoInterval.value)
})

watch(() => serialStore.isConnected, (connected) => {
  if (connected) dashStore.startTick()
  else dashStore.stopTick()
})

const sendStop = () => {
  serialStore.sendCommand('stopscan')
}

watch(() => serialStore.terminalOutput.length, (newLen, oldLen) => {
  if (newLen < oldLen) { lastLength = Math.max(0, lastLength - (oldLen - newLen)); return }
  const lines = serialStore.terminalOutput
  if (lines.length > lastLength) {
    for (let i = lastLength; i < lines.length; i++) {
      try {
        parseLine(lines[i].replace(/<[^>]+>/g, ''))
      } catch (e) {
        console.error('Parse error:', e, lines[i])
      }
    }
    lastLength = lines.length
  }
})

const handleConnect = async () => {
  try {
    await serialStore.connect()
    toastShow('Connected to ESP32', 'success')
  } catch (e) {
    const msg = e.message
    serialStore.addToTerminal(`Connection failed: ${msg}`, 'error')
    toastShow(msg, 'error')
    if (msg.includes('Web Serial API')) {
      serialStore.addToTerminal('Use Chrome/Edge with HTTPS or localhost', 'warning')
    } else if (msg.includes('No device selected')) {
      serialStore.addToTerminal('Make sure ESP32 is connected via USB (data cable) with drivers installed', 'warning')
    }
  }
}
const handleDisconnect = async () => {
  await serialStore.disconnect()
  toastShow('Disconnected', 'warning')
}
const handleEmergencyStop = () => {
  if (!serialStore.isConnected) { toastShow('Not connected to ESP32', 'error'); return }
  serialStore.sendCommand('stopscan')
  toastShow('Emergency stop sent', 'warning')
}

const toggleDemoMode = () => {
  serialStore.toggleDemo()
  if (serialStore.isDemoMode) {
    lastLength = 0
    serialStore.terminalOutput = generateDemoTerminalOutput()
    parseDemoAP(); parseDemoBLE()
    demoInterval.value = setInterval(() => { parseDemoAP(); parseDemoBLE() }, 5000)
  } else {
    if (demoInterval.value) clearInterval(demoInterval.value)
    serialStore.terminalOutput = []
    lastLength = 0
    apStore.clearAPs(); bleStore.clearDevices(); dashStore.resetStats()
    probeStore.clearProbes()
  }
}
</script>
