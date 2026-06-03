import { computed } from 'vue'
import { useSerialStore } from '../stores/serialStore'
import { getCommandMeta, SEVERITY } from '../services/commandMeta'
import { getPrereqState } from '../utils/actionDispatcher'

interface BtnState {
  disabled: boolean
  title: string
  severity: string
  isDestructive: boolean
}

interface CanRunResult {
  ok: boolean
  reason: string | null
  severity?: string
}

export function useContextAction(serialStoreRef: any = null) {
  const serial = serialStoreRef || useSerialStore()

  function isConnected(): boolean {
    return serial?.isConnected === true
  }

  function canRun(cmd: string): CanRunResult {
    if (!isConnected()) {
      return { ok: false, reason: 'Connect to device first', severity: SEVERITY.LOW }
    }
    const prereq = getPrereqState(cmd)
    if (!prereq.ok) {
      return { ok: false, reason: prereq.reason || 'Cannot run', severity: SEVERITY.MEDIUM }
    }
    return { ok: true, reason: null }
  }

  function btnState(cmd: string, options: { title?: string } = {}): BtnState {
    if (!isConnected()) {
      return {
        disabled: true,
        title: 'Connect to ESP32 first',
        severity: SEVERITY.LOW,
        isDestructive: false
      }
    }
    const meta = getCommandMeta(cmd)
    const prereq = getPrereqState(cmd)
    return {
      disabled: !prereq.ok,
      title: !prereq.ok ? (prereq.reason || 'Cannot run') : (options.title || meta?.resultHint || `Run: ${cmd}`),
      severity: meta?.severity || SEVERITY.LOW,
      isDestructive: meta?.destructive === true
    }
  }

  function btnClass(cmd: string, baseClass: string = 'btn-primary'): string {
    const state = btnState(cmd)
    if (state.disabled) {
      return `${baseClass} opacity-40 cursor-not-allowed`
    }
    if (state.isDestructive) {
      return 'bg-red-500/20 text-red-300 hover:bg-red-500/30 btn-sm border border-red-500/30'
    }
    switch (state.severity) {
      case SEVERITY.CRITICAL: return 'bg-red-500/20 text-red-300 hover:bg-red-500/30 btn-sm border border-red-500/30'
      case SEVERITY.HIGH:     return 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 btn-sm border border-orange-500/30'
      case SEVERITY.MEDIUM:   return 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 btn-sm border border-yellow-500/30'
      case SEVERITY.LOW:      return 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 btn-sm border border-blue-500/30'
      default:                return baseClass
    }
  }

  return {
    isConnected: computed(() => isConnected()),
    canRun,
    btnState,
    btnClass
  }
}
