<template>
  <div class="flex flex-col gap-1">
    <div class="flex flex-wrap gap-1.5 items-start">
      <template v-for="group in COMMAND_GROUPS" :key="group.name">
        <div class="flex flex-wrap gap-x-0.5 gap-y-0.5 items-baseline px-2 py-1.5 rounded-lg bg-slate-800/20">
          <span class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mr-1 flex-shrink-0">{{ cmdLang === 'ru' ? group.nameRu : group.name }}</span>
          <button v-for="cmd in group.commands" :key="cmd.command" @click="send(cmd)"
            @mouseenter="showTip($event, cmd)" @mouseleave="hideTip"
            :disabled="!cmdState(cmd).canRun"
            :title="cmdState(cmd).tooltip"
            class="flex items-center space-x-0.5 px-1.5 py-0.5 text-xs font-medium rounded-md transition-all duration-150 whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            :class="btnClass(cmd)">
            <span>{{ cmd.icon }}</span>
            <span class="hidden sm:inline">{{ cmd.label }}</span>
            <span v-if="cmdState(cmd).badge" class="text-[9px] font-bold px-1 rounded"
              :class="cmdState(cmd).badgeClass">!</span>
          </button>
        </div>
      </template>

      <div class="flex items-center space-x-1 px-2 py-1.5">
        <label for="custom-command" class="sr-only">{{ $t('commandBuilder.customCommand') }}</label>
        <input v-model="custom" @keyup.enter="sendCustom" id="custom-command"
          class="w-20 lg:w-28 px-2 py-1 text-xs bg-slate-800 rounded-lg border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          :placeholder="$t('commandBuilder.placeholder')" :aria-label="$t('commandBuilder.customCommand')">
        <button @click="sendCustom" class="btn-primary btn-sm" :aria-label="$t('commandBuilder.send')">→</button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="tooltipCmd && tipPos"
        class="fixed z-[9999] w-80 p-3.5 rounded-xl shadow-2xl border pointer-events-none text-sm bg-slate-700 border-slate-600 text-slate-100"
        :style="{ left: tipPos.x + 'px', top: tipPos.y + 'px' }">
        <div class="font-semibold text-base mb-1.5 flex items-center space-x-2">
          <span>{{ tooltipCmd.icon }}</span>
          <span>{{ tooltipCmd.label }}</span>
          <span v-if="cmdState(tooltipCmd).severity" class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
            :class="severityBadgeClass(cmdState(tooltipCmd).severity)">
            {{ cmdState(tooltipCmd).severity }}
          </span>
        </div>
        <div class="text-xs leading-relaxed opacity-90">{{ cmdLang === 'ru' ? tooltipCmd.ru : (tooltipCmd.label || tooltipCmd.command) }}</div>
        <div class="mt-2 text-[11px] font-mono px-2 py-1 rounded inline-block opacity-60 bg-slate-800/50">{{ tooltipCmd.command }}</div>
        <div v-if="!cmdState(tooltipCmd).canRun" class="mt-2 text-[11px] px-2 py-1.5 rounded bg-red-500/20 text-red-200 border border-red-500/30">
          ⚠ {{ cmdState(tooltipCmd).tooltip }}
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="promptModal"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        @click.self="cancelPrompt"
        @keydown.escape="cancelPrompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-title"
        aria-describedby="prompt-description"
        tabindex="-1">
        <div class="bg-slate-800 rounded-xl border border-slate-700 p-5 max-w-sm w-full shadow-2xl">
          <h3 id="prompt-title" class="text-sm font-bold text-slate-100 mb-1 font-mono">{{ promptModal.command }}</h3>
          <p id="prompt-description" class="text-xs text-slate-400 mb-4">{{ $t('commandBuilder.fillParams') }}</p>
          <div v-if="promptModal.isPassword" class="text-[10px] mb-3 px-2 py-1.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
            ⚠ {{ $t('commandBuilder.passwordWarning') }}
          </div>
          <div class="space-y-3">
            <div v-for="(field, i) in promptModal.fields" :key="i">
              <label :for="`prompt-field-${i}`" class="text-xs text-slate-400 block mb-1">{{ field.label }}</label>
              <input :id="`prompt-field-${i}`" v-model="promptValues[i]" :placeholder="field.placeholder"
                :type="field.type || 'text'"
                class="input text-sm w-full font-mono" @keyup.enter="submitPrompt">
            </div>
          </div>
          <div class="flex gap-2 mt-5">
            <button @click="cancelPrompt" @keyup.escape="cancelPrompt" class="btn-ghost flex-1 text-sm" :aria-label="$t('commandBuilder.cancel')">{{ $t('commandBuilder.cancel') }}</button>
            <button @click="submitPrompt" class="btn-primary flex-1 text-sm" :aria-label="$t('commandBuilder.send')">{{ $t('commandBuilder.send') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <ConfirmDialog :show="confirmState.show"
      :title="confirmState.title"
      :body="confirmState.body"
      :cmd="confirmState.cmd"
      :target="confirmState.target"
      :icon="confirmState.icon"
      :severity="confirmState.severity"
      :confirm-label="confirmState.confirmLabel"
      @confirm="onDialogConfirmCustom"
      @cancel="onDialogCancelCustom" />
  </div>
</template>

<script setup>
import { ref, onUnmounted, watch } from 'vue'
import { useSerialStore } from '../stores/serialStore'
import { useDashboardStore } from '../stores/dashboardStore'
import { useApStore } from '../stores/apStore'
import { useBleStore } from '../stores/bleStore'
import { COMMAND_GROUPS } from '../services/commandRegistry'
import { getCommandMeta, SEVERITY_META, SEVERITY } from '../services/commandMeta'
import { runAction, getPrereqState, shouldConfirm } from '../utils/actionDispatcher'
import { sanitizeText } from '../utils/sanitize'
import { useCommandAction } from '../composables/useCommandAction'
import { isCommandAllowed } from '../services/commandExecutor'
import ConfirmDialog from './ConfirmDialog.vue'
import { t, locale } from '../services/i18n'
import { useToast } from '../utils/toast'
const { show: toastShow } = useToast()
const { confirmState, showConfirm, onDialogConfirm, onDialogCancel } = useCommandAction()

const serialStore = useSerialStore()
const cmdLang = locale
const dashStore = useDashboardStore()
const apStore = useApStore()
const bleStore = useBleStore()
const custom = ref('')

const tooltipCmd = ref(null)
const tipPos = ref(null)
let tipTimer = null

const promptModal = ref(null)
const promptValues = ref([])
let promptResolve = null

const PROMPT_RULES = [
  { re: /^select -a (\d+)$/, fields: [{ label: 'AP index (0-99)', placeholder: '0' }], build: (v) => 'select -a ' + v, isPassword: false },
  { re: /^select -a -f "contains (.+)"$/, fields: [{ label: 'Search text (partial SSID)', placeholder: 'Home' }], build: (v) => 'select -a -f "contains ' + v + '"' },
  { re: /^select -a -f "equals (.+)"$/, fields: [{ label: 'Exact SSID match', placeholder: 'MyWiFi' }], build: (v) => 'select -a -f "equals ' + v + '"' },
  { re: /^join -a (\d+) -p "(.+)"$/, fields: [{ label: 'AP index (0-99)', placeholder: '0' }, { label: 'WiFi password', placeholder: 'Enter password...', type: 'password' }], build: (v1, v2) => 'join -a ' + v1 + ' -p "' + v2 + '"', isPassword: true },
  { re: /^add -a -b ([0-9A-F:]+) -e "(.+)"$/i, fields: [{ label: 'BSSID (MAC)', placeholder: 'AA:BB:CC:DD:EE:FF' }, { label: 'SSID name', placeholder: 'Enter network name...' }], build: (m, s) => 'add -a -b ' + m + ' -e "' + s + '"' },
  { re: /^add -c -b ([0-9A-F:]+) -ap (\d+)$/i, fields: [{ label: 'BSSID (MAC)', placeholder: 'AA:BB:CC:DD:EE:FF' }, { label: 'AP index (0-99)', placeholder: '0' }], build: (m, i) => 'add -c -b ' + m + ' -ap ' + i },
  { re: /^ssid -a -n "(.+)"$/, fields: [{ label: 'New SSID name', placeholder: 'Enter network name...' }], build: (v) => 'ssid -a -n "' + v + '"' },
  { re: /^ssid -r (\d+)$/, fields: [{ label: 'SSID index (0-99)', placeholder: '0' }], build: (v) => 'ssid -r ' + v },
  { re: /^cloneapmac -a (\d+)$/, fields: [{ label: 'AP index (0-99)', placeholder: '0' }], build: (v) => 'cloneapmac -a ' + v },
  { re: /^clonestamac -s (\d+)$/, fields: [{ label: 'Station index (0-99)', placeholder: '0' }], build: (v) => 'clonestamac -s ' + v },
  { re: /^info -a (\d+)$/, fields: [{ label: 'AP index (0-99)', placeholder: '0' }], build: (v) => 'info -a ' + v },
  { re: /^led -s (#[0-9A-F]+)$/i, fields: [{ label: 'Hex color (e.g., #FF0000)', placeholder: '#FF0000' }], build: (v) => 'led -s ' + v },
  { re: /^brightness -s (\d+)$/, fields: [{ label: 'Brightness level (0-9)', placeholder: '5' }], build: (v) => 'brightness -s ' + v },
]

const cmdStateCache = new Map()
function cmdState(cmd) {
  const cacheKey = cmd.command
  if (cmdStateCache.has(cacheKey)) return cmdStateCache.get(cacheKey)
  const meta = getCommandMeta(cmd.command)
  const prereq = getPrereqState(cmd.command)
  const state = {
    canRun: prereq.ok && serialStore.isConnected,
    tooltip: !serialStore.isConnected
      ? t('commandBuilder.connectFirst')
      : !prereq.ok
        ? prereq.reason
        : prereq.hint || meta?.resultHint || t('commandBuilder.noOutput'),
    severity: meta?.severity || SEVERITY.INFO,
    badge: meta?.severity === SEVERITY.CRITICAL || meta?.destructive,
    badgeClass: meta?.destructive ? 'bg-red-500/30 text-red-200' : 'bg-orange-500/30 text-orange-200'
  }
  cmdStateCache.set(cacheKey, state)
  return state
}
watch(() => serialStore.isConnected, () => {
  cmdStateCache.clear()
})

const resolveCommand = (cmd) => {
  return new Promise((resolve) => {
    for (const rule of PROMPT_RULES) {
      const m = cmd.match(rule.re)
      if (m) {
        promptResolve = resolve
        promptModal.value = { command: cmd, fields: rule.fields, build: rule.build, isPassword: rule.isPassword }
        promptValues.value = rule.fields.map(() => '')
        return
      }
    }
    resolve(cmd)
  })
}

const submitPrompt = () => {
  const modal = promptModal.value
  if (!modal) return
  const vals = promptValues.value.map(v => sanitizeText(v, { maxLength: 128 }))
  const result = modal.build(...vals)
  promptModal.value = null
  promptValues.value = []
  if (promptResolve) {
    promptResolve(result)
    promptResolve = null
  }
}

const cancelPrompt = async () => {
  promptModal.value = null
  promptValues.value = []
  if (promptResolve) {
    promptResolve(null)
    promptResolve = null
    toastShow(t('commandBuilder.actionCancelled'), 'info', 2000)
  }
}

const executePayload = async (payload) => {
  try {
    const result = await runAction({
      cmd: payload.cmd,
      label: payload.label,
      icon: payload.icon,
      target: payload.target,
      options: { confirm: false }
    })
    if (result?.needsConfirm) {
      showConfirm(result)
      return
    }
    dashStore.incrementCommands()
  } catch (e) {
    const hint = e.hint ? ' — ' + (typeof e.hint === 'string' && t(e.hint) !== e.hint ? t(e.hint) : e.hint) : ''
    if (e.code === 'PREREQ_FAILED') {
      toastShow(t('common.failed', { msg: e.message }) + hint, 'error')
    } else {
      toastShow(t('common.failed', { msg: e.message }), 'error')
    }
  }
}

const send = async (cmdObj) => {
  if (!serialStore.isConnected) {
    toastShow(t('commandBuilder.connectFirst'), 'warning')
    return
  }
  const resolved = await resolveCommand(cmdObj.command)
  if (resolved === null) return
  const meta = getCommandMeta(resolved)
  const prereq = getPrereqState(resolved)
  if (!prereq.ok) {
    const hint = prereq.hint ? ' — ' + prereq.hint : ''
    toastShow(prereq.reason + hint, 'error')
    return
  }
  const payload = { cmd: resolved, label: cmdObj.label, icon: cmdObj.icon, target: '' }
  if (shouldConfirm(resolved)) {
      showConfirm(payload)
    return
  }
  await executePayload(payload)
}

const onDialogConfirmCustom = async () => {
  const payload = confirmState.pendingPayload
  confirmState.show = false
  confirmState.pendingPayload = null
  if (payload) await executePayload(payload)
}

const onDialogCancelCustom = () => {
  confirmState.show = false
  confirmState.pendingPayload = null
}

const sendCustom = () => {
  if (!custom.value.trim()) return
  const cmd = custom.value.trim()
  if (!serialStore.isConnected) {
    toastShow(t('commandBuilder.connectFirst'), 'warning')
    custom.value = ''
    return
  }
  if (!isCommandAllowed(cmd)) {
    toastShow(`Command blocked: "${cmd}" is not in the allowlist`, 'error')
    custom.value = ''
    return
  }
  send({ command: cmd, label: cmd, icon: '⌨' })
  custom.value = ''
}

const btnClass = (cmd) => {
  const state = cmdState(cmd)
  const meta = getCommandMeta(cmd.command)
  if (state.severity === SEVERITY.CRITICAL || meta?.destructive) {
    return 'bg-red-500/15 text-red-300 hover:bg-red-500/25'
  }
  if (cmd.warning || state.severity === SEVERITY.HIGH) {
    return 'bg-orange-500/15 text-orange-300 hover:bg-orange-500/25'
  }
  if (state.severity === SEVERITY.MEDIUM) {
    return 'bg-yellow-500/15 text-yellow-300 hover:bg-yellow-500/25'
  }
  if (state.severity === SEVERITY.LOW) {
    return 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25'
  }
  return 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25'
}

const severityBadgeClass = (sev) => {
  const meta = SEVERITY_META[sev]
  switch (sev) {
    case SEVERITY.CRITICAL: return 'bg-red-500/30 text-red-200'
    case SEVERITY.HIGH:     return 'bg-orange-500/30 text-orange-200'
    case SEVERITY.MEDIUM:   return 'bg-yellow-500/30 text-yellow-200'
    case SEVERITY.LOW:      return 'bg-blue-500/30 text-blue-200'
    default:                return 'bg-slate-500/30 text-slate-300'
  }
}

const showTip = (e, cmd) => {
  if (tipTimer) clearTimeout(tipTimer)
  tipTimer = setTimeout(() => {
    tooltipCmd.value = cmd
    const pad = 14
    const tw = 320
    const th = 150
    let x = e.clientX + pad
    let y = e.clientY - th - pad
    if (y < pad) y = e.clientY + pad
    if (x + tw > window.innerWidth - pad) x = window.innerWidth - tw - pad
    if (y + th > window.innerHeight - pad) y = window.innerHeight - th - pad
    tipPos.value = { x, y }
  }, 150)
}

const hideTip = () => {
  if (tipTimer) clearTimeout(tipTimer)
  tooltipCmd.value = null
  tipPos.value = null
}

onUnmounted(() => {
  if (tipTimer) clearTimeout(tipTimer)
  tooltipCmd.value = null
  tipPos.value = null
})
</script>
