<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2.5">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">BLE Devices</h2>
        <span class="badge-blue">{{ bleStore.deviceCount }}</span>
        <span v-if="selectedCount" class="badge-green">{{ selectedCount }} selected</span>
        <span v-if="bleStore.airtagCount" class="badge-red">{{ bleStore.airtagCount }} AirTags</span>
      </div>
      <div class="flex items-center space-x-2">
        <input v-model="search" placeholder="Search..." class="input w-36 text-xs">
        <select v-model="sortBy" class="input w-auto text-xs py-1">
          <option value="rssi">Signal</option>
          <option value="name">Name</option>
          <option value="type">Type</option>
          <option value="pkts">Packets</option>
        </select>
        <button @click="runDispatched('sniffbt', 'Scan BLE')" :disabled="!ctx.isConnected.value" :title="ctx.btnState('sniffbt').title" :class="ctx.btnClass('sniffbt', 'btn-primary btn-sm')">Scan</button>
        <button @click="runDispatched('list -t', 'List AirTags')" :disabled="!ctx.isConnected.value" :title="ctx.btnState('list -t').title" :class="ctx.btnClass('list -t', 'btn-ghost btn-sm')">List</button>
        <button @click="runDispatched('stopscan', 'Stop Scan')" :disabled="!ctx.isConnected.value" :title="ctx.btnState('stopscan').title" :class="ctx.btnClass('stopscan', 'btn-ghost btn-sm')">Stop</button>
        <button @click="toggleSelectAll" :disabled="!bleStore.deviceCount" :title="allSelected ? 'Deselect all' : 'Select all'" :class="['btn-ghost btn-sm', (allSelected ? 'btn-success' : ''), 'disabled:opacity-40 disabled:cursor-not-allowed']">{{ allSelected ? 'Deselect All' : 'Select All' }}</button>
        <button @click="handleClear" :disabled="!bleStore.deviceCount" :title="bleStore.deviceCount ? `Clear ${bleStore.deviceCount} devices` : 'No devices to clear'" class="btn-ghost btn-sm disabled:opacity-40 disabled:cursor-not-allowed">Clear</button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-700/50 scrollbar-thin">
      <table class="w-full text-xs">
        <thead class="bg-slate-800 sticky top-0 z-10">
          <tr>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-10"><input type="checkbox" @click.stop="toggleSelectAll" :checked="allSelected" :disabled="!bleStore.deviceCount" class="accent-indigo-500 cursor-pointer disabled:opacity-40" title="Select all"></th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider">Name</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-40">MAC</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-14">RSSI</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-14">Pkts</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-16">First</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-16">Last</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-14">Type</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="dev in filteredDevices" :key="dev.mac">
            <tr class="border-t border-slate-700/30 hover:bg-slate-700/30 cursor-pointer transition-colors"
              :class="selected.has(dev.mac) ? 'bg-indigo-500/10' : dev.isAirtag ? 'bg-red-500/5' : ''"
              tabindex="0"
              @click="toggleSelect(dev)"
              @keydown.enter.space.prevent="toggleSelect(dev)">
              <td class="px-3 py-2" @click.stop>
                <input type="checkbox" :checked="selected.has(dev.mac)" @change="toggleSelect(dev)" class="accent-indigo-500 cursor-pointer" :title="selected.has(dev.mac) ? 'Deselect' : 'Select'">
              </td>
              <td class="px-3 py-2">
                <div class="flex items-center space-x-1.5">
                  <span class="font-medium text-slate-200">{{ dev.name }}</span>
                  <span v-if="selected.has(dev.mac)" class="badge-green">sel</span>
                  <span v-if="dev.manufacturer && dev.manufacturer !== dev.name" class="text-[10px] text-slate-500">{{ dev.manufacturer }}</span>
                </div>
              </td>
              <td class="px-3 py-2 font-mono text-slate-400 text-[11px]">
                <div class="flex items-center space-x-1.5">
                  <span>{{ dev.mac }}</span>
                  <button @click.stop="copyMac(dev)" class="text-slate-500 hover:text-cyan-400 transition-colors" title="Copy MAC">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                  </button>
                </div>
              </td>
              <td class="px-3 py-2 font-mono font-medium" :class="signalClass(dev.rssi)">{{ dev.rssi ?? 'N/A' }}</td>
              <td class="px-3 py-2 text-slate-400">{{ dev.packetCount || 0 }}</td>
              <td class="px-3 py-2 text-slate-500">{{ fmtTimeHM(dev.firstSeen) }}</td>
              <td class="px-3 py-2 text-slate-500">{{ fmtTimeHM(dev.lastSeen) }}</td>
              <td class="px-3 py-2">
                <span v-if="dev.isAirtag" class="badge-red">AirTag</span>
                <span v-else-if="isSpeaker(dev)" class="badge-amber">Speaker</span>
                <span v-else class="tag">BLE</span>
              </td>
              <td class="px-3 py-2" @click.stop>
                <div class="flex items-center space-x-1">
                  <button @click="copyMac(dev)" class="text-slate-500 hover:text-cyan-400 transition-colors" title="Copy MAC">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                  </button>
                  <button v-if="dev.isAirtag" @click="runCommand(`spoofat -t ${dev.mac}`, `Spoof ${dev.name}`, { destructive: true })" :disabled="!ctx.isConnected.value" :title="ctx.btnState('spoofat -t 0').title" class="text-pink-400 hover:text-pink-300 transition-colors disabled:opacity-30" title="Spoof this AirTag">
                    <span class="text-xs">🔄</span>
                  </button>
                  <button v-if="isSpeaker(dev)" @click="runSpeakerSpam(dev)" :disabled="!ctx.isConnected.value" :title="`Spam ${dev.name}`" class="text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-30" title="Speaker spam">
                    <span class="text-xs">🔊</span>
                  </button>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="!filteredDevices.length">
            <td colspan="9" class="text-center py-16 text-slate-600">
              <div class="text-2xl mb-2">🔵</div>
              <div>No BLE devices found</div>
              <button v-if="!ctx.isConnected.value" @click="toastConnect" class="mt-2 text-amber-400 hover:text-amber-300 text-xs">Connect to ESP32 first</button>
              <button v-else @click="runDispatched('sniffbt', 'Scan BLE')" class="mt-2 text-indigo-400 hover:text-indigo-300">Run sniffbt</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Action bar for selected devices -->
    <div v-if="selectedCount > 0" class="mt-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center space-x-2">
          <span class="text-xs font-semibold text-slate-400">Actions for {{ selectedCount }} device{{ selectedCount === 1 ? '' : 's' }}</span>
          <span v-if="selectedAirtagCount" class="badge-red">{{ selectedAirtagCount }} AirTag{{ selectedAirtagCount === 1 ? '' : 's' }}</span>
          <span v-if="selectedSpeakerCount" class="badge-amber">{{ selectedSpeakerCount }} Speaker{{ selectedSpeakerCount === 1 ? '' : 's' }}</span>
        </div>
        <button @click="clearSelection" class="text-xs text-slate-500 hover:text-slate-300 transition-colors">Clear selection</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <!-- Sniff targeted -->
        <button @click="runDispatched('sniffbt', 'Sniff Selected BLE')" :disabled="!ctx.isConnected.value" :class="ctx.btnClass('sniffbt', 'btn-primary btn-sm')">
          🔵 Sniff
        </button>
        <!-- Stop -->
        <button @click="runDispatched('stopscan', 'Stop Scan')" :disabled="!ctx.isConnected.value" :class="ctx.btnClass('stopscan', 'btn-ghost btn-sm')">
          ⏹ Stop
        </button>
        <!-- AirTag actions -->
        <template v-if="selectedAirtagCount">
          <button @click="runSelectedSpoofAt" :disabled="!ctx.isConnected.value" class="bg-pink-500/15 text-pink-300 hover:bg-pink-500/25 border border-pink-500/30 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            🔄 Spoof AirTag{{ selectedAirtagCount > 1 ? 's' : '' }}
          </button>
          <button @click="runDispatched('list -t', 'List AirTags')" :disabled="!ctx.isConnected.value" :class="ctx.btnClass('list -t', 'btn-ghost btn-sm')">
            📋 List AirTags
          </button>
        </template>
        <!-- Speaker actions -->
        <template v-if="selectedSpeakerCount">
          <button @click="runSelectedSpeakerSpam" :disabled="!ctx.isConnected.value" class="bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            🔊 Speaker Spam
          </button>
        </template>
        <!-- BLE Spam (destructive, all selected) -->
        <button @click="runDispatched('blespam -t all', 'BLE Spam All', { destructive: true })" :disabled="!ctx.isConnected.value" class="bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          ⚠ BLE Spam All
        </button>
        <!-- Copy selected MACs -->
        <button @click="copySelectedMacs" class="bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors">
          📋 Copy MACs
        </button>
      </div>
    </div>

    <ConfirmDialog :show="confirmDialog.show"
      :title="confirmDialog.title"
      :body="confirmDialog.body"
      :cmd="confirmDialog.cmd"
      :target="confirmDialog.target"
      :icon="confirmDialog.icon"
      :severity="confirmDialog.severity"
      :confirm-label="confirmDialog.confirmLabel"
      @confirm="onConfirm"
      @cancel="confirmDialog.show = false" />
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useSerialStore } from '../../stores/serialStore'
import { useBleStore } from '../../stores/bleStore'
import { signalClass, fmtTimeHM } from '../../utils/format'
import { useToast } from '../../utils/toast'
import { copyToClipboard } from '../../utils/clipboard'
import { runAction, shouldConfirm } from '../../utils/actionDispatcher'
import { getCommandMeta, SEVERITY } from '../../services/commandMeta'
import { useContextAction } from '../../composables/useContextAction'
import ConfirmDialog from '../ConfirmDialog.vue'

const serialStore = useSerialStore()
const bleStore = useBleStore()
const { show: toastShow } = useToast()
const ctx = useContextAction(serialStore)
const search = ref('')
const sortBy = ref('rssi')
const selected = reactive(new Map())

const confirmDialog = reactive({
  show: false,
  title: '',
  body: '',
  cmd: '',
  target: '',
  icon: '',
  severity: SEVERITY.HIGH,
  confirmLabel: 'Run',
  pendingPayload: null
})

const SPEAKER_KEYWORDS = ['speaker', 'jbl', 'bose', 'sony', 'marshall', 'soundbox', 'soundbar', 'earbuds', 'headphone', 'headset']

function isSpeaker(dev) {
  const name = (dev.name || '').toLowerCase()
  return SPEAKER_KEYWORDS.some(kw => name.includes(kw))
}

const selectedCount = computed(() => selected.size)

const selectedAirtagCount = computed(() => {
  let n = 0
  for (const [mac] of selected) {
    const dev = bleStore.devices.get(mac)
    if (dev?.isAirtag) n++
  }
  return n
})

const selectedSpeakerCount = computed(() => {
  let n = 0
  for (const [mac] of selected) {
    const dev = bleStore.devices.get(mac)
    if (dev && isSpeaker(dev)) n++
  }
  return n
})

const allSelected = computed(() => {
  const list = bleStore.sortedDevices
  return list.length > 0 && list.every(d => selected.has(d.mac))
})

const filteredDevices = computed(() => {
  let list = bleStore.sortedDevices
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(d =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.mac || '').toLowerCase().includes(q) ||
      (d.manufacturer || '').toLowerCase().includes(q)
    )
  }
  if (sortBy.value !== 'rssi') {
    list = [...list].sort((a, b) => {
      switch (sortBy.value) {
        case 'name': return (a.name || '').localeCompare(b.name || '')
        case 'type': return (a.isAirtag ? 0 : 1) - (b.isAirtag ? 0 : 1)
        case 'pkts': return (b.packetCount || 0) - (a.packetCount || 0)
        default: return 0
      }
    })
  }
  return list
})

const toastConnect = () => toastShow('Connect to ESP32 first', 'warning')

const toggleSelect = (dev) => {
  if (selected.has(dev.mac)) {
    selected.delete(dev.mac)
  } else {
    selected.set(dev.mac, true)
  }
}

const toggleSelectAll = () => {
  if (allSelected.value) {
    selected.clear()
  } else {
    for (const dev of bleStore.sortedDevices) {
      selected.set(dev.mac, true)
    }
  }
}

const clearSelection = () => selected.clear()

const copyMac = async (dev) => {
  if (!dev.mac) return
  const ok = await copyToClipboard(dev.mac)
  toastShow(ok ? `Copied: ${dev.mac}` : 'Copy failed', ok ? 'success' : 'error')
}

const copySelectedMacs = async () => {
  if (!selected.size) return
  const macs = Array.from(selected.keys()).join('\n')
  const ok = await copyToClipboard(macs)
  toastShow(ok ? `Copied ${selected.size} MACs` : 'Copy failed', ok ? 'success' : 'error')
}

const runDispatched = async (cmd, label, target = '', opts = {}) => {
  if (!ctx.isConnected.value) {
    toastShow('Connect to ESP32 first', 'warning')
    return
  }
  const payload = { cmd, label, icon: opts.icon || '▶', target, options: {} }
  if (shouldConfirm(cmd) || opts.destructive) {
    showConfirm(payload)
    return
  }
  await executeAction(payload)
}

const showConfirm = (payload) => {
  const meta = getCommandMeta(payload.cmd)
  confirmDialog.show = true
  confirmDialog.title = `${payload.label} — подтвердите`
  confirmDialog.body = meta?.destructive
    ? ['Команда деструктивна.', 'Устройство начнёт активную передачу в эфир.', 'Убедитесь в наличии разрешения.']
    : ['Команда изменит состояние ESP32.', 'Продолжить?']
  confirmDialog.cmd = payload.cmd
  confirmDialog.target = payload.target
  confirmDialog.icon = meta?.destructive ? '⚠' : '?'
  confirmDialog.severity = meta?.severity || SEVERITY.HIGH
  confirmDialog.confirmLabel = payload.label
  confirmDialog.pendingPayload = payload
}

const executeAction = async (payload) => {
  try {
    await runAction({ ...payload, options: { confirm: false } })
    if (payload.cmd.startsWith('clearlist')) bleStore.clearDevices()
  } catch (e) {
    toastShow(`Failed: ${e.message}`, 'error')
  }
}

const onConfirm = async () => {
  const payload = confirmDialog.pendingPayload
  confirmDialog.show = false
  confirmDialog.pendingPayload = null
  if (payload) await executeAction(payload)
}

const runSpeakerSpam = (dev) => {
  const name = (dev.name || '').toLowerCase()
  let type = 'speaker'
  if (name.includes('jbl')) type = 'jbl'
  else if (name.includes('bose')) type = 'bose'
  else if (name.includes('sony')) type = 'sony'
  else if (name.includes('marshall')) type = 'marshall'
  runCommand(`blespam -t ${type}`, `Spam ${dev.name}`, { destructive: true })
}

const runSelectedSpeakerSpam = () => {
  for (const [mac] of selected) {
    const dev = bleStore.devices.get(mac)
    if (dev && isSpeaker(dev)) {
      runSpeakerSpam(dev)
      return
    }
  }
}

const runSelectedSpoofAt = () => {
  for (const [mac] of selected) {
    const dev = bleStore.devices.get(mac)
    if (dev?.isAirtag) {
      runCommand(`spoofat -t ${dev.mac}`, `Spoof ${dev.name}`, { destructive: true })
      return
    }
  }
}

const runCommand = (cmd, label, opts = {}) => runDispatched(cmd, label, '', opts)

const handleClear = () => {
  if (bleStore.deviceCount === 0) return
  showConfirm({
    cmd: 'clearlist -c',
    label: `Clear ${bleStore.deviceCount} BLE devices`,
    icon: '🗑',
    target: '',
    options: {}
  })
}
</script>
