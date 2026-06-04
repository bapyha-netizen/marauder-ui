import { ref, shallowRef, computed } from 'vue'
import { getCommandMeta, SEVERITY, SEVERITY_META, type SeverityValue } from '../services/commandMeta'
import { useApStore } from '../stores/apStore'
import { useBleStore } from '../stores/bleStore'
import { sanitizeText } from './sanitize'

type CommandMetaEntry = NonNullable<ReturnType<typeof getCommandMeta>>

interface Action {
  id: number
  cmd: string
  label: string
  icon: string
  target: string
  severity: string
  category: string
  time: Date
  status: string
  result: string
  destructive: boolean
}

interface RunActionParams {
  cmd: string
  label?: string
  icon?: string
  target?: string | null
  options?: { confirm?: boolean }
}

interface PrereqState {
  ok: boolean
  reason: string | null
  hint: string
}

interface PrereqError extends Error {
  code: string
  hint: string
}

// Q-19: keep magic numbers named. Completed actions are removed from the
// history after this delay so the recent list stays bounded.
const ACTION_RETENTION_MS = 5 * 60 * 1000

// P-07: scan/sniff categories wait a fixed 1500ms for output to accumulate
// before we sample the terminal. This is a coarse heuristic; the proper fix
// is to wait for a parser-stable signal. TODO: replace with a parser event.
const SCAN_OUTPUT_GRACE_MS = 1500
const COMMAND_OUTPUT_GRACE_MS = 200
const LIST_DRAIN_MS = 500
const COMMAND_TIMEOUT_MS = 3000

class ActionDispatcher {
  private _actions = shallowRef<Action[]>([])
  private _nextId = 0
  private _runningAction = ref<Action | null>(null)
  private _listeners = new Set<() => void>()

  readonly actions = computed(() => this._actions.value)
  readonly runningAction = computed(() => this._runningAction.value)

  subscribe(fn: () => void): () => boolean {
    this._listeners.add(fn)
    return () => this._listeners.delete(fn)
  }

  clearActions(): void {
    this._actions.value = []
    this._runningAction.value = null
    this._notify()
  }

  /** Test-only: tear down dispatcher state. Not for production use. */
  reset(): void {
    this._actions.value = []
    this._runningAction.value = null
    this._nextId = 0
    this._listeners.clear()
  }

  removeAction(id: number): void {
    this._actions.value = this._actions.value.filter(a => a.id !== id)
    this._notify()
  }

  protected _notify(): void {
    for (const fn of this._listeners) fn()
  }

  protected _getNextId(): number {
    return ++this._nextId
  }

  protected _setRunningAction(action: Action | null): void {
    this._runningAction.value = action
    this._notify()
  }

  protected _addAction(action: Action): void {
    this._actions.value = [action, ...this._actions.value].slice(0, 50)
    this._notify()
  }

  // Export the internal refs for internal use
  get actionsRef() { return this._actions }
  get runningActionRef() { return this._runningAction }

  // CR-1: safe log normalization — terminal lines can be string or {text, cls}
  protected _safeTerminalLine(raw: unknown): string {
    if (!raw) return ''
    if (typeof raw === 'string') return raw
    if (typeof raw === 'object' && raw !== null && 'text' in raw) {
      return String((raw as { text: unknown }).text || '')
    }
    return String(raw)
  }

  async _execute({ cmd, label, icon, target, meta }: { cmd: string; label?: string; icon?: string; target?: string | null; meta?: CommandMetaEntry }) {
    const { useSerialStore } = await import('../stores/serialStore')
    const serialStore = useSerialStore()
    const metaSeverity: string = String(meta?.severity) || SEVERITY.INFO
    const severityKey: SeverityValue = (metaSeverity in SEVERITY_META) ? metaSeverity as SeverityValue : SEVERITY.INFO
    const action: Action = {
      id: this._getNextId(),
      cmd,
      label: label || cmd,
      icon: icon || SEVERITY_META[severityKey].icon,
      target: target || '',
      severity: severityKey,
      category: meta?.category || 'custom',
      time: new Date(),
      status: 'running',
      result: '',
      destructive: meta?.destructive || false
    }
    this._addAction(action)
    this._setRunningAction(action)
    const startLen = serialStore.terminalOutput.length
    try {
      if (meta?.category === 'scan' || meta?.category === 'sniff') {
        await serialStore.sendCommand(cmd)
        await new Promise(r => setTimeout(r, SCAN_OUTPUT_GRACE_MS))
      } else {
        await serialStore.sendAndWait(cmd, COMMAND_TIMEOUT_MS)
        await new Promise(r => setTimeout(r, COMMAND_OUTPUT_GRACE_MS))
      }
      const collected: string[] = []
      for (let i = startLen; i < serialStore.terminalOutput.length; i++) {
        collected.push(sanitizeText(this._safeTerminalLine(serialStore.terminalOutput[i]), { html: true }))
      }
      const output = collected.join('\n').trim()
      action.result = output || 'OK (no output)'
      const hasError = /(?:^|\n)\s*(?:\[ERROR\]|error\b|failed\b)/i.test(output)
      action.status = hasError ? 'error' : 'ok'
      if (meta?.category === 'list' && (cmd.includes('list -a') || cmd === 'list -a')) {
        await new Promise(r => setTimeout(r, LIST_DRAIN_MS))
      }
    } catch (e) {
      action.status = 'error'
      action.result = e instanceof Error ? e.message : String(e)
    } finally {
      this._setRunningAction(null)
      setTimeout(() => {
        if (action.status === 'running') return
        const next = this._actions.value.filter(a => a.id !== action.id)
        if (next.length !== this._actions.value.length) {
          this._actions.value = next
          this._notify()
        }
      }, ACTION_RETENTION_MS)
    }
    return { ok: action.status === 'ok', action }
  }
}

// Create a default instance for backward compatibility
const defaultDispatcher = new ActionDispatcher()

// Export the instance and its methods for backward compatibility
export const actions = defaultDispatcher.actions
export const runningAction = defaultDispatcher.runningAction
export const subscribeActions = defaultDispatcher.subscribe.bind(defaultDispatcher)
export const clearActions = defaultDispatcher.clearActions.bind(defaultDispatcher)
export const _resetDispatcher = defaultDispatcher.reset.bind(defaultDispatcher)
export const removeAction = defaultDispatcher.removeAction.bind(defaultDispatcher)

// Allow creating new instances for testing or isolation
export function createActionDispatcher(): ActionDispatcher {
  return new ActionDispatcher()
}

export function getPrereqState(cmd: string): PrereqState {
  const meta = getCommandMeta(cmd)
  const apStore = useApStore()
  const bleStore = useBleStore()
  if (meta?.needsTarget) {
    const hasApSelected = apStore.sortedAPs.some(ap => ap.isSelected)
    const hasBleTarget = bleStore.sortedDevices.length > 0
    const target = meta.target || 'wifi'
    let satisfied = false
    if (target === 'wifi') satisfied = hasApSelected
    else if (target === 'ble') satisfied = hasBleTarget
    else satisfied = hasApSelected || hasBleTarget
    if (!satisfied) {
      return {
        ok: false,
        reason: target === 'ble' ? 'No BLE devices available' : 'No targets selected',
        hint: target === 'ble' ? 'Click "Scan" to discover BLE devices first' : 'Select one or more APs then try again'
      }
    }
  }
  if (meta?.category === 'sniff' && meta?.target === 'ble' && !cmd.includes('-t') && bleStore.deviceCount === 0) {
    return { ok: true, reason: null, hint: 'Will scan for and discover new BLE devices' }
  }
  if (meta?.category === 'scan' && meta?.target === 'wifi' && apStore.apCount > 0) {
    return { ok: true, reason: null, hint: 'Will add to existing AP list' }
  }
  return { ok: true, reason: null, hint: meta?.resultHint || 'Ready to execute command' }
}

export function canRun(cmd: string): boolean {
  return getPrereqState(cmd).ok
}

export function shouldConfirm(cmd: string): boolean {
  const meta = getCommandMeta(cmd)
  if (!meta) return false
  return meta.severity === SEVERITY.CRITICAL || meta.needsConfirm === true
}

export function listRunning(): Action[] {
  return defaultDispatcher.actions.value.filter(a => a.status === 'running')
}

export function getActiveCount(): number {
  return defaultDispatcher.actions.value.filter(a => a.status === 'running').length
}

export async function runAction({ cmd, label, icon, target = null, options = {} }: RunActionParams) {
  if (!cmd) throw new Error('No command specified')
  const meta = getCommandMeta(cmd)
  const prereq = getPrereqState(cmd)
  if (!prereq.ok) {
    const err: PrereqError = Object.assign(new Error(prereq.reason!), {
      code: 'PREREQ_FAILED',
      hint: prereq.hint
    })
    throw err
  }
  if (options.confirm !== false && shouldConfirm(cmd)) {
    return { needsConfirm: true, cmd, label, icon, meta, target }
  }
  return defaultDispatcher._execute({ cmd, label, icon, target, meta: meta ?? undefined })
}

export function isActionRunning(): boolean {
  return defaultDispatcher.runningAction.value !== null
}
