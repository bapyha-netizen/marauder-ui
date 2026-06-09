<template>
  <div class="h-full flex flex-col">
    <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">{{ $t('workflows.title') }}</h2>

    <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div v-for="wf in workflows" :key="wf.id"
          class="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 cursor-pointer hover:bg-slate-700/50 hover:border-slate-600/50 transition-all"
          @click="openWorkflow(wf)">
          <div class="flex items-start space-x-3">
            <span class="text-xl mt-0.5">{{ wf.icon || '📋' }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-2">
                <h3 class="text-sm font-semibold text-slate-200">{{ wf.name }}</h3>
                <span v-if="wf.warning" class="badge-amber text-[9px]">⚠ attack</span>
              </div>
              <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{{ cmdLang === 'ru' ? wf.ru : wf.description }}</p>
              <div class="mt-2 flex flex-wrap gap-1">
                <span v-for="(step, i) in wf.steps" :key="i" class="tag text-[9px]">
                  {{ step.command.split(' ')[0] }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="selectedWorkflow" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
        @click.self="aborted && closeWorkflow()">
        <div class="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex justify-between items-center mb-4">
            <div class="flex items-center space-x-3">
              <span class="text-2xl">{{ selectedWorkflow.icon || '📋' }}</span>
              <div>
                <h2 class="text-lg font-bold text-slate-100">{{ selectedWorkflow.name }}</h2>
                <p class="text-xs text-slate-400 mt-0.5">{{ cmdLang === 'ru' ? selectedWorkflow.ru : selectedWorkflow.description }}</p>
              </div>
            </div>
            <button @click="closeWorkflow" class="btn-ghost btn-icon text-lg hover:bg-slate-700/50 rounded-lg p-1.5">✕</button>
          </div>

          <!-- Steps + Log -->
          <div class="flex-1 overflow-y-auto min-h-0 space-y-3 mb-5 scrollbar-thin pr-1">
            <!-- Step indicators -->
            <div v-for="(step, i) in selectedWorkflow.steps" :key="i"
              class="flex items-start space-x-3 p-3 rounded-xl border transition-colors"
              :class="stepStatusClass(i)">
              <div class="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                :class="stepStatusDotClass(i)">
                {{ stepStatusIcon(i) }}
              </div>
              <div class="flex-1 space-y-1.5">
                <p class="text-xs font-medium" :class="stepStatusTextClass(i)">{{ step.desc || step.command }}</p>
                <div class="text-[11px] font-mono text-slate-500 bg-slate-800/50 px-2 py-1 rounded">{{ step.command }}</div>
                <div v-if="step.requiresInput && !isRunning" class="space-y-1">
                  <label class="text-[11px] text-slate-400">{{ step.label }}</label>
                  <input v-model="stepInputs[i]" :placeholder="step.placeholder" class="input text-xs">
                </div>
                <div v-if="stepOutputs[i]" class="text-[11px] text-slate-400 bg-slate-900/50 px-2 py-1 rounded border-l-2 border-indigo-500/50 mt-1">
                  {{ stepOutputs[i] }}
                </div>
              </div>
            </div>

            <!-- Progress bar -->
            <div v-if="isRunning" class="bg-slate-900/50 rounded-xl border border-slate-700/50 p-3">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[11px] font-medium text-slate-400">{{ $t('workflows.step') }} {{ currentStep + 1 }} {{ $t('workflows.of') }} {{ selectedWorkflow.steps.length }}</span>
                <span class="text-[11px] font-mono text-slate-500">{{ duration }}</span>
              </div>
              <div class="w-full bg-slate-800 rounded-full h-1.5">
                <div class="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                  :style="{ width: ((currentStep + 1) / selectedWorkflow.steps.length * 100) + '%' }"></div>
              </div>
            </div>

            <!-- Execution log -->
            <div v-if="execLog.length" class="bg-slate-900/50 rounded-xl border border-slate-700/50 p-3">
              <h4 class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{{ $t('workflows.executionLog') }}</h4>
              <div class="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                <div v-for="(entry, i) in execLog" :key="i" class="flex items-start space-x-2 text-[11px] font-mono">
                  <span class="text-slate-600 flex-shrink-0 w-14">{{ entry.time }}</span>
                  <span :class="entry.color" class="flex-shrink-0 w-4">{{ entry.icon }}</span>
                  <span class="text-slate-400">{{ entry.msg }}</span>
                </div>
              </div>
            </div>

            <!-- Summary -->
            <div v-if="completed" class="bg-emerald-500/10 border border-emerald-700/30 rounded-xl p-4">
              <div class="flex items-center space-x-2 mb-3">
                <span class="text-emerald-400 text-lg">✓</span>
                <span class="text-sm font-semibold text-emerald-300">{{ $t('workflows.completed') }} — {{ duration }}</span>
              </div>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div @click="goToTab('ap')" class="bg-slate-900/50 rounded-lg p-2 cursor-pointer hover:bg-slate-800/50 transition-colors">
                  <div class="text-lg font-bold text-indigo-400">{{ results.aps }}</div>
                  <div class="text-[10px] text-slate-500">{{ $t('workflows.apsFound') }}</div>
                </div>
                <div @click="goToTab('ap')" class="bg-slate-900/50 rounded-lg p-2 cursor-pointer hover:bg-slate-800/50 transition-colors">
                  <div class="text-lg font-bold text-cyan-400">{{ results.stations }}</div>
                  <div class="text-[10px] text-slate-500">{{ $t('workflows.stations') }}</div>
                </div>
                <div @click="goToTab('ble')" class="bg-slate-900/50 rounded-lg p-2 cursor-pointer hover:bg-slate-800/50 transition-colors">
                  <div class="text-lg font-bold text-emerald-400">{{ results.ble }}</div>
                  <div class="text-[10px] text-slate-500">{{ $t('workflows.bleDevices') }}</div>
                </div>
              </div>
              <div v-if="results.packets" class="mt-2 bg-slate-900/50 rounded-lg p-2 text-center">
                <span class="text-xs font-bold text-amber-400">{{ results.packets }}</span>
                <span class="text-[10px] text-slate-500 ml-1">{{ $t('workflows.packetsCaptured') }}</span>
              </div>
              <div class="mt-2 text-center">
                <button @click="goToTab('dashboard')" class="btn-ghost btn-sm text-[10px]">{{ $t('workflows.viewInDashboard') }}</button>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between pt-4 border-t border-slate-700/50">
            <div v-if="selectedWorkflow.warning" class="text-[11px] text-amber-400 font-medium">
              {{ $t('workflows.onlyAuthorized') }}
            </div>
            <div class="flex space-x-3 ml-auto">
              <button @click="closeWorkflow" class="btn-ghost">{{ completed || aborted ? $t('workflows.close') : $t('workflows.stop') }}</button>
              <button v-if="!isRunning && !completed" @click="executeWorkflow" class="btn-primary">{{ $t('workflows.execute') }}</button>
              <button v-if="completed" @click="closeWorkflow" class="btn-primary">{{ $t('workflows.done') }}</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useSerialStore } from '../../stores/serialStore'
import { useApStore } from '../../stores/apStore'
import { useBleStore } from '../../stores/bleStore'
import { useDashboardStore } from '../../stores/dashboardStore'
import { WORKFLOWS } from '../../services/commandRegistry'
import { runAction } from '../../utils/actionDispatcher'
import { t, locale } from '../../services/i18n'

const emit = defineEmits(['navigate'])
const cmdLang = locale

const serialStore = useSerialStore()
const apStore = useApStore()
const bleStore = useBleStore()
const dashStore = useDashboardStore()
const workflows = WORKFLOWS
const selectedWorkflow = ref(null)
const stepInputs = ref({})
const stepOutputs = ref({})
const isRunning = ref(false)
const completed = ref(false)
const aborted = ref(false)
const currentStep = ref(-1)
const execLog = ref([])
const startTime = ref(null)
const beforeSnapshot = ref(null)
const cachedResults = ref(null)
const durationTick = ref(0)
let _durationInterval = null
let _abortController = null
let _onSerialAbort = null

onBeforeUnmount(() => {
  if (_abortController) { _abortController.abort(); _abortController = null }
  if (_durationInterval) { clearInterval(_durationInterval); _durationInterval = null }
  isRunning.value = false
  aborted.value = true
  selectedWorkflow.value = null
})

const addLog = (msg, icon = '•', color = 'text-slate-400') => {
  const t = new Date()
  execLog.value.push({
    time: `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}:${t.getSeconds().toString().padStart(2, '0')}`,
    msg, icon, color
  })
  if (execLog.value.length > 500) execLog.value.shift()
}

const duration = computed(() => {
  void durationTick.value
  if (!startTime.value) return ''
  const diff = Date.now() - startTime.value
  const m = Math.floor(diff / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
})

const stepStatusClass = (i) => {
  if (completed.value) return 'bg-emerald-500/10 border-emerald-700/30'
  if (i < currentStep.value) return 'bg-emerald-500/10 border-emerald-700/30'
  if (i === currentStep.value && isRunning.value) return 'bg-indigo-500/10 border-indigo-700/30'
  if (i === currentStep.value && aborted.value) return 'bg-red-500/10 border-red-700/30'
  return 'bg-slate-700/30 border-slate-700/50'
}

const stepStatusDotClass = (i) => {
  if (completed.value) return 'bg-emerald-500/20 text-emerald-300'
  if (i < currentStep.value) return 'bg-emerald-500/20 text-emerald-300'
  if (i === currentStep.value && isRunning.value) return 'bg-indigo-500/20 text-indigo-300'
  if (i === currentStep.value && aborted.value) return 'bg-red-500/20 text-red-300'
  return 'bg-slate-700/50 text-slate-400'
}

const stepStatusIcon = (i) => {
  if (completed.value) return '✓'
  if (i < currentStep.value) return '✓'
  if (i === currentStep.value && isRunning.value) return '◉'
  if (i === currentStep.value && aborted.value) return '✕'
  return i + 1
}

const stepStatusTextClass = (i) => {
  if (completed.value) return 'text-emerald-300'
  if (i < currentStep.value) return 'text-emerald-300'
  if (i === currentStep.value && isRunning.value) return 'text-indigo-300'
  if (i === currentStep.value && aborted.value) return 'text-red-300'
  return 'text-slate-300'
}

const computeResults = () => ({
  aps: apStore.apCount - beforeSnapshot.value.aps,
  stations: apStore.totalStations - beforeSnapshot.value.stations,
  ble: bleStore.deviceCount - beforeSnapshot.value.ble,
  packets: dashStore.packetsCaptured - beforeSnapshot.value.packets
})

const results = computed(() => {
  if (cachedResults.value) return cachedResults.value
  if (!beforeSnapshot.value || !completed.value) return { aps: 0, stations: 0, ble: 0, packets: 0 }
  return computeResults()
})

const openWorkflow = (wf) => {
  selectedWorkflow.value = wf
  stepInputs.value = {}
  stepOutputs.value = {}
  isRunning.value = false
  completed.value = false
  aborted.value = false
  currentStep.value = -1
  execLog.value = []
  startTime.value = null
  beforeSnapshot.value = null
  cachedResults.value = null
}

const closeWorkflow = () => {
  aborted.value = true
  _abortController?.abort()
  isRunning.value = false
  selectedWorkflow.value = null
  cachedResults.value = null
  if (_durationInterval) { clearInterval(_durationInterval); _durationInterval = null }
  try { if (_onSerialAbort) serialStore.getWorkflowSignal().removeEventListener('abort', _onSerialAbort) } catch (_) {}
  if (serialStore.isConnected) {
    runAction({ cmd: 'stopscan', label: 'Stop (workflow)', icon: '⏹' }).catch(() => {})
  }
}

const waitForInput = (stepIndex) => {
  return new Promise((resolve) => {
    const unwatch = watch(
      () => stepInputs.value[stepIndex],
      (value) => {
        if (value || aborted.value) {
          unwatch()
          resolve(value || '')
        }
      },
      { immediate: true }
    )
  })
}

const goToTab = (tab) => {
  closeWorkflow()
  emit('navigate', tab)
}

const executeWorkflow = async () => {
  const wf = selectedWorkflow.value
  if (!wf) return
  _abortController = new AbortController()
  const serialSignal = serialStore.getWorkflowSignal()
  _onSerialAbort = () => _abortController?.abort()
  if (!serialSignal.aborted) {
    serialSignal.addEventListener('abort', _onSerialAbort, { once: true })
  }
  const signal = _abortController.signal
  isRunning.value = true
  completed.value = false
  aborted.value = false
  currentStep.value = 0
  startTime.value = Date.now()
  durationTick.value = 0
  _durationInterval = setInterval(() => { durationTick.value++ }, 1000)
  execLog.value = []
  addLog(t('workflows.starting', { name: wf.name, n: wf.steps.length }), '▶', 'text-cyan-400')

  beforeSnapshot.value = {
    aps: apStore.apCount,
    stations: apStore.totalStations,
    ble: bleStore.deviceCount,
    packets: dashStore.packetsCaptured
  }

  let hasStopManual = false

  try {
    for (let i = 0; i < wf.steps.length; i++) {
      if (aborted.value) {
        addLog(t('workflows.aborted', { n: i + 1 }), '✕', 'text-red-400')
        break
      }
      currentStep.value = i
      const step = wf.steps[i]
      let cmd = step.command
      addLog(t('workflows.step') + ' ' + (i + 1) + ': ' + step.desc, '→', 'text-indigo-400')

      if (step.stopManual) hasStopManual = true

      if (step.forEachAP) {
        const aps = apStore.sortedAPs
        const seen = new Set()
        const indices = []
        for (const ap of aps) {
          const idx = ap.index
          if (idx !== undefined && idx !== null && !seen.has(idx)) {
            seen.add(idx)
            indices.push(idx)
          }
        }
        indices.sort((a, b) => a - b)
        if (!indices.length) {
          addLog(t('workflows.noAps'), '◷', 'text-amber-400')
          continue
        }
        const total = indices.length
        const limit = 50
        const limited = total > limit
        addLog(limited
          ? `${t('workflows.runningFor', { n: limit })} (${total} available, first ${limit})`
          : t('workflows.runningFor', { n: total }), '→', 'text-indigo-400')
        for (let j = 0; j < Math.min(total, limit); j++) {
          if (aborted.value) break
          const idx = indices[j]
          const subCmd = cmd.replaceAll('{idx}', idx)
          try {
            await runAction({ cmd: subCmd, label: subCmd, icon: '⚡', options: { signal } })
            dashStore.incrementCommands()
            addLog(`[${j + 1}/${Math.min(total, limit)}] idx ${idx}: ${subCmd}`, '⚡', 'text-yellow-400')
          } catch (e) {
            addLog(t('workflows.failed', { n: i + 1, msg: e.message }), '✕', 'text-red-400')
            aborted.value = true
            break
          }
        }
        if (limited && !aborted.value) {
          addLog(`Showing first ${limit} of ${total} APs`, '⚠', 'text-amber-400')
        }
        if (!aborted.value) {
          addLog(t('workflows.stepDone'), '✓', 'text-emerald-400')
        }
        continue
      }

      if (step.requiresInput) {
        const input = stepInputs.value[i]
        if (!input) {
          addLog(t('workflows.waitingInput', { label: step.label }), '◷', 'text-amber-400')
          const waited = await waitForInput(i)
          if (aborted.value) break
          stepInputs.value[i] = waited
        }
        const rawInput = stepInputs.value[i] || ''

        if (!cmd.includes('{input}')) {
          addLog(t('workflows.warningNoSubst'), '⚠', 'text-amber-400')
        }

        if (step.splitInput) {
          const items = rawInput
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .filter(s => /^\d+$/.test(s))

          if (items.length === 0) {
            addLog(t('workflows.invalidInput'), '⚠', 'text-amber-400')
            continue
          }

          addLog(t('workflows.inputReceived', { input: items.length + ' ' + t('workflows.step').toLowerCase() + '(s)' }), '✓', 'text-emerald-400')
          for (const item of items) {
            if (aborted.value) break
            const subCmd = cmd.replaceAll('{input}', item)
            try {
              await runAction({ cmd: subCmd, label: subCmd, icon: '⚡', options: { signal } })
              dashStore.incrementCommands()
              addLog(t('workflows.sent', { cmd: subCmd }), '⚡', 'text-yellow-400')
            } catch (e) {
              addLog(t('workflows.failed', { n: i + 1, msg: e.message }), '✕', 'text-red-400')
              aborted.value = true
              break
            }
          }
          if (step.delay && !aborted.value) {
            addLog(t('workflows.waiting', { n: step.delay / 1000 }), '◷', 'text-slate-400')
            await new Promise(r => setTimeout(r, step.delay))
          }
          continue
        }

        const sanitizedInput = rawInput.replace(/[;&|`$]/g, '')
        cmd = cmd.replaceAll('{input}', sanitizedInput)
          addLog(t('workflows.inputReceived', { input: sanitizedInput }), '✓', 'text-emerald-400')
      }

      try {
        await runAction({ cmd, label: step.desc || cmd, icon: '⚡', options: { signal } })
        dashStore.incrementCommands()
        addLog(t('workflows.sent', { cmd }), '⚡', 'text-yellow-400')
        if (step.delay && !step.stopManual) {
          addLog(t('workflows.waiting', { n: step.delay / 1000 }), '◷', 'text-slate-400')
          await new Promise(r => setTimeout(r, step.delay))
        }
        addLog(t('workflows.stepDone'), '✓', 'text-emerald-400')
      } catch (e) {
        addLog(t('workflows.failed', { n: i + 1, msg: e.message }), '✕', 'text-red-400')
        aborted.value = true
        break
      }
    }
  } catch (e) {
    addLog(t('workflows.crashed', { msg: e.message }), '✕', 'text-red-400')
  }

  if (!hasStopManual) {
    try {
      await runAction({ cmd: 'stopscan', label: 'Cleanup stop', icon: '⏹', options: { signal } })
      addLog(t('workflows.sent', { cmd: 'stopscan (cleanup)' }), '⏹', 'text-slate-400')
    } catch (_) { }
  } else {
    addLog(t('workflows.attackRunning'), '⏹', 'text-amber-400')
  }

  if (_durationInterval) { clearInterval(_durationInterval); _durationInterval = null }

  if (!aborted.value) {
    completed.value = true
    cachedResults.value = computeResults()
    addLog(t('workflows.completedSteps', { n: wf.steps.length, duration: duration.value }), '✓', 'text-emerald-400')
  } else {
    addLog(t('workflows.stopped'), '✕', 'text-red-400')
  }
  isRunning.value = false
  currentStep.value = -1
}
</script>
