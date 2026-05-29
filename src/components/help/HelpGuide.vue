<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between mb-3 flex-shrink-0">
      <div class="flex items-center space-x-3">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">Справка</h2>
        <span class="text-[11px] text-slate-500">{{ totalCommands }} команд</span>
      </div>
      <div class="relative">
        <input v-model="search" placeholder="Поиск команды..."
          class="w-56 pl-7 pr-2 py-1.5 text-xs bg-slate-800 rounded-lg border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors">
        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-3 pr-1">
      <div v-for="group in filteredGroups" :key="group.name"
        class="rounded-xl border border-slate-700/50 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-2.5 bg-slate-800/50 border-b border-slate-700/50">
          <div class="flex items-center space-x-2">
            <span class="text-sm">{{ groupIcons[group.name] || '📋' }}</span>
            <h3 class="text-sm font-bold text-slate-200">{{ group.nameRu }}</h3>
          </div>
          <span class="text-[10px] text-slate-500">{{ filteredCommands(group).length }} / {{ group.commands.length }}</span>
        </div>

        <div class="divide-y divide-slate-700/30" v-if="filteredCommands(group).length">
          <div v-for="cmd in filteredCommands(group)" :key="cmd.command"
            @click="copyCommand(cmd.command)"
            class="flex items-start space-x-3 px-4 py-2.5 hover:bg-slate-700/20 transition-colors cursor-pointer group">
            <span class="text-base flex-shrink-0 mt-0.5 w-5 text-center">{{ cmd.icon || '▸' }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-2 mb-0.5">
                <code class="text-xs font-mono font-semibold px-1.5 py-0.5 rounded border"
                  :class="cmd.warning
                    ? 'bg-amber-900/20 border-amber-700/30 text-amber-300'
                    : 'bg-slate-900/60 border-slate-700/50 text-indigo-300'">
                  {{ cmd.command }}
                </code>
                <span v-if="cmd.warning" class="text-[10px] text-amber-500 font-medium" title="Может нарушить работу сети">⚠️</span>
              </div>
              <p class="text-xs text-slate-400 leading-relaxed">{{ cmd.ru }}</p>
            </div>
            <span class="flex-shrink-0 mt-1 text-[10px] text-indigo-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Копировать</span>
          </div>
        </div>
        <div v-else class="px-4 py-3 text-xs text-slate-600">Нет совпадений</div>
      </div>

      <div v-if="!filteredGroups.length && search" class="text-center py-16">
        <p class="text-slate-600 text-base">Команд не найдено</p>
        <p class="text-slate-600 text-xs mt-1">Попробуйте другой запрос</p>
      </div>

      <!-- Workflows -->
      <div class="rounded-xl border border-slate-700/50 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-2.5 bg-slate-800/50 border-b border-slate-700/50">
          <div class="flex items-center space-x-2">
            <span class="text-sm">⚡</span>
            <h3 class="text-sm font-bold text-cyan-300">Сценарии</h3>
            <span class="text-[11px] text-slate-500">({{ workflows.length }})</span>
          </div>
        </div>
        <div class="divide-y divide-slate-700/30">
          <div v-for="wf in workflows" :key="wf.id"
            class="px-4 py-2.5 hover:bg-slate-700/20 transition-colors">
            <div class="flex items-center space-x-2 mb-1">
              <span class="text-base">{{ wf.icon }}</span>
              <span class="text-xs font-semibold text-slate-200">{{ wf.name }}</span>
              <span v-if="wf.warning" class="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">⚠️</span>
            </div>
            <p class="text-xs text-slate-400 ml-7">{{ wf.ru }}</p>
            <div class="ml-7 mt-1 flex flex-wrap gap-1">
              <span v-for="(step, si) in wf.steps" :key="si"
                class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-mono">
                {{ step.desc }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="copied"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl shadow-2xl border text-sm font-medium bg-emerald-700/90 border-emerald-600 text-emerald-100 backdrop-blur-sm whitespace-nowrap">
        ✓ Скопировано: <span class="font-mono">{{ copied }}</span>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { COMMAND_GROUPS, WORKFLOWS } from '../../services/commandRegistry'

const search = ref('')
const copied = ref(null)
let copyTimer = null

const workflows = WORKFLOWS

const groupIcons = {
  Scanning: '📡', Attacks: '⚡', Bluetooth: '🔵', Lists: '📋',
  Selection: '✅', SSID: '🏷', MAC: '🎭', Network: '🌐', Admin: '⚙'
}

const totalCommands = computed(() =>
  COMMAND_GROUPS.reduce((s, g) => s + g.commands.length, 0)
)

function filteredCommands(group) {
  if (!search.value) return group.commands
  const q = search.value.toLowerCase()
  return group.commands.filter(c =>
    c.command.toLowerCase().includes(q) ||
    c.ru.toLowerCase().includes(q) ||
    c.label.toLowerCase().includes(q)
  )
}

const filteredGroups = computed(() => {
  if (!search.value) return COMMAND_GROUPS
  return COMMAND_GROUPS.filter(g => filteredCommands(g).length > 0)
})

function copyCommand(text) {
  navigator.clipboard.writeText(text).then(() => {
    copied.value = text
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = null }, 2000)
  }).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copied.value = text
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = null }, 2000)
  })
}
</script>
