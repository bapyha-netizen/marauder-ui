import { sanitizeText } from '../utils/sanitize'
import { META } from './firmwareProfiles/marauderV1'

const ALLOWED_COMMANDS = new Set([
  'scanall', 'sniffbeacon', 'sniffprobe', 'sniffdeauth', 'sniffpmkid',
  'sniffraw', 'sniffsae', 'sniffpwn', 'sniffpinescan', 'sniffmultissid',
  'stopscan', 'sniffbt', 'sniffskim',
  'attack', 'blespam', 'spoofat',
  'list', 'select', 'clearlist',
  'ssid', 'save', 'load',
  'randapmac', 'randstamac', 'cloneapmac', 'clonestamac',
  'join', 'add', 'pingscan', 'arpscan', 'portscan',
  'info', 'settings', 'channel', 'reboot',
  'led', 'brightness', 'packetcount', 'sigmon',
  'channelanalyzer', 'mactrack', 'gpsdata', 'nmea',
  'gpspoi', 'gpstracker', 'wardrive', 'wardrivepoi',
  'evilportal', 'karma', 'ls',
  'update', 'help', 'reset', 'scan',
  'deauth', 'beacon', 'probe', 'ble',
  'stop', 'clear', 'show'
])

export function isCommandAllowed(command: string): boolean {
  const cmd = command.trim().toLowerCase()
  if (!cmd) return false
  const firstToken = cmd.split(/\s+/)[0]
  return ALLOWED_COMMANDS.has(firstToken)
}

export function getAllowedCommands(): Set<string> {
  return new Set(ALLOWED_COMMANDS)
}

const DEFAULT_CMD_TIMEOUT_MS = 15000
const SEQUENCE_STEP_TIMEOUT_MS = 5000
const SEQUENCE_STEP_BUFFER_MS = 5000

interface PortRef {
  value: { writable: WritableStream<Uint8Array> | null } | null
}

interface ExecutorDeps {
  isDemoMode: { value: boolean }
  port: PortRef
  onLine: (handler: (line: string) => void) => () => void
  addToTerminal: (text: string, type?: string) => void
  simulateDemo?: (command: string) => void
  promptRe?: RegExp
  onPrompt?: () => void
}

interface QueuedCommand {
  command: string
  resolve: (sent: boolean) => void
}

export function createCommandExecutor(deps: ExecutorDeps) {
  const PROMPT_RE = deps.promptRe ?? META.prompt

  let _writeQueue: QueuedCommand[] = []
  let _writing = false
  let _cancelling = false
  let _lastCommandTime = 0
  const MIN_COMMAND_INTERVAL_MS = 100
  const MAX_QUEUE_SIZE = 100
  let _sendAndWaitInProgress = false
  const _sendAndWaitQueue: Array<{ command: string; timeout: number; signal?: AbortSignal; resolve: () => void }> = []
  const _pendingCommands = new Map()

  const clearQueue = (): void => {
    _cancelling = true
    while (_writeQueue.length) {
      _writeQueue.shift()?.resolve(false)
    }
    _writing = false
    _cancelling = false
  }

  const _processQueue = async (): Promise<void> => {
    if (_writing) return
    _writing = true
    while (_writeQueue.length > 0) {
      if (_cancelling) { _cancelling = false; break }
      const item = _writeQueue.shift()!
      const sent = await _writeRaw(item.command)
      item.resolve(sent)
    }
    _writing = false
    _cancelling = false
  }

  const _writeRaw = async (command: string): Promise<boolean> => {
    if (!deps.port.value) {
      deps.addToTerminal('Not connected', 'error')
      return false
    }
    const now = Date.now()
    const wait = Math.max(0, 100 - (now - _lastCommandTime))
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    _lastCommandTime = Date.now()
    try {
      if (!deps.port.value.writable) {
        deps.addToTerminal('Port is not writable', 'error')
        return false
      }
      const writer = deps.port.value.writable.getWriter()
      try {
        await writer.write(new TextEncoder().encode(command + '\n'))
        deps.addToTerminal(`> ${command}`, 'command')
        return true
      } finally {
        writer.releaseLock()
      }
    } catch (e) {
      deps.addToTerminal(`Failed: ${e instanceof Error ? e.message : String(e)}`, 'error')
      return false
    }
  }

  const _enqueueWrite = (command: string): Promise<boolean> => {
    return new Promise((resolve) => {
      _writeQueue.push({ command, resolve })
      _processQueue()
    })
  }

  const _send = async (command: string): Promise<boolean> => {
    if (!command) return false
    const cmd = sanitizeText(command, { maxLength: 512 })
    if (!cmd) return false
    if (!isCommandAllowed(cmd)) {
      deps.addToTerminal(`Command blocked: "${cmd}" is not in the allowlist`, 'error')
      return false
    }

    if (deps.isDemoMode.value) {
      deps.addToTerminal(`> ${cmd}`, 'command')
      deps.simulateDemo?.(cmd)
      return true
    }
    return _enqueueWrite(cmd)
  }

  const _doSendAndWait = (command: string, timeout: number, signal?: AbortSignal): Promise<void> => {
    return new Promise((resolve) => {
      if (signal?.aborted) { resolve(); return }
      const echo = `> ${command}`
      let resolved = false
      const unsub = deps.onLine((line: string) => {
        if (!resolved && line !== echo && PROMPT_RE.test(line)) {
          resolved = true
          deps.onPrompt?.()
          cleanup()
          resolve()
        }
      })
      const onAbort = () => {
        if (!resolved) {
          resolved = true
          cleanup()
          resolve()
        }
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true
          cleanup()
          deps.addToTerminal(`Timed out waiting for prompt after: ${command}`, 'warning')
          resolve()
        }
      }, timeout)
      const cleanup = () => {
        clearTimeout(timer)
        unsub()
        signal?.removeEventListener('abort', onAbort)
      }
      if (signal?.aborted) { resolve(); return }
      _send(command).then(sent => {
        if (!sent && !resolved) {
          resolved = true
          cleanup()
          resolve()
        }
      })
    })
  }

  const _processSendAndWaitQueue = async (): Promise<void> => {
    if (_sendAndWaitInProgress) return
    _sendAndWaitInProgress = true
    while (_sendAndWaitQueue.length > 0) {
      const item = _sendAndWaitQueue.shift()!
      if (deps.isDemoMode.value || !deps.port.value) {
        _send(item.command)
        await new Promise(r => setTimeout(r, Math.min(item.timeout, 500)))
        item.resolve()
      } else {
        await _doSendAndWait(item.command, item.timeout, item.signal)
        item.resolve()
      }
    }
    _sendAndWaitInProgress = false
  }

  const sendAndWait = (command: string, timeout: number = DEFAULT_CMD_TIMEOUT_MS, signal?: AbortSignal): Promise<void> => {
    return new Promise((resolve) => {
      if (signal?.aborted) { resolve(); return }
      _sendAndWaitQueue.push({ command, timeout, signal, resolve })
      _processSendAndWaitQueue()
    })
  }

  const sendSequence = async (
    steps: (string | { command?: string; delay?: number })[],
    signal?: AbortSignal
  ): Promise<void> => {
    for (const step of steps) {
      if (signal?.aborted) break
      if (typeof step === 'string') {
        await sendAndWait(step, SEQUENCE_STEP_TIMEOUT_MS, signal)
      } else if (step.command) {
        await sendAndWait(step.command, (step.delay || 0) + SEQUENCE_STEP_BUFFER_MS, signal)
      } else if (step.delay) {
        deps.addToTerminal(`Waiting ${step.delay / 1000}s...`, 'system')
        await new Promise<void>((r) => {
          const timer = setTimeout(r, step.delay!)
          signal?.addEventListener('abort', () => { clearTimeout(timer); r() }, { once: true })
        })
      }
    }
  }

  const cancelPending = (): void => {
    for (const [, pending] of _pendingCommands) {
      pending.reject(new Error('Cancelled'))
    }
    _pendingCommands.clear()
    while (_sendAndWaitQueue.length > 0) {
      _sendAndWaitQueue.shift()!.resolve()
    }
    _sendAndWaitInProgress = false
    clearQueue()
  }

  return { send: _send, sendAndWait, sendSequence, clearQueue, cancelPending }
}

export type CommandExecutor = ReturnType<typeof createCommandExecutor>
