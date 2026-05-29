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
        <button @click="serialStore.sendCommand('sniffbt')" class="btn-primary btn-sm">Scan</button>
        <button @click="bleStore.clearDevices()" class="btn-ghost btn-sm">Clear</button>
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
          </tr>
        </thead>
        <tbody>
          <tr v-for="dev in filteredDevices" :key="dev.mac"
            class="border-t border-slate-700/30 hover:bg-slate-700/30 transition-colors"
            :class="dev.isAirtag ? 'bg-red-500/5' : ''">
            <td class="px-3 py-2 font-medium text-slate-200">{{ dev.name }}</td>
            <td class="px-3 py-2 font-mono text-slate-400 text-[11px]">{{ dev.mac }}</td>
            <td class="px-3 py-2 font-mono font-medium" :class="signalClass(dev.rssi)">{{ dev.rssi ?? 'N/A' }}</td>
            <td class="px-3 py-2 text-slate-400">{{ dev.packetCount || 0 }}</td>
            <td class="px-3 py-2 text-slate-500">{{ fmtTimeHM(dev.firstSeen) }}</td>
            <td class="px-3 py-2 text-slate-500">{{ fmtTimeHM(dev.lastSeen) }}</td>
            <td class="px-3 py-2">
              <span v-if="dev.isAirtag" class="badge-red">AirTag</span>
              <span v-else class="tag">BLE</span>
            </td>
          </tr>
          <tr v-if="!filteredDevices.length">
            <td colspan="7" class="text-center py-16 text-slate-600">No BLE devices found. Run <span class="font-mono text-slate-400">sniffbt</span>.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSerialStore } from '../../stores/serialStore'
import { useBleStore } from '../../stores/bleStore'
import { signalClass, fmtTimeHM } from '../../utils/format'

const serialStore = useSerialStore()
const bleStore = useBleStore()
const search = ref('')

const filteredDevices = computed(() => {
  let list = bleStore.sortedDevices
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(d => d.name.toLowerCase().includes(q) || d.mac.toLowerCase().includes(q))
  }
  return list
})
</script>
