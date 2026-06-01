<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2.5">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">Access Points</h2>
        <span class="badge-blue">{{ apStore.apCount }}</span>
      </div>
      <div class="flex items-center space-x-2">
        <input v-model="search" placeholder="Search..." class="input w-36 lg:w-48 text-xs">
        <select v-model="sortBy" class="input w-auto text-xs py-1">
          <option value="rssi">Signal</option>
          <option value="essid">Name</option>
          <option value="channel">Channel</option>
          <option value="stations">Clients</option>
        </select>
        <button @click="serialStore.scanAll()" class="btn-primary btn-sm">Scan</button>
        <button @click="serialStore.sendCommand('list -a')" class="btn-primary btn-sm">List</button>
        <button @click="apStore.clearAPs()" class="btn-ghost btn-sm">Clear</button>
        <button v-if="apStore.accessPoints.size > 0" @click="copyAllBssids" class="btn-ghost btn-sm" title="Copy all BSSIDs (one per line)">Copy All</button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-700/50 scrollbar-thin">
      <table class="w-full text-xs">
        <thead class="bg-slate-800 sticky top-0 z-10">
          <tr>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-12"><input type="checkbox" @click.stop="toggleSelectAll" :checked="allSelected" class="accent-indigo-500 cursor-pointer" title="Select all"></th>
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
          </tr>
        </thead>
        <tbody>
          <template v-for="ap in filteredAPs" :key="ap.bssid">
            <tr class="border-t border-slate-700/30 hover:bg-slate-700/30 cursor-pointer transition-colors"
              @click="toggleExpand(ap.bssid)">
              <td class="px-3 py-2" @click.stop>
                <input type="checkbox" :checked="ap.isSelected" @change="toggleSelect(ap)"
                  class="accent-indigo-500 cursor-pointer" :title="ap.isSelected ? 'Deselect' : 'Select'">
              </td>
              <td class="px-3 py-2 font-mono text-slate-500">{{ ap.index ?? '-' }}</td>
              <td class="px-3 py-2">
                <div class="flex items-center space-x-1.5">
                  <span class="font-medium text-slate-200">{{ ap.essid }}</span>
                  <span v-if="ap.isSelected" class="badge-green">sel</span>
                  <span v-if="ap.isHidden" class="badge-amber">hidden</span>
                  <button v-if="ap.essid && ap.essid !== '(hidden)'" @click="copyEssid(ap)" class="text-slate-500 hover:text-cyan-400 transition-colors" title="Copy SSID">
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
                  <button @click="copyBssid(ap)" class="text-slate-500 hover:text-cyan-400 transition-colors" title="Copy BSSID">
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
            </tr>
            <tr v-if="expanded.has(ap.bssid) && ap.stations?.length" class="bg-slate-800/50 border-t border-slate-700/30">
              <td colspan="11" class="px-3 py-2">
                <div class="pl-6 space-y-1 text-xs">
                  <div v-for="sta in ap.stations" :key="sta.mac" class="flex items-center space-x-3 text-slate-400">
                    <span class="text-slate-600 w-6">#{{ sta.id }}</span>
                    <span class="font-mono text-slate-300">{{ sta.mac }}</span>
                    <span v-if="sta.vendor" class="text-slate-500">({{ sta.vendor }})</span>
                    <span class="text-slate-600">{{ fmtTimeRelative(sta.lastSeen) }}</span>
                  </div>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="!filteredAPs.length">
            <td colspan="11" class="text-center py-16 text-slate-600">No access points found. Run <span class="font-mono text-slate-400">scanall</span>.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSerialStore } from '../../stores/serialStore'
import { useApStore } from '../../stores/apStore'
import { signalClass, fmtTimeRelative } from '../../utils/format'
import { lookupVendor } from '../../utils/oui'
import { useToast } from '../../utils/toast'
import { copyToClipboard } from '../../utils/clipboard'

const serialStore = useSerialStore()
const apStore = useApStore()
const { show: toastShow } = useToast()
const search = ref('')
const sortBy = ref('rssi')
const expanded = ref(new Set())

const toggleExpand = (bssid) => {
  const s = new Set(expanded.value)
  if (s.has(bssid)) s.delete(bssid)
  else s.add(bssid)
  expanded.value = s
}

const copyBssid = async (ap) => {
  if (!ap.bssid) return
  const ok = await copyToClipboard(ap.bssid)
  toastShow(ok ? `Copied BSSID: ${ap.bssid}` : 'Copy failed', ok ? 'success' : 'error')
}

const copyEssid = async (ap) => {
  if (!ap.essid || ap.essid === '(hidden)') return
  const ok = await copyToClipboard(ap.essid)
  toastShow(ok ? `Copied SSID: ${ap.essid}` : 'Copy failed', ok ? 'success' : 'error')
}

const copyAllBssids = async () => {
  const all = Array.from(apStore.accessPoints.values())
  if (all.length === 0) return
  const text = all.map(a => a.bssid).filter(Boolean).join('\n')
  const ok = await copyToClipboard(text)
  toastShow(ok ? `Copied ${all.length} BSSIDs to clipboard` : 'Copy failed', ok ? 'success' : 'error')
}

const filteredAPs = computed(() => {
  let list = apStore.sortedAPs
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(ap => ap.essid.toLowerCase().includes(q) || ap.bssid.toLowerCase().includes(q))
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

const toggleSelect = async (ap) => {
  if (ap.index !== undefined && ap.index !== null) {
    try {
      await serialStore.sendCommand(`select -a ${ap.index}`)
      const newState = !ap.isSelected
      apStore.updateAP(ap.index, { isSelected: newState })
      toastShow(newState ? `Selected AP #${ap.index}: ${ap.essid}` : `Deselected AP #${ap.index}`, 'info')
    } catch (e) {
      toastShow(`Failed to select AP: ${e.message}`, 'error')
    }
  }
}

const allSelected = computed(() => {
  const list = Array.from(apStore.accessPoints.values()).filter(ap => ap.index !== undefined)
  return list.length > 0 && list.every(ap => ap.isSelected)
})

const toggleSelectAll = async () => {
  const newState = !allSelected.value
  try {
    await serialStore.sendCommand('select -a all')
    for (const [key, ap] of apStore.accessPoints) {
      if (ap.index !== undefined) {
        apStore.updateAP(ap.index, { isSelected: newState })
      }
    }
    toastShow(newState ? 'All APs selected' : 'All APs deselected', 'info')
  } catch (e) {
    toastShow(`Failed to select all APs: ${e.message}`, 'error')
  }
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
