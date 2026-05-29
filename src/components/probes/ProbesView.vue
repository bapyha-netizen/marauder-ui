<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2.5">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">Probe Requests</h2>
        <span class="badge-blue">{{ probeStore.probeCount }}</span>
        <span class="text-[11px] text-slate-500">{{ probeStore.uniqueClients }} unique clients</span>
      </div>
      <div class="flex items-center space-x-2">
        <input v-model="search" placeholder="Search..." class="input w-36 text-xs">
        <button @click="serialStore.sendCommand('sniffprobe')" class="btn-primary btn-sm">Sniff Probe</button>
        <button @click="probeStore.clearProbes()" class="btn-ghost btn-sm">Clear</button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-700/50 scrollbar-thin">
      <table class="w-full text-xs">
        <thead class="bg-slate-800 sticky top-0 z-10">
          <tr>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-10">#</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider">SSID</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-36">Client MAC</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-14">CH</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-16">RSSI</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider w-16">Time</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in filteredProbes" :key="i"
            class="border-t border-slate-700/30 hover:bg-slate-700/30 transition-colors">
            <td class="px-3 py-2 font-mono text-slate-500">{{ filteredProbes.length - i }}</td>
            <td class="px-3 py-2 font-medium text-slate-200">{{ p.ssid }}</td>
            <td class="px-3 py-2 font-mono text-slate-400 text-[11px]">{{ p.clientMac }}</td>
            <td class="px-3 py-2 text-slate-300">{{ p.ch }}</td>
            <td class="px-3 py-2 font-mono font-medium" :class="signalClass(p.rssi)">{{ p.rssi }}</td>
            <td class="px-3 py-2 text-slate-500">{{ fmtTimeRelative(p.time) }}</td>
          </tr>
          <tr v-if="!filteredProbes.length">
            <td colspan="6" class="text-center py-16 text-slate-600">No probe requests. Run <span class="font-mono text-slate-400">sniffprobe</span>.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSerialStore } from '../../stores/serialStore'
import { useProbeStore } from '../../stores/probeStore'
import { signalClass, fmtTimeRelative } from '../../utils/format'

const serialStore = useSerialStore()
const probeStore = useProbeStore()
const search = ref('')

const filteredProbes = computed(() => {
  let list = probeStore.reversedProbes
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(p => p.ssid.toLowerCase().includes(q) || p.clientMac.toLowerCase().includes(q))
  }
  return list
})
</script>
