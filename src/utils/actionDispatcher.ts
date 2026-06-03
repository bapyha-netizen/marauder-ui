import { ref, shallowRef, computed } from 'vue'
import { getCommandMeta, SEVERITY, SEVERITY_META } from '../services/commandMeta'
import { useApStore } from '../stores/apStore'
import { useBleStore } from '../stores/bleStore'

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

const _actions = shallowRef<Action[]>([])
let _nextId = 0
const _runningAction = ref<Action | null>(null)
const _listeners = new Set<() => void>()

function notify() {
  for (const fn of _listeners) fn()
}

export function subscribeActions(fn: () => void): () => boolean {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

export const actions = computed(() => _actions.value)
export const runningAction = computed(() => _runningAction.value)

export function clearActions() {
  _actions.value = []
  _runningAction.value = null
  notify()
}

export function removeAction(id: number) {
  _actions.value = _actions.value.filter(a => a.id !== id)
  notify()
}

export function getPrereqState(cmd: string): PrereqState {
  const meta = getCommandMeta(cmd)
  const apStore = useApStore()
  const bleStore = useBleStore()
  if (meta?.needsTarget) {
    const hasApSelected = apStore.sortedAPs.some((ap: any) => ap.isSelected)
    const hasBleTarget = bleStore.sortedDevices.length > 0
    const target = meta.target || 'wifi'
    let satisfied = false
    if (target === 'wifi') satisfied = hasApSelected
    else if (target === 'ble') satisfied = hasBleTarget
    else satisfied = hasApSelected || hasBleTarget
    if (!satisfied) {
      return {
        ok: false,
        reason: target === 'ble' ? 'No BLE devices found' : 'Select at least one target first',
        hint: target === 'ble' ? 'Run sniffbt to discover devices' : 'Click an AP and press Select'
      }
    }
  }
  if (meta?.category === 'sniff' && meta?.target === 'ble' && !cmd.includes('-t') && bleStore.deviceCount === 0) {
    return { ok: true, reason: null, hint: 'Will discover new BLE devices' }
  }
  if (meta?.category === 'scan' && meta?.target === 'wifi' && apStore.apCount > 0) {
    return { ok: true, reason: null, hint: 'Append to existing list' }
  }
  return { ok: true, reason: null, hint: meta?.resultHint || 'Command will execute' }
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
  return _actions.value.filter(a => a.status === 'running')
}

export function getActiveCount(): number {
  return _actions.value.filter(a => a.status === 'running').length
}

export async function runAction({ cmd, label, icon, target = null, options = {} }: RunActionParams) {
  if (!cmd) throw new Error('No command specified')
  const meta = getCommandMeta(cmd)
  const prereq = getPrereqState(cmd)
  if (!prereq.ok) {
    const err = new Error(prereq.reason!) as any
    err.code = 'PREREQ_FAILED'
    err.hint = prereq.hint
    throw err
  }
  if (options.confirm !== false && shouldConfirm(cmd)) {
    return { needsConfirm: true, cmd, label, icon, meta, target }
  }
  return _execute({ cmd, label, icon, target, meta })
}

async function _execute({ cmd, label, icon, target, meta }: { cmd: string; label?: string; icon?: string; target?: string | null; meta: any }) {
  const { useSerialStore } = await import('../stores/serialStore')
  const serialStore = useSerialStore()
  const action: Action = {
    id: ++_nextId,
    cmd,
    label: label || cmd,
    icon: icon || SEVERITY_META[meta?.severity || SEVERITY.INFO].icon,
    target: target || '',
    severity: meta?.severity || SEVERITY.LOW,
    category: meta?.category || 'custom',
    time: new Date(),
    status: 'running',
    result: '',
    destructive: meta?.destructive || false
  }
  _actions.value = [action, ..._actions.value].slice(0, 50)
  _runningAction.value = action
  notify()
  const startLen = serialStore.terminalOutput.length
  try {
    if (meta?.category === 'scan' || meta?.category === 'sniff') {
      await serialStore.sendCommand(cmd)
      await new Promise(r => setTimeout(r, 1500))
    } else {
      await serialStore.sendAndWait(cmd, 3000)
      await new Promise(r => setTimeout(r, 200))
    }
    const collected: string[] = []
    for (let i = startLen; i < serialStore.terminalOutput.length; i++) {
      collected.push(serialStore.terminalOutput[i].text.replace(/<[^>]+>/g, ''))
    }
    const output = collected.join('\n').trim()
    action.result = output || 'OK (no output)'
    const hasError = /(?:^|\n)\s*(?:\[ERROR\]|error\b|failed\b)/i.test(output)
    action.status = hasError ? 'error' : 'ok'
    if (meta?.category === 'list' && (cmd.includes('list -a') || cmd === 'list -a')) {
      await new Promise(r => setTimeout(r, 500))
    }
  } catch (e: any) {
    action.status = 'error'
    action.result = e.message || String(e)
  } finally {
    _runningAction.value = null
    notify()
    setTimeout(() => {
      if (action.status !== 'running') {
        const updated = _actions.value.filter(a => a.id !== action.id || a.status === 'running')
        if (updated.length !== _actions.value.length) {
          _actions.value = updated
          notify()
        }
      }
    }, 5 * 60 * 1000)
  }
  return { ok: action.status === 'ok', action }
}

export function isActionRunning(): boolean {
  return _runningAction.value !== null
}
