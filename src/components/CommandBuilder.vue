<template>
  <div class="flex flex-col gap-1">
    <div class="flex flex-wrap gap-1.5 items-start">
      <template v-for="group in COMMAND_GROUPS" :key="group.name">
        <div class="flex flex-wrap gap-x-0.5 gap-y-0.5 items-baseline px-2 py-1.5 rounded-lg bg-slate-800/20">
          <span class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mr-1 flex-shrink-0">{{ group.nameRu }}</span>
          <button v-for="cmd in group.commands" :key="cmd.command" @click="send(cmd.command)"
            @mouseenter="showTip($event, cmd)" @mouseleave="hideTip"
            class="flex items-center space-x-0.5 px-1.5 py-0.5 text-xs font-medium rounded-md transition-all duration-150 whitespace-nowrap"
            :class="btnClass(cmd)">
            <span>{{ cmd.icon }}</span>
            <span class="hidden sm:inline">{{ cmd.label }}</span>
          </button>
        </div>
      </template>

      <div class="flex items-center space-x-1 px-2 py-1.5">
        <input v-model="custom" @keyup.enter="sendCustom"
          class="w-20 lg:w-28 px-2 py-1 text-xs bg-slate-800 rounded-lg border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          placeholder="cmd...">
        <button @click="sendCustom" class="btn-primary btn-sm">→</button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="tooltipCmd && tipPos"
        class="fixed z-[9999] w-80 p-3.5 rounded-xl shadow-2xl border pointer-events-none text-sm bg-slate-700 border-slate-600 text-slate-100"
        :style="{ left: tipPos.x + 'px', top: tipPos.y + 'px' }">
        <div class="font-semibold text-base mb-1.5 flex items-center space-x-2">
          <span>{{ tooltipCmd.icon }}</span>
          <span>{{ tooltipCmd.label }}</span>
        </div>
        <div class="text-xs leading-relaxed opacity-90">{{ tooltipCmd.ru }}</div>
        <div class="mt-2 text-[11px] font-mono px-2 py-1 rounded inline-block opacity-60 bg-slate-800/50">{{ tooltipCmd.command }}</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useSerialStore } from '../stores/serialStore'
import { useDashboardStore } from '../stores/dashboardStore'
import { COMMAND_GROUPS } from '../services/commandRegistry'

const serialStore = useSerialStore()
const dashStore = useDashboardStore()
const custom = ref('')

const tooltipCmd = ref(null)
const tipPos = ref(null)

const PROMPT_RULES = [
  { re: /^select -a (\d+)$/, prompt: 'AP index (0, 1, 2...)', build: v => `select -a ${v}` },
  { re: /^select -a -f "contains (.+)"$/, prompt: 'Search text', build: v => `select -a -f "contains ${v}"` },
  { re: /^select -a -f "equals (.+)"$/, prompt: 'Exact SSID', build: v => `select -a -f "equals ${v}"` },
  { re: /^join -a (\d+) -p "(.+)"$/, prompts: ['AP index', 'Password'], build: (v1, v2) => `join -a ${v1} -p "${v2}"` },
  { re: /^add -a -b ([0-9A-F:]+) -e "(.+)"$/i, prompts: ['BSSID (MAC)', 'SSID name'], build: (m, s) => `add -a -b ${m} -e "${s}"` },
  { re: /^add -c -b ([0-9A-F:]+) -ap (\d+)$/i, prompts: ['BSSID (MAC)', 'AP index'], build: (m, i) => `add -c -b ${m} -ap ${i}` },
  { re: /^ssid -a -n "(.+)"$/, prompt: 'SSID name', build: v => `ssid -a -n "${v}"` },
  { re: /^ssid -r (\d+)$/, prompt: 'SSID index (from list -s)', build: v => `ssid -r ${v}` },
  { re: /^cloneapmac -a (\d+)$/, prompt: 'AP index', build: v => `cloneapmac -a ${v}` },
  { re: /^clonestamac -s (\d+)$/, prompt: 'Station index', build: v => `clonestamac -s ${v}` },
  { re: /^info -a (\d+)$/, prompt: 'AP index', build: v => `info -a ${v}` },
  { re: /^led -s (#[0-9A-F]+)$/i, prompt: 'Hex color (e.g. #FF0000)', build: v => `led -s ${v}` },
  { re: /^brightness -s (\d+)$/, prompt: 'Brightness (0-9)', build: v => `brightness -s ${v}` },
]

const resolveCommand = (cmd) => {
  for (const rule of PROMPT_RULES) {
    const m = cmd.match(rule.re)
    if (m) {
      if (rule.prompts) {
        const vals = []
        for (let i = 0; i < rule.prompts.length; i++) {
          const val = window.prompt(`${rule.prompts[i]}:`, m[i + 1] || '')
          if (val === null) return null
          vals.push(val)
        }
        return rule.build(...vals)
      }
      const val = window.prompt(`${rule.prompt}:`, m[1] || '')
      if (val === null) return null
      return rule.build(val)
    }
  }
  return cmd
}

const send = (cmd) => {
  const resolved = resolveCommand(cmd)
  if (resolved === null) return
  serialStore.sendCommand(resolved)
  dashStore.incrementCommands()
}
const sendCustom = () => { if (custom.value.trim()) { send(custom.value); custom.value = '' } }

const btnClass = (cmd) => {
  if (cmd.warning) return 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
  if (cmd.color === 'red') return 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
  return 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25'
}

const showTip = (e, cmd) => {
  tooltipCmd.value = cmd
  const pad = 14
  const tw = 320
  const th = 150
  let x = e.clientX + pad
  let y = e.clientY - th - pad
  if (y < pad) y = e.clientY + pad
  if (x + tw > window.innerWidth - pad) x = window.innerWidth - tw - pad
  tipPos.value = { x, y }
}

const hideTip = () => {
  tooltipCmd.value = null
  tipPos.value = null
}
</script>
