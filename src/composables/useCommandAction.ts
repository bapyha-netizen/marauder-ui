import { useSerialStore } from '../stores/serialStore'
import { runAction, shouldConfirm } from '../utils/actionDispatcher'
import { useToast } from '../utils/toast'
import { useConfirmDialog, type ConfirmPayload } from './useConfirmDialog'
import { t } from '../services/i18n'

export function useCommandAction() {
  const serialStore = useSerialStore()
  const { show: toastShow } = useToast()
  const confirm = useConfirmDialog()

  function canExecute(): boolean {
    if (serialStore.isConnected || serialStore.isDemoMode) return true
    toastShow(t('common.connectFirst'), 'warning')
    return false
  }

  async function execute(cmd: string, label: string, icon: string = '▶', target: string = '', opts: { destructive?: boolean; onResult?: () => void } = {}) {
    if (!canExecute()) return

    const payload: ConfirmPayload = { cmd, label, icon, target, options: {} }

    if (shouldConfirm(cmd) || opts.destructive) {
      confirm.show(payload)
      return
    }

    await runPayload(payload, opts.onResult)
  }

  async function runPayload(payload: ConfirmPayload, onResult?: () => void) {
    try {
      await runAction({ ...payload, options: { confirm: false } })
      onResult?.()
    } catch (e) {
      const hint = (e as any).hint ? ' — ' + (e as any).hint : ''
      toastShow(t('common.failed', { msg: (e as Error).message }) + hint, 'error')
    }
  }

  async function onDialogConfirm() {
    const payload = confirm.getPayload()
    if (!payload) return
    confirm.hide()
    if ((payload as any).__clear) return
    await runPayload(payload)
  }

  function onDialogCancel() {
    confirm.hide()
  }

  return {
    confirmState: confirm.state,
    execute,
    onDialogConfirm,
    onDialogCancel,
    showConfirm: confirm.show,
    hideConfirm: confirm.hide
  }
}
