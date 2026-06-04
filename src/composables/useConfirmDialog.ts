import { reactive } from 'vue'
import { getCommandMeta, SEVERITY } from '../services/commandMeta'
import { t, tA } from '../services/i18n'

export interface ConfirmPayload {
  cmd: string
  label: string
  icon?: string
  target?: string
  options?: Record<string, unknown>
  __clear?: boolean
  destructive?: boolean
}

export interface ConfirmDialogState {
  show: boolean
  title: string
  body: string | string[]
  cmd: string
  target: string
  icon: string
  severity: string
  confirmLabel: string
  cancelLabel: string
  pendingPayload: ConfirmPayload | null
}

export function useConfirmDialog() {
  const state = reactive<ConfirmDialogState>({
    show: false,
    title: '',
    body: '',
    cmd: '',
    target: '',
    icon: '⚠',
    severity: SEVERITY.HIGH,
    confirmLabel: t('confirm.confirmLabel'),
    cancelLabel: t('confirm.cancelLabel'),
    pendingPayload: null
  })

  function show(payload: ConfirmPayload) {
    const meta = getCommandMeta(payload.cmd)
    state.show = true
    state.title = t('confirm.title', { label: payload.label })
    state.body = meta?.destructive
      ? tA('confirm.bodyDestructive')
      : tA('confirm.bodyNormal')
    state.cmd = payload.cmd
    state.target = payload.target || ''
    state.icon = meta?.destructive ? '⚠' : '?'
    state.severity = meta?.severity || SEVERITY.HIGH
    state.confirmLabel = payload.label
    state.cancelLabel = t('confirm.cancelLabel')
    state.pendingPayload = payload
  }

  function hide() {
    state.show = false
    state.pendingPayload = null
  }

  function getPayload(): ConfirmPayload | null {
    return state.pendingPayload
  }

  return { state, show, hide, getPayload }
}
