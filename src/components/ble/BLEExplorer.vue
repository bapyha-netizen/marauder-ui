<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2.5">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">BLE Devices</h2>
        <span class="badge-blue">{{ bleStore.deviceCount }}</span>
        <span v-if="bleStore.airtagCount" class="badge-red">{{ bleStore.airtagCount }} AirTags</span>
      </div>
      <div class="flex items-center space-x-2">
        <input v-model="search" placeholder="Search..." class="input w-40 text-xs">
        <button @click="runScan('sniffbt', 'Scan BLE')" :disabled="!ctx.isConnected.value" :title="ctx.btnState('sniffbt').title" :class="ctx.btnClass('sniffbt', 'btn-primary btn-sm')">Scan</button>
        <button @click="runSniff('-t airtag', 'AirTag')" :disabled="!ctx.isConnected.value" :title="ctx.btnState('sniffbt -t airtag').title" :class="ctx.btnClass('sniffbt -t airtag', 'btn-ghost btn-sm')">AirTag</button>
        <button @click="runSniff('-t flipper', 'Flipper')" :disabled="!ctx.isConnected.value" :title="ctx.btnState('sniffbt -t flipper').title" :class="ctx.btnClass('sniffbt -t flipper', 'btn-ghost btn-sm')">Flipper</button>
        <button @click="runSniff('-t meta', 'Meta')" :disabled="!ctx.isConnected.value" :title="ctx.btnState('sniffbt -t meta').title" :class="ctx.btnClass('sniffbt -t meta', 'btn-ghost btn-sm')">Meta</button>
        <button @click="runCommand('blespam -t sourapple', 'Sour Apple', { destructive: true })" :disabled="!ctx.isConnected.value" :title="ctx.btnState('blespam -t sourapple').title" :class="ctx.btnClass('blespam -t sourapple', 'btn-ghost btn-sm')">Sour Apple</button>
        <button @click="runCommand('list -t', 'List AirTags')" :disabled="!ctx.isConnected.value" :title="ctx.btnState('list -t').title" :class="ctx.btnClass('list -t', 'btn-ghost btn-sm')">List</button>
        <button @click="handleClear" :disabled="!bleStore.deviceCount" :title="bleStore.deviceCount ? `Clear ${bleStore.deviceCount} devices` : 'No devices to clear'" class="btn-ghost btn-sm disabled:opacity-40 disabled:cursor-not-allowed">Clear</button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-700/50 scrollbar-thin">
      <table class="w-full text-xs">
        <thead class="bg-slate-800 sticky top-0 z-10">
          <tr>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider">Name</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-40">MAC</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-14">RSSI</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-14">Pkts</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-16">First</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-16">Last</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-14">Type</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-20">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="dev in filteredDevices" :key="dev.mac"
            class="border-t border-slate-700/30 hover:bg-slate-700/30 transition-colors"
            :class="dev.isAirtag ? 'bg-red-500/5' : ''">
            <td class="px-3 py-2 font-medium text-slate-200">{{ dev.name }}</td>
            <td class="px-3 py-2 font-mono text-slate-400 text-[11px]">
              <div class="flex items-center space-x-1.5">
                <span>{{ dev.mac }}</span>
                <button @click="copyMac(dev)" class="text-slate-500 hover:text-cyan-400 transition-colors" title="Copy MAC">
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
              <span v-else class="tag">BLE</span>
            </td>
            <td class="px-3 py-2">
              <div class="flex items-center space-x-1">
                <button @click="copyMac(dev)" class="text-slate-500 hover:text-cyan-400 transition-colors" title="Copy MAC">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                </button>
                <button v-if="dev.isAirtag" @click="runCommand(`spoofat -t ${dev.mac}`, `Spoof ${dev.name}`, { destructive: true })" :disabled="!ctx.isConnected.value" :title="ctx.btnState('spoofat -t 0').title" class="text-pink-400 hover:text-pink-300 transition-colors disabled:opacity-30" title="Spoof this AirTag">
                  <span class="text-xs">🔄</span>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!filteredDevices.length">
            <td colspan="8" class="text-center py-16 text-slate-600">
              <div class="text-2xl mb-2">🔵</div>
              <div>No BLE devices found</div>
              <button v-if="!ctx.isConnected.value" @click="toastConnect" class="mt-2 text-amber-400 hover:text-amber-300 text-xs">Connect to ESP32 first</button>
              <button v-else @click="runScan('sniffbt', 'Scan BLE')" class="mt-2 text-indigo-400 hover:text-indigo-300">Run sniffbt</button>
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

const filteredDevices = computed(() => {
  let list = bleStore.sortedDevices
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(d =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.mac || '').toLowerCase().includes(q)
    )
  }
  return list
})

const toastConnect = () => toastShow('Connect to ESP32 first', 'warning')

const copyMac = async (dev) => {
  if (!dev.mac) return
  const ok = await copyToClipboard(dev.mac)
  toastShow(ok ? `Copied: ${dev.mac}` : 'Copy failed', ok ? 'success' : 'error')
}

const runScan = (cmd, label) => runDispatched(cmd, label, '')

const runSniff = (flag, label) => {
  const cmd = `sniffbt ${flag}`
  return runDispatched(cmd, `Sniff ${label}`, '')
}

const runCommand = (cmd, label, opts = {}) => runDispatched(cmd, label, '', opts)

const runDispatched = async (cmd, label, target, opts = {}) => {
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
