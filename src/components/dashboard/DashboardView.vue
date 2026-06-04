<template>
  <div class="h-full flex gap-3">
    <!-- LEFT: Live Output (1/4) -->
    <div class="w-1/4 flex flex-col min-h-0 min-w-0">
      <div class="bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col h-full">
        <div class="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 flex-shrink-0">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">{{ $t('dashboard.liveOutput') }}</h3>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-[11px] text-slate-500">{{ serialStore.terminalOutput.length }} {{ $t('dashboard.lines') }}</span>
            <button @click="paused = !paused"
              :class="paused ? 'bg-amber-600/50 text-amber-200' : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'"
              class="px-1.5 py-0.5 text-[10px] rounded-md transition-colors"
              :title="paused ? $t('dashboard.resume') : $t('dashboard.pause')"
              :aria-label="paused ? $t('dashboard.resume') : $t('dashboard.pause')">
              {{ paused ? $t('dashboard.resume') : $t('dashboard.pause') }}
            </button>
            <button @click="autoScroll = !autoScroll"
              :class="!autoScroll ? 'bg-amber-600/50 text-amber-200' : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'"
              class="px-1.5 py-0.5 text-[10px] rounded-md transition-colors"
              :title="autoScroll ? $t('dashboard.manual') : $t('dashboard.auto')"
              :aria-label="autoScroll ? $t('dashboard.manual') : $t('dashboard.auto')">
              {{ autoScroll ? $t('dashboard.auto') : $t('dashboard.manual') }}
            </button>
            <button @click="copyTerminal" v-if="serialStore.terminalOutput.length"
              class="px-1.5 py-0.5 text-[10px] rounded-md bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-slate-200 transition-colors"
              :aria-label="$t('dashboard.copy')">{{ $t('dashboard.copy') }}</button>
            <button @click="serialStore.clearOutput()"
              class="px-1.5 py-0.5 text-[10px] rounded-md bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-slate-200 transition-colors"
              :aria-label="$t('dashboard.clear')">{{ $t('dashboard.clear') }}</button>
          </div>
        </div>
        <div ref="liveRef" @scroll="onTerminalScroll"
          class="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed scrollbar-thin bg-black/30"
          role="log" aria-live="polite" aria-label="Live serial output">
          <div :style="{ height: spacerTop + 'px' }"></div>
          <div v-for="(line, i) in visibleTerminalLines" :key="visibleStart + i"
            class="hover:bg-white/5 rounded px-1 -mx-1"
            :class="line.cls"
            v-html="line.text"></div>
          <div :style="{ height: spacerBottom + 'px' }"></div>
          <div v-if="!serialStore.terminalOutput.length" class="text-slate-600 text-center py-8">
            <div class="text-2xl mb-2">⚡</div>
            <div class="mb-2">{{ $t('dashboard.waitingForData') }}</div>
            <div class="text-xs text-slate-500">
              {{ serialStore.isConnected ? $t('dashboard.deviceConnected') : $t('dashboard.connectDevice') }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- CENTER: Targets list (1/4) -->
    <div class="w-1/4 flex flex-col min-h-0 min-w-0">
      <div class="bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col h-full">
        <div class="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 flex-shrink-0">
          <div class="flex items-center space-x-1">
            <button v-for="t in targetTabs" :key="t.id" @click="activeTab = t.id"
              :class="activeTab === t.id ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50' : 'bg-slate-700/30 text-slate-400 border-transparent hover:text-slate-200'"
              class="px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors flex items-center space-x-1">
              <span>{{ t.icon }}</span>
              <span>{{ t.label }}</span>
              <span v-if="t.count" class="text-[9px] px-1 rounded bg-white/10 font-semibold">{{ t.count }}</span>
            </button>
          </div>
          <button @click="runScanForTab" class="px-2 py-1 text-[10px] font-medium rounded-md bg-emerald-600/30 text-emerald-200 hover:bg-emerald-600/50 border border-emerald-500/50 transition-colors"
            :title="$t('dashboard.scan') + ' ' + activeTabLabel">
            {{ $t('dashboard.scan') }}
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-2 scrollbar-thin">
          <!-- AP list -->
          <template v-if="activeTab === 'ap'">
            <div v-if="!apStore.sortedAPs.length" class="text-center py-12 text-xs text-slate-600">
              <div class="text-2xl mb-2">📡</div>
              <div>{{ $t('dashboard.noAps') }}</div>
              <button @click="serialStore.scanAll()" class="mt-2 text-indigo-400 hover:text-indigo-300">{{ $t('dashboard.apActions.listAps') }}</button>
            </div>
            <button v-for="ap in apStore.sortedAPs" :key="ap.bssid" @click="selectAP(ap)"
              :class="selectedAP?.bssid === ap.bssid ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-slate-700/20 border-transparent hover:bg-slate-700/40'"
              class="w-full text-left p-2 mb-1 rounded-lg border transition-colors flex items-center space-x-2">
              <div class="w-2 h-2 rounded-full flex-shrink-0" :class="dotClass(ap.rssi)"></div>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-medium text-slate-100 truncate flex items-center space-x-1.5">
                  <span class="truncate">{{ ap.essid || '(hidden)' }}</span>
                  <span v-if="ap.isSelected" class="badge-green flex-shrink-0">sel</span>
                </div>
                <div class="text-[10px] text-slate-500 font-mono truncate">{{ ap.bssid }} · CH{{ ap.channel }}</div>
              </div>
              <div class="text-[11px] font-mono font-semibold flex-shrink-0" :class="signalClass(ap.rssi)">
                {{ ap.rssi ?? 'N/A' }}
              </div>
            </button>
          </template>
          <!-- BLE list -->
          <template v-else-if="activeTab === 'ble'">
            <div v-if="!bleStore.sortedDevices.length" class="text-center py-12 text-xs text-slate-600">
              <div class="text-2xl mb-2">🔵</div>
              <div>{{ $t('dashboard.noBle') }}</div>
              <button @click="serialStore.sendCommand('sniffbt')" class="mt-2 text-indigo-400 hover:text-indigo-300">{{ $t('dashboard.bleActions.sniffBle') }}</button>
            </div>
            <button v-for="dev in bleStore.sortedDevices" :key="dev.mac" @click="selectBLE(dev)"
              :class="selectedBLE?.mac === dev.mac ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-slate-700/20 border-transparent hover:bg-slate-700/40'"
              class="w-full text-left p-2 mb-1 rounded-lg border transition-colors flex items-center space-x-2">
              <div class="w-2 h-2 rounded-full flex-shrink-0" :class="dotClass(dev.rssi)"></div>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-medium text-slate-100 truncate flex items-center space-x-1.5">
                  <span class="truncate">{{ dev.name || 'Unknown' }}</span>
                  <span v-if="dev.isAirtag" class="text-[9px] px-1 rounded bg-pink-500/20 text-pink-300 flex-shrink-0">airtag</span>
                </div>
                <div class="text-[10px] text-slate-500 font-mono truncate">{{ dev.mac }}</div>
              </div>
              <div class="text-[11px] font-mono font-semibold flex-shrink-0" :class="signalClass(dev.rssi)">
                {{ dev.rssi ?? 'N/A' }}
              </div>
            </button>
          </template>
          <!-- Probes list -->
          <template v-else-if="activeTab === 'probes'">
            <div v-if="!probeStore.probes.length" class="text-center py-12 text-xs text-slate-600">
              <div class="text-2xl mb-2">📱</div>
              <div>{{ $t('dashboard.noProbes') }}</div>
              <button @click="serialStore.sendCommand('sniffprobe')" class="mt-2 text-indigo-400 hover:text-indigo-300">{{ $t('dashboard.probeActions.sniffProbe') }}</button>
            </div>
            <div v-for="(p, i) in probeStore.probes" :key="i"
              class="p-2 mb-1 rounded-lg bg-slate-700/20 hover:bg-slate-700/40 transition-colors">
              <div class="flex items-center space-x-2">
                <div class="w-2 h-2 rounded-full flex-shrink-0" :class="dotClass(p.rssi)"></div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-medium text-slate-100 truncate">{{ p.ssid || '(no SSID)' }}</div>
                  <div class="text-[10px] text-slate-500 font-mono truncate">{{ p.clientMac }} · CH{{ p.ch }}</div>
                </div>
                <div class="text-[11px] font-mono font-semibold flex-shrink-0" :class="signalClass(p.rssi)">
                  {{ p.rssi ?? 'N/A' }}
                </div>
              </div>
            </div>
          </template>
          <!-- Stations list (from selected AP) -->
          <template v-else-if="activeTab === 'stations'">
            <div v-if="!selectedAP" class="text-center py-12 text-xs text-slate-600">
              <div class="text-2xl mb-2">📱</div>
              <div>{{ $t('dashboard.selectTargetFirst') }}</div>
            </div>
            <div v-else-if="!selectedAP.stations?.length" class="text-center py-12 text-xs text-slate-600">
              <div class="text-2xl mb-2">📭</div>
              <div>{{ $t('dashboard.noStationsOn') }} {{ selectedAP.essid }}</div>
              <button @click="serialStore.sendCommand('sniffbeacon')" class="mt-2 text-indigo-400 hover:text-indigo-300">Run sniffbeacon</button>
            </div>
            <div v-for="sta in (selectedAP?.stations || [])" :key="sta.mac"
              class="p-2 mb-1 rounded-lg bg-slate-700/20 hover:bg-slate-700/40 transition-colors flex items-center space-x-2">
              <div class="w-2 h-2 rounded-full flex-shrink-0 bg-cyan-400"></div>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-mono text-slate-100 truncate">{{ sta.mac }}</div>
                <div v-if="sta.vendor" class="text-[10px] text-slate-500">{{ sta.vendor }}</div>
              </div>
              <div class="text-[10px] text-slate-500">{{ fmtTimeRelative(sta.lastSeen) }}</div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- RIGHT: Action panel (1/2) -->
    <div class="w-1/2 flex flex-col min-h-0 min-w-0 gap-3">
      <!-- Top: Selected target details + actions -->
      <div class="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3 flex-shrink-0">
        <div v-if="!selectedTarget && availableActions.length" class="mt-1">
          <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{{ $t('dashboard.adminActions') }}</div>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="action in availableActions" :key="action.key" @click="runActionLocal(action)"
              :disabled="!actionState(action).canRun || !!actionRunning"
              :class="actionBtnClass(action)"
              :title="actionState(action).tooltip"
              class="px-2.5 py-1.5 text-[11px] font-medium rounded-md border transition-colors flex items-center space-x-1 disabled:opacity-40 disabled:cursor-not-allowed">
              <span v-if="actionRunning && actionRunning.id === action.id" class="animate-spin">⏳</span>
              <span v-else>{{ action.icon }}</span>
              <span>{{ action.label }}</span>
            </button>
          </div>
        </div>
        <template v-else>
          <div class="flex items-start justify-between mb-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-2 mb-1">
                <span class="text-base">{{ selectedTarget.icon }}</span>
                <h3 class="text-sm font-semibold text-slate-100 truncate">{{ selectedTarget.name }}</h3>
                <span v-if="selectedTarget.subtitle" class="text-[11px] text-slate-500 font-mono truncate">{{ selectedTarget.subtitle }}</span>
              </div>
              <div class="flex flex-wrap items-center gap-2 text-[10px]">
                <span v-if="selectedTarget.ch" class="px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">CH {{ selectedTarget.ch }}</span>
                <span v-if="selectedTarget.rssi != null" class="px-1.5 py-0.5 rounded font-mono font-semibold" :class="signalClass(selectedTarget.rssi)">
                  {{ selectedTarget.rssi }} dBm
                </span>
                <span v-if="selectedTarget.enc" class="px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">{{ selectedTarget.enc }}</span>
                <span v-if="selectedTarget.stationCount" class="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">{{ selectedTarget.stationCount }} stations</span>
                <span v-if="selectedTarget.vendor" class="px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400">{{ selectedTarget.vendor }}</span>
              </div>
            </div>
            <button @click="clearSelection" class="text-slate-500 hover:text-slate-200 text-lg flex-shrink-0 ml-2" :title="$t('dashboard.clearSelection')" :aria-label="$t('dashboard.clearSelection')">✕</button>
          </div>
          <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 mt-2">{{ $t('dashboard.actions') }}</div>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="action in availableActions" :key="action.key" @click="runActionLocal(action)"
              :disabled="!actionState(action).canRun || !!actionRunning"
              :class="actionBtnClass(action)"
              :title="actionState(action).tooltip"
              class="px-2.5 py-1.5 text-[11px] font-medium rounded-md border transition-colors flex items-center space-x-1 disabled:opacity-40 disabled:cursor-not-allowed">
              <span v-if="actionRunning && actionRunning.id === action.id" class="animate-spin">⏳</span>
              <span v-else>{{ action.icon }}</span>
              <span>{{ action.label }}</span>
            </button>
            <div v-if="!availableActions.length" class="text-[10px] text-slate-600">{{ $t('dashboard.noActionsForTarget') }}</div>
          </div>
        </template>
      </div>

      <!-- Bottom: Action log / results -->
      <div class="bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col flex-1 min-h-0">
        <div class="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 flex-shrink-0">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full" :class="actionRunning ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'"></span>
            <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">{{ $t('dashboard.actionLog') }}</h3>
            <span v-if="actionRunning" class="text-[10px] text-amber-300 font-medium">{{ actionRunning.label }}...</span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-[11px] text-slate-500">{{ actions.length }} {{ $t('dashboard.actionLog').toLowerCase() }}{{ actions.length === 1 ? '' : 's' }}</span>
            <button @click="clearActions()" v-if="actions.length"
              class="px-1.5 py-0.5 text-[10px] rounded-md bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-slate-200 transition-colors">{{ $t('dashboard.clear') }}</button>
          </div>
        </div>
        <div ref="actionLogRef" class="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
          <div v-if="!actions.length && !actionRunning" class="text-center py-8 text-xs text-slate-600">
            <div class="text-2xl mb-2">📋</div>
            <div>{{ $t('dashboard.noActionsYet') }}</div>
          </div>
          <div v-for="act in actions" :key="act.id"
            :class="act.status === 'running' ? 'border-amber-500/50 bg-amber-500/5' : act.status === 'error' ? 'border-red-500/50 bg-red-500/5' : act.status === 'ok' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700/50 bg-slate-700/10'"
            class="border rounded-lg p-2 text-[11px]">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center space-x-1.5 min-w-0 flex-1">
                <span class="flex-shrink-0">{{ act.icon }}</span>
                <span class="font-semibold text-slate-200 truncate">{{ act.label }}</span>
                <span class="text-slate-500 font-mono text-[10px] truncate">{{ act.target }}</span>
              </div>
              <div class="flex items-center space-x-2 flex-shrink-0">
                <span class="text-[10px] text-slate-500">{{ fmtTimeHM(act.time) }}</span>
                <span :class="act.status === 'running' ? 'text-amber-300' : act.status === 'error' ? 'text-red-300' : act.status === 'ok' ? 'text-emerald-300' : 'text-slate-400'">
                  {{ act.status === 'running' ? '⏳' : act.status === 'error' ? '✕' : act.status === 'ok' ? '✓' : '·' }}
                </span>
              </div>
            </div>
            <div class="font-mono text-[10px] text-slate-400 break-all">{{ act.cmd }}</div>
            <div v-if="act.result" class="font-mono text-[10px] text-slate-500 mt-1 whitespace-pre-wrap break-all line-clamp-6">{{ act.result }}</div>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog :show="confirmDialog.show"
      :title="confirmDialog.title"
      :body="confirmDialog.body"
      :cmd="confirmDialog.cmd"
      :target="confirmDialog.target"
      :icon="confirmDialog.icon"
      :severity="confirmDialog.severity"
      :confirm-label="confirmDialog.confirmLabel"
      @confirm="onConfirmAction"
      @cancel="onCancelConfirm" />
  </div>
</template>

<script setup>
import { ref, computed, watch, reactive, onMounted, onUnmounted } from 'vue'
import { useSerialStore } from '../../stores/serialStore'
import { useApStore } from '../../stores/apStore'
import { useBleStore } from '../../stores/bleStore'
import { useDashboardStore } from '../../stores/dashboardStore'
import { useProbeStore } from '../../stores/probeStore'
import { signalClass, dotClass, fmtTimeRelative, fmtTimeHM } from '../../utils/format'
import { useToast } from '../../utils/toast'
import { copyToClipboard } from '../../utils/clipboard'
import { runAction, actions as dispatcherActions, runningAction as dispatcherRunning, clearActions } from '../../utils/actionDispatcher'
import { getCommandMeta, SEVERITY } from '../../services/commandMeta'
import ConfirmDialog from '../ConfirmDialog.vue'
import { SEVERITY_META } from '../../services/commandMeta'
import { t, tA } from '../../services/i18n'

const { show: toastShow } = useToast()

const serialStore = useSerialStore()
const apStore = useApStore()
const bleStore = useBleStore()
const dashStore = useDashboardStore()
const probeStore = useProbeStore()

const liveRef = ref(null)
const actionLogRef = ref(null)
const paused = ref(false)
const autoScroll = ref(true)
const activeTab = ref('ap')
const selectedAP = ref(null)
const selectedBLE = ref(null)
const actions = dispatcherActions
const actionRunning = dispatcherRunning

const TERMINAL_LINE_HEIGHT = 18
const TERMINAL_OVERSCAN = 10
const terminalScrollTop = ref(0)
const terminalViewportHeight = ref(400)

const totalTerminalLines = computed(() => serialStore.terminalOutput.length)
const visibleStart = computed(() => Math.max(0, Math.floor(terminalScrollTop.value / TERMINAL_LINE_HEIGHT) - TERMINAL_OVERSCAN))
const visibleEnd = computed(() => Math.min(totalTerminalLines.value, Math.ceil((terminalScrollTop.value + terminalViewportHeight.value) / TERMINAL_LINE_HEIGHT) + TERMINAL_OVERSCAN))
const visibleTerminalLines = computed(() => {
  const start = visibleStart.value
  const end = visibleEnd.value
  if (start >= end) return []
  return serialStore.terminalOutput.slice(start, end)
})
const spacerTop = computed(() => visibleStart.value * TERMINAL_LINE_HEIGHT)
const spacerBottom = computed(() => Math.max(0, (totalTerminalLines.value - visibleEnd.value) * TERMINAL_LINE_HEIGHT))

const targetTabs = computed(() => [
  { id: 'ap', label: t('dashboard.tabAps'), icon: '📶', count: apStore.apCount || 0, scanCmd: 'scanall' },
  { id: 'ble', label: t('dashboard.tabBle'), icon: '🔵', count: bleStore.deviceCount || 0, scanCmd: 'sniffbt' },
  { id: 'probes', label: t('dashboard.tabProbes'), icon: '📱', count: probeStore.probeCount || 0, scanCmd: 'sniffprobe' },
  { id: 'stations', label: t('dashboard.tabStations'), icon: '👥', count: selectedAP.value?.stations?.length || 0, scanCmd: 'sniffbeacon' }
])

const activeTabLabel = computed(() => targetTabs.value.find(t => t.id === activeTab.value)?.label || '')

const runScanForTab = () => {
  const tab = targetTabs.value.find(t => t.id === activeTab.value)
  if (!tab) return
  if (!serialStore.isConnected) {
    toastShow(t('common.connectFirst'), 'warning')
    return
  }
  runAction({
    cmd: tab.scanCmd,
    label: `Scan ${tab.label}`,
    icon: '▶',
    target: ''
  }).catch(e => {
    const hint = e.hint ? ' — ' + e.hint : ''
    if (e.code === 'PREREQ_FAILED') {
      toastShow(t('dashboard.actionFailed', { msg: e.message }) + hint, 'error')
    }
  })
}

const AP_ACTIONS = [
  { key: 'select',   label: 'Select', icon: '✅', cmd: ap => ap.index !== undefined ? `select -a ${ap.index}` : null, needsSelected: false },
  { key: 'deauth',   label: 'Deauth', icon: '⚡', warning: true, cmd: 'attack -t deauth', needsSelected: true, title: 'Deauth selected APs (requires select first)' },
  { key: 'beacon',   label: 'Beacon Spam', icon: '📯', warning: true, cmd: 'attack -t beacon -r', needsSelected: false },
  { key: 'clone',    label: 'Beacon Clone', icon: '🔄', warning: true, cmd: 'attack -t beacon -a', needsSelected: true, title: 'Clone selected APs' },
  { key: 'probe',    label: 'Probe', icon: '📨', warning: true, cmd: 'attack -t probe', needsSelected: true },
  { key: 'info',     label: 'Info', icon: 'ℹ', cmd: ap => ap.index !== undefined ? `info -a ${ap.index}` : null, needsSelected: false },
  { key: 'lista',    label: 'List APs', icon: '📋', cmd: 'list -a', needsSelected: false },
  { key: 'listc',    label: 'List Stations', icon: '📋', cmd: 'list -c', needsSelected: false },
  { key: 'save',     label: 'Save APs', icon: '💾', cmd: 'save -a', needsSelected: false }
]

const BLE_ACTIONS = [
  { key: 'sniffbt',  label: 'Sniff BLE', icon: '🔵', cmd: 'sniffbt', needsSelected: false },
  { key: 'airtag',   label: 'AirTag', icon: '🏷', cmd: 'sniffbt -t airtag', needsSelected: false },
  { key: 'flipper',  label: 'Flipper', icon: '🐬', cmd: 'sniffbt -t flipper', needsSelected: false },
  { key: 'flock',    label: 'Flock', icon: '📷', cmd: 'sniffbt -t flock', needsSelected: false },
  { key: 'meta',     label: 'Meta', icon: '🕶', cmd: 'sniffbt -t meta', needsSelected: false },
  { key: 'skim',     label: 'Skim', icon: '💳', cmd: 'sniffskim', needsSelected: false },
  { key: 'speaker',  label: 'Speakers', icon: '🔊', cmd: 'sniffbt -t speaker', needsSelected: false },
  { key: 'jbl',      label: 'JBL', icon: '🔊', cmd: 'sniffbt -t jbl', needsSelected: false },
  { key: 'bose',     label: 'Bose', icon: '🔊', cmd: 'sniffbt -t bose', needsSelected: false },
  { key: 'sony',     label: 'Sony', icon: '🔊', cmd: 'sniffbt -t sony', needsSelected: false },
  { key: 'marshall', label: 'Marshall', icon: '🔊', cmd: 'sniffbt -t marshall', needsSelected: false },
  { key: 'sour',     label: 'Sour Apple', icon: '🍎', warning: true, cmd: 'blespam -t sourapple', needsSelected: false },
  { key: 'juice',    label: 'Apple Juice', icon: '🧃', warning: true, cmd: 'blespam -t applejuice', needsSelected: false },
  { key: 'google',   label: 'Google', icon: '🔔', warning: true, cmd: 'blespam -t google', needsSelected: false },
  { key: 'samsung',  label: 'Samsung', icon: '⌚', warning: true, cmd: 'blespam -t samsung', needsSelected: false },
  { key: 'windows',  label: 'Windows', icon: '🪟', warning: true, cmd: 'blespam -t windows', needsSelected: false },
  { key: 'spamall',  label: 'BT Spam All', icon: '📤', warning: true, cmd: 'blespam -t all', needsSelected: false },
  { key: 'spkspam',  label: 'Spk Spam', icon: '🔊', warning: true, cmd: 'blespam -t speaker', needsSelected: false },
  { key: 'jblspam',  label: 'JBL Spam', icon: '🔊', warning: true, cmd: 'blespam -t jbl', needsSelected: false },
  { key: 'bosespam', label: 'Bose Spam', icon: '🔊', warning: true, cmd: 'blespam -t bose', needsSelected: false },
  { key: 'sonyspam', label: 'Sony Spam', icon: '🔊', warning: true, cmd: 'blespam -t sony', needsSelected: false },
  { key: 'mtlspam',  label: 'Mshall Spam', icon: '🔊', warning: true, cmd: 'blespam -t marshall', needsSelected: false },
  { key: 'listt',    label: 'List AirTags', icon: '📋', cmd: 'list -t', needsSelected: false }
]

const PROBE_ACTIONS = [
  { key: 'sniffprobe', label: 'Sniff Probe', icon: '📨', cmd: 'sniffprobe', needsSelected: false },
  { key: 'listp',     label: 'List Probes', icon: '📋', cmd: 'list -p', needsSelected: false }
]

const ADMIN_ACTIONS = [
  { key: 'sysinfo',   label: 'System Info', icon: 'ℹ', cmd: 'info', needsSelected: false },
  { key: 'settings',  label: 'Settings', icon: '⚙', cmd: 'settings', needsSelected: false },
  { key: 'packetcount', label: 'Packet Count', icon: '📊', cmd: 'packetcount', needsSelected: false },
  { key: 'sigmon',    label: 'Signal Mon', icon: '📈', cmd: 'sigmon', needsSelected: false },
  { key: 'chanalyzer', label: 'Ch Analyzer', icon: '📊', cmd: 'channelanalyzer', needsSelected: false },
  { key: 'reboot',    label: 'Reboot', icon: '🔄', cmd: 'reboot', needsSelected: false }
]

const selectedTarget = computed(() => {
  if (activeTab.value === 'ap' && selectedAP.value) {
    const ap = selectedAP.value
    return {
      type: 'ap',
      icon: '📶',
      name: ap.essid || '(hidden)',
      subtitle: ap.bssid,
      ch: ap.channel,
      rssi: ap.rssi,
      enc: ap.encryption,
      stationCount: ap.stations?.length,
      vendor: ap.vendor,
      raw: ap
    }
  }
  if (activeTab.value === 'ble' && selectedBLE.value) {
    const dev = selectedBLE.value
    return {
      type: 'ble',
      icon: '🔵',
      name: dev.name || 'Unknown',
      subtitle: dev.mac,
      rssi: dev.rssi,
      vendor: dev.manufacturer,
      isAirtag: dev.isAirtag,
      raw: dev
    }
  }
  return null
})

const availableActions = computed(() => {
  if (activeTab.value === 'ap' && selectedAP.value) {
    return AP_ACTIONS
  }
  if (activeTab.value === 'ble' && selectedBLE.value) {
    return BLE_ACTIONS
  }
  if (activeTab.value === 'probes') {
    return PROBE_ACTIONS
  }
  return ADMIN_ACTIONS
})

const selectAP = (ap) => {
  if (selectedAP.value?.bssid === ap.bssid) {
    selectedAP.value = null
  } else {
    selectedAP.value = ap
    if (activeTab.value === 'stations') activeTab.value = 'ap'
  }
}

const selectBLE = (dev) => {
  if (selectedBLE.value?.mac === dev.mac) {
    selectedBLE.value = null
  } else {
    selectedBLE.value = dev
  }
}

const clearSelection = () => {
  selectedAP.value = null
  selectedBLE.value = null
}

const actionState = (action) => {
  if (!serialStore.isConnected) {
    return { canRun: false, tooltip: t('common.connectFirst') }
  }
  if (action.needsSelected && !selectedAP.value?.isSelected && activeTab.value === 'ap') {
    return { canRun: false, tooltip: t('dashboard.apActions.select') + ' ' + t('commandBuilder.selectApsFirst') }
  }
  return { canRun: true, tooltip: action.title || action.label }
}

const actionBtnClass = (action) => {
  if (action.warning) return 'bg-red-500/15 text-red-300 hover:bg-red-500/25 border-red-500/30'
  return 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 border-indigo-500/30'
}

const runActionLocal = async (action) => {
  if (!serialStore.isConnected) {
    toastShow(t('common.connectFirst'), 'warning')
    return
  }
  let cmd = action.cmd
  if (typeof cmd === 'function') {
    if (!selectedTarget.value) {
      toastShow(t('dashboard.selectTargetFirst'), 'warning')
      return
    }
    cmd = cmd(selectedTarget.value.raw)
    if (!cmd) {
      toastShow(t('dashboard.targetNoIndex'), 'warning')
      return
    }
  }
  const target = selectedTarget.value
    ? `${selectedTarget.value.name}${selectedTarget.value.subtitle ? ' (' + selectedTarget.value.subtitle + ')' : ''}`
    : ''
  try {
    const result = await runAction({
      cmd,
      label: action.label,
      icon: action.icon,
      target
    })
    if (result?.needsConfirm) {
      showConfirmForAction(result)
    }
    if (action.key === 'select' && selectedAP.value?.index !== undefined) {
      apStore.updateAP(selectedAP.value.index, { isSelected: !selectedAP.value.isSelected })
    }
  } catch (e) {
    const hint = e.hint ? ' — ' + e.hint : ''
    if (e.code === 'PREREQ_FAILED') {
      toastShow(t('dashboard.actionFailed', { msg: e.message }) + hint, 'error')
    } else {
      toastShow(t('dashboard.actionFailed', { msg: action.label + ': ' + e.message }), 'error')
    }
  }
}

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

const showConfirmForAction = (payload) => {
  const meta = getCommandMeta(payload.cmd)
  confirmDialog.show = true
  confirmDialog.title = t('confirm.title', { label: payload.label })
  confirmDialog.body = meta?.destructive
    ? tA('confirm.bodyDestructive')
    : tA('confirm.bodyNormal')
  confirmDialog.cmd = payload.cmd
  confirmDialog.target = payload.target
  confirmDialog.icon = meta?.destructive ? '⚠' : '?'
  confirmDialog.severity = meta?.severity || SEVERITY.HIGH
  confirmDialog.confirmLabel = payload.label
  confirmDialog.pendingPayload = payload
}

const onConfirmAction = async () => {
  const payload = confirmDialog.pendingPayload
  confirmDialog.show = false
  confirmDialog.pendingPayload = null
  if (payload) {
    try {
      await runAction({ ...payload, options: { confirm: false } })
    } catch (e) {
      toastShow(t('dashboard.actionFailed', { msg: e.message }), 'error')
    }
  }
}
const onCancelConfirm = () => {
  confirmDialog.show = false
  confirmDialog.pendingPayload = null
}

watch(activeTab, (tab) => {
  if (tab === 'ap' || tab === 'stations') {
    selectedBLE.value = null
  } else if (tab === 'ble') {
    selectedAP.value = null
  } else if (tab === 'probes') {
    selectedAP.value = null
    selectedBLE.value = null
  }
})

watch(() => serialStore.terminalOutput.length, () => {
  if (paused.value) return
  if (!autoScroll.value) return
  requestAnimationFrame(() => {
    if (liveRef.value) {
      liveRef.value.scrollTop = liveRef.value.scrollHeight
      terminalScrollTop.value = liveRef.value.scrollTop
    }
  })
})

const onTerminalScroll = () => {
  if (!liveRef.value) return
  if (paused.value) return
  const dist = liveRef.value.scrollHeight - (liveRef.value.scrollTop + liveRef.value.clientHeight)
  if (dist > 60) autoScroll.value = false
  else if (dist < 6) autoScroll.value = true
  terminalScrollTop.value = liveRef.value.scrollTop
}

const onTerminalResize = () => {
  if (liveRef.value) {
    terminalViewportHeight.value = liveRef.value.clientHeight
  }
}

let _resizeObserver = null

onMounted(() => {
  if (liveRef.value) {
    onTerminalResize()
    _resizeObserver = new ResizeObserver(onTerminalResize)
    _resizeObserver.observe(liveRef.value)
  }
})

onUnmounted(() => {
  if (_resizeObserver) {
    _resizeObserver.disconnect()
    _resizeObserver = null
  }
})

const copyTerminal = async () => {
  const text = serialStore.terminalOutput
    .map(line => line.text || line)
    .join('\n')
  if (!text) return
  const ok = await copyToClipboard(text)
  toastShow(ok ? t('dashboard.copiedLines', { n: serialStore.terminalOutput.length }) : t('dashboard.copyFailed'), ok ? 'success' : 'error')
}
</script>

<style scoped>
.line-clamp-6 {
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
