<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2.5">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">Probe Requests</h2>
        <span class="badge-blue">{{ probeStore.probeCount }}</span>
        <span class="text-[11px] text-slate-500">{{ probeStore.uniqueClients }} unique clients</span>
      </div>
      <div class="flex items-center space-x-2">
        <input v-model="search" type="search" placeholder="Search SSID/MAC..." class="input w-40 text-xs" aria-label="Search probes">
        <button @click="runDispatched('sniffprobe', 'Sniff Probes', '')" :disabled="!ctx.isConnected.value" :title="ctx.btnState('sniffprobe').title" :class="ctx.btnClass('sniffprobe', 'btn-primary btn-sm')">Sniff</button>
        <button @click="runDispatched('stopscan', 'Stop Sniff')" :disabled="!ctx.isConnected.value" :title="ctx.btnState('stopscan').title" :class="ctx.btnClass('stopscan', 'btn-ghost btn-sm')">Stop</button>
        <button @click="runDispatched('list -p', 'List Probes')" :disabled="!ctx.isConnected.value" :title="ctx.btnState('list -p').title" :class="ctx.btnClass('list -p', 'btn-ghost btn-sm')">List</button>
        <button @click="handleClear" :disabled="!probeStore.probeCount" :title="probeStore.probeCount ? `Clear ${probeStore.probeCount} probes` : 'No probes to clear'" class="btn-ghost btn-sm disabled:opacity-40 disabled:cursor-not-allowed">Clear</button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-700/50 scrollbar-thin">
      <table class="w-full text-xs">
        <thead class="bg-slate-800 sticky top-0 z-10">
          <tr>
            <th scope="col" class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-10">#</th>
            <th scope="col" class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider">SSID</th>
            <th scope="col" class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-36">Client MAC</th>
            <th scope="col" class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-14">CH</th>
            <th scope="col" class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-16">RSSI</th>
            <th scope="col" class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-16">Time</th>
            <th scope="col" class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-20">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in filteredProbes" :key="i + '-' + p.clientMac + '-' + p.time"
            class="border-t border-slate-700/30 hover:bg-slate-700/30 transition-colors">
            <td class="px-3 py-2 font-mono text-slate-500">{{ filteredProbes.length - i }}</td>
            <td class="px-3 py-2 font-medium text-slate-200">{{ p.ssid || '(no SSID)' }}</td>
            <td class="px-3 py-2 font-mono text-slate-400 text-[11px]">
              <div class="flex items-center space-x-1.5">
                <span>{{ p.clientMac }}</span>
                <button @click="copyMac(p)" class="text-slate-500 hover:text-cyan-400 transition-colors" title="Copy MAC" aria-label="Copy MAC">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                </button>
              </div>
            </td>
            <td class="px-3 py-2 text-slate-300">{{ p.ch }}</td>
            <td class="px-3 py-2 font-mono font-medium" :class="signalClass(p.rssi)">{{ p.rssi }}</td>
            <td class="px-3 py-2 text-slate-500">{{ fmtTimeRelative(p.time) }}</td>
            <td class="px-3 py-2">
              <button @click="copyMac(p)" class="text-slate-500 hover:text-cyan-400 transition-colors" title="Copy client MAC" aria-label="Copy client MAC">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              </button>
            </td>
          </tr>
          <tr v-if="!filteredProbes.length">
            <td colspan="7" class="text-center py-16 text-slate-600">
              <div class="text-2xl mb-2">📱</div>
              <div>No probe requests</div>
              <button v-if="!ctx.isConnected.value" @click="toastConnect" class="mt-2 text-amber-400 hover:text-amber-300 text-xs">Connect to ESP32 first</button>
              <button v-else @click="runDispatched('sniffprobe', 'Sniff Probes', '')" class="mt-2 text-indigo-400 hover:text-indigo-300">Run sniffprobe</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmDialog :show="confirmState.show"
      :title="confirmState.title"
      :body="confirmState.body"
      :cmd="confirmState.cmd"
      :target="confirmState.target"
      :icon="confirmState.icon"
      :severity="confirmState.severity"
      :confirm-label="confirmState.confirmLabel"
      @confirm="onDialogConfirmCustom"
      @cancel="onDialogCancel" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSerialStore } from '../../stores/serialStore'
import { useProbeStore } from '../../stores/probeStore'
import { signalClass, fmtTimeRelative } from '../../utils/format'
import { useToast } from '../../utils/toast'
import { copyToClipboard } from '../../utils/clipboard'
import { useCommandAction } from '../../composables/useCommandAction'
import ConfirmDialog from '../ConfirmDialog.vue'
import { t, tA } from '../../services/i18n'

const serialStore = useSerialStore()
const probeStore = useProbeStore()
const { show: toastShow } = useToast()
const { confirmState, execute, onDialogConfirm, onDialogCancel, showConfirm } = useCommandAction()
const search = ref('')

const filteredProbes = computed(() => {
  let list = probeStore.probes
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(p =>
      (p.ssid || '').toLowerCase().includes(q) ||
      (p.clientMac || '').toLowerCase().includes(q)
    )
  }
  return list
})

const toastConnect = () => toastShow(t('common.connectFirst'), 'warning')

const copyMac = async (p) => {
  if (!p.clientMac) return
  const ok = await copyToClipboard(p.clientMac)
  toastShow(ok ? t('probesExplorer.copied', { mac: p.clientMac }) : t('common.copyFailed'), ok ? 'success' : 'error')
}

const runDispatched = async (cmd, label, target = '') => {
  await execute(cmd, label, '▶', target)
}

const onDialogConfirmCustom = async () => {
  const payload = confirmState.pendingPayload
  if (payload && payload.__clear) {
    confirmState.show = false
    confirmState.pendingPayload = null
    probeStore.clearProbes()
    toastShow(t('probesExplorer.cleared'), 'success')
    return
  }
  await onDialogConfirm()
}

const handleClear = () => {
  if (probeStore.probeCount === 0) return
  showConfirm({ cmd: '', label: '', icon: '🗑', target: '', options: {}, __clear: true })
  confirmState.title = t('confirm.title', { label: `Clear ${probeStore.probeCount} probes` })
  confirmState.body = tA('confirm.bodyNormal')
}
</script>
