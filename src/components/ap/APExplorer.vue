<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2.5">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">Access Points</h2>
        <span class="badge-blue">{{ apStore.apCount }}</span>
        <span v-if="selectedCount" class="badge-green">{{ selectedCount }} selected</span>
      </div>
      <div class="flex items-center space-x-2">
        <input v-model="search" placeholder="Search..." class="input w-36 lg:w-48 text-xs">
        <select v-model="sortBy" class="input w-auto text-xs py-1">
          <option value="rssi">Signal</option>
          <option value="essid">Name</option>
          <option value="channel">Channel</option>
          <option value="stations">Clients</option>
        </select>
        <button @click="runDispatched('scanall', 'Scan APs')" :disabled="!ctx.isConnected.value" :title="ctx.btnState('scanall').title" :class="ctx.btnClass('scanall', 'btn-primary btn-sm')">Scan</button>
        <button @click="runDispatched('list -a', 'List APs')" :disabled="!ctx.isConnected.value" :title="ctx.btnState('list -a').title" :class="ctx.btnClass('list -a', 'btn-primary btn-sm')">List</button>
        <button @click="runDispatched('stopscan', 'Stop Scan')" :disabled="!ctx.isConnected.value" :title="ctx.btnState('stopscan').title" :class="ctx.btnClass('stopscan', 'btn-ghost btn-sm')">Stop</button>
        <button @click="toggleSelectAll" :disabled="!apStore.apCount" :title="allSelected ? 'Deselect all' : 'Select all APs'" :class="['btn-ghost btn-sm', (allSelected ? 'btn-success' : ''), 'disabled:opacity-40 disabled:cursor-not-allowed']">{{ allSelected ? 'Deselect All' : 'Select All' }}</button>
        <button v-if="apStore.accessPoints.size > 0" @click="copyAllBssids" class="btn-ghost btn-sm" title="Copy all BSSIDs (one per line)">Copy All</button>
        <button @click="handleClear" :disabled="!apStore.apCount" :title="apStore.apCount ? `Clear ${apStore.apCount} APs` : 'No APs to clear'" class="btn-ghost btn-sm disabled:opacity-40 disabled:cursor-not-allowed">Clear</button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-700/50 scrollbar-thin">
      <table class="w-full text-xs">
        <thead class="bg-slate-800 sticky top-0 z-10">
          <tr>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-12"><input type="checkbox" @click.stop="toggleSelectAll" :checked="allSelected" :disabled="!apStore.apCount" class="accent-indigo-500 cursor-pointer disabled:opacity-40" title="Select all"></th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-10">#</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider">ESSID</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-12">CH</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-16">RSSI</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-20">Signal</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-36">BSSID</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-20">Vendor</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-10">STA</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-12">Enc</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-16">Seen</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="ap in filteredAPs" :key="ap.bssid">
            <tr class="border-t border-slate-700/30 hover:bg-slate-700/30 cursor-pointer transition-colors"
              :class="ap.isSelected ? 'bg-indigo-500/10' : ''"
              tabindex="0"
              @click="toggleExpand(ap.bssid)"
              @keydown.enter.space.prevent="toggleExpand(ap.bssid)">
              <td class="px-3 py-2" @click.stop>
                <input type="checkbox" :checked="ap.isSelected" @change="toggleSelect(ap)" :disabled="!ctx.isConnected.value" class="accent-indigo-500 cursor-pointer disabled:opacity-40" :title="ap.isSelected ? 'Deselect' : 'Select'">
              </td>
              <td class="px-3 py-2 font-mono text-slate-500">{{ ap.index ?? '-' }}</td>
              <td class="px-3 py-2">
                <div class="flex items-center space-x-1.5">
                  <span class="font-medium text-slate-200">{{ ap.essid }}</span>
                  <span v-if="ap.isSelected" class="badge-green">sel</span>
                  <span v-if="ap.isHidden" class="badge-amber">hidden</span>
                  <button v-if="ap.essid && ap.essid !== '(hidden)'" @click.stop="copyEssid(ap)" class="text-slate-500 hover:text-cyan-400 transition-colors" title="Copy SSID">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                  </button>
                </div>
              </td>
              <td class="px-3 py-2 text-slate-300">{{ ap.channel }}</td>
              <td class="px-3 py-2 font-mono font-medium" :class="signalClass(ap.rssi)">{{ ap.rssi ?? 'N/A' }}</td>
              <td class="px-3 py-2">
                <svg v-if="ap.rssiHistory?.length > 1" :width="40" :height="16" viewBox="0 0 40 16" class="inline-block">
                  <polyline :points="sparklinePoints(ap.rssiHistory)" fill="none" stroke="currentColor" stroke-width="1.5" class="text-indigo-400" vector-effect="non-scaling-stroke"/>
                </svg>
                <span v-else class="text-slate-600 text-[10px]">--</span>
              </td>
              <td class="px-3 py-2 font-mono text-slate-400 text-[11px]">
                <div class="flex items-center space-x-1.5">
                  <span>{{ ap.bssid }}</span>
                  <button @click.stop="copyBssid(ap)" class="text-slate-500 hover:text-cyan-400 transition-colors" title="Copy BSSID">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                  </button>
                </div>
              </td>
              <td class="px-3 py-2">
                <span v-if="ap.vendor" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400 font-medium">{{ ap.vendor }}</span>
              </td>
              <td class="px-3 py-2"><span class="badge-blue">{{ ap.stations?.length || 0 }}</span></td>
              <td class="px-3 py-2 text-slate-500">{{ ap.encryption || '-' }}</td>
              <td class="px-3 py-2 text-slate-500">{{ fmtTimeRelative(ap.lastSeen) }}</td>
              <td class="px-3 py-2" @click.stop>
                <div class="flex items-center space-x-1">
                  <button v-if="ap.index !== undefined" @click="runDispatched(`info -a ${ap.index}`, `Info ${ap.essid}`, ap.bssid)" :disabled="!ctx.isConnected.value" :title="ctx.btnState('info -a 0').title" class="text-slate-500 hover:text-cyan-400 transition-colors disabled:opacity-30" title="Get detailed info">
                    <span class="text-xs">ℹ</span>
                  </button>
                  <button v-if="ap.index !== undefined && ap.isSelected" @click="runDispatched('attack -t deauth', `Deauth ${ap.essid}`, ap.bssid, { destructive: true })" :disabled="!ctx.isConnected.value" :title="ctx.btnState('attack -t deauth').title" class="text-red-400 hover:text-red-300 transition-colors disabled:opacity-30" title="Deauth this AP">
                    <span class="text-xs">⚡</span>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="expanded.has(ap.bssid) && ap.stations?.length" class="bg-slate-800/50 border-t border-slate-700/30">
              <td colspan="12" class="px-3 py-2">
                <div class="pl-6 space-y-1 text-xs">
                  <div v-for="sta in ap.stations" :key="sta.mac" class="flex items-center space-x-3 text-slate-400">
                    <span class="text-slate-600 w-6">#{{ sta.id }}</span>
                    <span class="font-mono text-slate-300">{{ sta.mac }}</span>
                    <span v-if="sta.vendor" class="text-slate-500">({{ sta.vendor }})</span>
                    <span class="text-slate-600">{{ fmtTimeRelative(sta.lastSeen) }}</span>
                    <button @click="copyText(sta.mac, 'Station MAC')" class="text-slate-500 hover:text-cyan-400 transition-colors" title="Copy MAC">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="!filteredAPs.length">
            <td colspan="12" class="text-center py-16 text-slate-600">
              <div class="text-2xl mb-2">📡</div>
              <div>No access points found</div>
              <button v-if="!ctx.isConnected.value" @click="toastConnect" class="mt-2 text-amber-400 hover:text-amber-300 text-xs">Connect to ESP32 first</button>
              <button v-else @click="runDispatched('scanall', 'Scan APs')" class="mt-2 text-indigo-400 hover:text-indigo-300">Run scanall</button>
            </td>
          </tr>
        </tbody>
      </table>
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
import { useApStore } from '../../stores/apStore'
import { signalClass, fmtTimeRelative } from '../../utils/format'
import { useToast } from '../../utils/toast'
import { copyToClipboard } from '../../utils/clipboard'
import { runAction, shouldConfirm } from '../../utils/actionDispatcher'
import { getCommandMeta, SEVERITY } from '../../services/commandMeta'
import { useContextAction } from '../../composables/useContextAction'
import ConfirmDialog from '../ConfirmDialog.vue'

const serialStore = useSerialStore()
const apStore = useApStore()
const { show: toastShow } = useToast()
const ctx = useContextAction(serialStore)
const search = ref('')
const sortBy = ref('rssi')
const expanded = ref(new Set())

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

const selectedCount = computed(() => {
  let n = 0
  for (const ap of apStore.accessPoints.values()) if (ap.isSelected) n++
  return n
})

const toggleExpand = (bssid) => {
  const s = new Set(expanded.value)
  if (s.has(bssid)) s.delete(bssid)
  else s.add(bssid)
  expanded.value = s
}

const copyText = async (text, label = 'Text') => {
  if (!text) return
  const ok = await copyToClipboard(text)
  toastShow(ok ? `Copied ${label}: ${text}` : 'Copy failed', ok ? 'success' : 'error')
}

const copyBssid = async (ap) => copyText(ap.bssid, 'BSSID')
const copyEssid = async (ap) => copyText(ap.essid, 'SSID')

const copyAllBssids = async () => {
  const all = Array.from(apStore.accessPoints.values())
  if (all.length === 0) return
  const text = all.map(a => a.bssid).filter(Boolean).join('\n')
  const ok = await copyToClipboard(text)
  toastShow(ok ? `Copied ${all.length} BSSIDs` : 'Copy failed', ok ? 'success' : 'error')
}

const filteredAPs = computed(() => {
  let list = apStore.sortedAPs
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(ap =>
      (ap.essid || '').toLowerCase().includes(q) ||
      (ap.bssid || '').toLowerCase().includes(q)
    )
  }
  if (sortBy.value !== 'rssi') {
    list = [...list].sort((a, b) => {
      switch (sortBy.value) {
        case 'essid': return (a.essid || '').localeCompare(b.essid || '')
        case 'channel': return (a.channel || 0) - (b.channel || 0)
        case 'stations': return (b.stations?.length || 0) - (a.stations?.length || 0)
        default: return 0
      }
    })
  }
  return list
})

const toastConnect = () => toastShow('Connect to ESP32 first', 'warning')

const toggleSelect = async (ap) => {
  if (!ctx.isConnected.value) {
    toastShow('Connect to ESP32 first', 'warning')
    return
  }
  if (ap.index === undefined || ap.index === null) {
    toastShow('AP has no index — run "list -a" first', 'warning')
    return
  }
  try {
    await runAction({
      cmd: `select -a ${ap.index}`,
      label: ap.isSelected ? `Deselect ${ap.essid}` : `Select ${ap.essid}`,
      icon: ap.isSelected ? '⊘' : '✅',
      target: ap.bssid,
      options: { confirm: false }
    })
    apStore.updateAP(ap.index, { isSelected: !ap.isSelected })
  } catch (e) {
    toastShow(`Select failed: ${e.message}`, 'error')
  }
}

const allSelected = computed(() => {
  const list = Array.from(apStore.accessPoints.values()).filter(ap => ap.index !== undefined)
  return list.length > 0 && list.every(ap => ap.isSelected)
})

const toggleSelectAll = async () => {
  if (!ctx.isConnected.value) {
    toastShow('Connect to ESP32 first', 'warning')
    return
  }
  if (!apStore.apCount) return
  const newState = !allSelected.value
  try {
    await runAction({
      cmd: 'select -a all',
      label: newState ? 'Select all APs' : 'Deselect all APs',
      icon: newState ? '☑' : '⊘',
      target: '',
      options: { confirm: false }
    })
    for (const ap of apStore.accessPoints.values()) {
      if (ap.index !== undefined) {
        apStore.updateAP(ap.index, { isSelected: newState })
      }
    }
    toastShow(newState ? 'All APs selected' : 'All APs deselected', 'info')
  } catch (e) {
    toastShow(`Select all failed: ${e.message}`, 'error')
  }
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
    ? ['Команда деструктивна для сетей рядом.', 'ESP32 начнёт активную передачу.', 'Убедитесь в наличии разрешения на тест.']
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

const handleClear = () => {
  if (!apStore.apCount) return
  showConfirm({
    cmd: 'clearlist -a',
    label: `Clear ${apStore.apCount} APs`,
    icon: '🗑',
    target: '',
    options: {}
  })
}

const sparklinePoints = (history) => {
  if (!history || history.length < 2) return ''
  const w = 40, h = 16, pad = 1
  const min = Math.min(...history), max = Math.max(...history)
  const range = max - min || 1
  const xStep = (w - pad * 2) / (history.length - 1)
  return history.map((v, i) => {
    const x = pad + i * xStep
    const y = pad + (1 - (v - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}
</script>
