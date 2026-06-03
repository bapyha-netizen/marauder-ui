import { sanitizeText } from '../utils/sanitize'

const DEFAULT_CMD_TIMEOUT_MS = 15000
const SEQUENCE_STEP_TIMEOUT_MS = 5000
const SEQUENCE_STEP_BUFFER_MS = 5000
const PROMPT_RE = /^>\s*$|^esp32marauder>\s*$/i

interface PortRef {
  value: { writable: WritableStream<Uint8Array> | null } | null
}

interface ExecutorDeps {
  isDemoMode: { value: boolean }
  port: PortRef
  onLine: (handler: (line: string) => void) => () => void
  addToTerminal: (text: string, type?: string) => void
  simulateDemo?: (command: string) => void
  clearAPs?: () => void
  clearSelected?: () => void
}

export function createCommandExecutor(deps: ExecutorDeps) {
  const _send = async (command: string): Promise<boolean> => {
    if (!command) return false
    const cmd = sanitizeText(command, { maxLength: 512 })
    if (!cmd) return false
    if (cmd === 'clearlist -a') deps.clearAPs?.()
    else if (cmd === 'clearlist -c') deps.clearSelected?.()

    if (deps.isDemoMode.value) {
      deps.addToTerminal(`> ${cmd}`, 'command')
      deps.simulateDemo?.(cmd)
      return true
    }
    if (!deps.port.value) {
      deps.addToTerminal('Not connected', 'error')
      return false
    }
    try {
      if (!deps.port.value.writable) {
        deps.addToTerminal('Port is not writable', 'error')
        return false
      }
      const writer = deps.port.value.writable.getWriter()
      try {
        await writer.write(new TextEncoder().encode(cmd + '\n'))
        deps.addToTerminal(`> ${cmd}`, 'command')
        return true
      } finally {
        writer.releaseLock()
      }
    } catch (e) {
      deps.addToTerminal(`Failed: ${(e as Error).message}`, 'error')
      return false
    }
  }

  const sendAndWait = (command: string, timeout: number = DEFAULT_CMD_TIMEOUT_MS): Promise<void> => {
    return new Promise((resolve) => {
      if (deps.isDemoMode.value || !deps.port.value) {
        _send(command)
        setTimeout(resolve, Math.min(timeout, 500))
        return
      }
      const echo = `> ${command}`
      let resolved = false
      const unsub = deps.onLine((line: string) => {
        if (!resolved && line !== echo && PROMPT_RE.test(line)) {
          resolved = true
          unsub()
          clearTimeout(timer)
          resolve()
        }
      })
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true
          unsub()
          deps.addToTerminal(`Timed out waiting for prompt after: ${command}`, 'warning')
          resolve()
        }
      }, timeout)
      _send(command).then(sent => {
        if (!sent && !resolved) {
          resolved = true
          unsub()
          clearTimeout(timer)
          resolve()
        }
      })
    })
  }

  const sendSequence = async (steps: (string | { command?: string; delay?: number })[]): Promise<void> => {
    for (const step of steps) {
      if (typeof step === 'string') {
        await sendAndWait(step, SEQUENCE_STEP_TIMEOUT_MS)
      } else if (step.command) {
        await sendAndWait(step.command, (step.delay || 0) + SEQUENCE_STEP_BUFFER_MS)
      } else if (step.delay) {
        deps.addToTerminal(`Waiting ${step.delay / 1000}s...`, 'system')
        await new Promise(r => setTimeout(r, step.delay))
      }
    }
  }

  return { send: _send, sendAndWait, sendSequence }
}

export type CommandExecutor = ReturnType<typeof createCommandExecutor>
