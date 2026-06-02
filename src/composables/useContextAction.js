import { computed } from 'vue'
import { useSerialStore } from '../stores/serialStore'
import { getCommandMeta, SEVERITY } from '../services/commandMeta'

export function useContextAction(serialStoreRef = null) {
  const serial = serialStoreRef || useSerialStore()

  function isConnected() {
    return serial?.isConnected === true
  }

  function canRun(cmd) {
    if (!isConnected()) {
      return { ok: false, reason: 'Connect to device first', severity: SEVERITY.LOW }
    }
    return { ok: true, reason: null }
  }

  function btnState(cmd, options = {}) {
    if (!isConnected()) {
      return {
        disabled: true,
        title: 'Connect to ESP32 first',
        severity: SEVERITY.LOW,
        isDestructive: false
      }
    }
    const meta = getCommandMeta(cmd)
    return {
      disabled: false,
      title: options.title || meta?.resultHint || `Run: ${cmd}`,
      severity: meta?.severity || SEVERITY.LOW,
      isDestructive: meta?.destructive === true
    }
  }

  function btnClass(cmd, baseClass = 'btn-primary') {
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
