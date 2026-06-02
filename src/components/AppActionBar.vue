<template>
  <div v-if="hasAny" class="flex items-center space-x-1.5 text-[10px]">
    <div v-if="currentAction" class="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-200"
      :title="currentAction.cmd">
      <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
      <span class="font-mono">{{ currentAction.label }}</span>
    </div>
    <div v-if="selectedCount > 0" class="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/40 text-indigo-200"
      :title="`${selectedCount} APs selected`">
      <span>🎯</span>
      <span class="font-semibold">{{ selectedCount }}</span>
    </div>
    <div v-if="lastAction" :class="lastBgClass" class="flex items-center space-x-1 px-2 py-0.5 rounded-full border"
      :title="lastAction.cmd + (lastAction.result ? '\n' + lastAction.result : '')">
      <span>{{ lastIcon }}</span>
      <span class="font-mono">{{ lastAction.label }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useApStore } from '../stores/apStore'
import { actions, runningAction } from '../utils/actionDispatcher'

const apStore = useApStore()

const currentAction = computed(() => runningAction.value)

const selectedCount = computed(() => {
  let n = 0
  for (const ap of apStore.accessPoints.values()) {
    if (ap.isSelected) n++
  }
  return n
})

const lastAction = computed(() => {
  const finished = actions.value.filter(a => a.status !== 'running')
  return finished[0] || null
})

const hasAny = computed(() => currentAction.value || selectedCount.value > 0 || lastAction.value)

const lastIcon = computed(() => {
  if (!lastAction.value) return ''
  return lastAction.value.status === 'ok' ? '✓' : lastAction.value.status === 'error' ? '✕' : '·'
})

const lastBgClass = computed(() => {
  if (!lastAction.value) return ''
  switch (lastAction.value.status) {
    case 'ok':    return 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
    case 'error': return 'bg-red-500/10 border-red-500/40 text-red-300'
    default:      return 'bg-slate-700/30 border-slate-600/40 text-slate-400'
  }
})
</script>
