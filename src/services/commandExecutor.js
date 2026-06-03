/**
 * Command executor for the Web Serial layer.
 *
 * Owns:
 *   - writing a single command to the port
 *   - sending a command and waiting for a prompt (sendAndWait)
 *   - sending a multi-step sequence with per-step delays
 *   - demo-mode command simulation
 *
 * The store delegates command dispatch here; the store only holds
 * state.
 */

import { sanitizeText } from '../utils/sanitize'

const DEFAULT_CMD_TIMEOUT_MS = 15000
const SEQUENCE_STEP_TIMEOUT_MS = 5000
const SEQUENCE_STEP_BUFFER_MS = 5000
const PROMPT_RE = /^>\s*$|^esp32marauder>\s*$/i

export function createCommandExecutor({
  isDemoMode,
  port,
  onLine,
  addToTerminal,
  simulateDemo,
  clearAPs,
  clearSelected
}) {
  const _send = async (command) => {
    if (!command) return false
    const cmd = sanitizeText(command, { maxLength: 512 })
    if (!cmd) return false
    if (cmd === 'clearlist -a') clearAPs?.()
    else if (cmd === 'clearlist -c') clearSelected?.()

    if (isDemoMode.value) {
      addToTerminal(`> ${cmd}`, 'command')
      simulateDemo?.(cmd)
      return true
    }
    if (!port.value) {
      addToTerminal('Not connected', 'error')
      return false
    }
    try {
      if (!port.value.writable) {
        addToTerminal('Port is not writable', 'error')
        return false
      }
      const writer = port.value.writable.getWriter()
      try {
        await writer.write(new TextEncoder().encode(cmd + '\n'))
        addToTerminal(`> ${cmd}`, 'command')
        return true
      } finally {
        writer.releaseLock()
      }
    } catch (e) {
      addToTerminal(`Failed: ${e.message}`, 'error')
      return false
    }
  }

  const sendAndWait = (command, timeout = DEFAULT_CMD_TIMEOUT_MS) => {
    return new Promise((resolve) => {
      if (isDemoMode.value || !port.value) {
        _send(command)
        setTimeout(resolve, Math.min(timeout, 500))
        return
      }
      const echo = `> ${command}`
      let resolved = false
      const unsub = onLine((line) => {
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
          addToTerminal(`Timed out waiting for prompt after: ${command}`, 'warning')
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

  const sendSequence = async (steps) => {
    for (const step of steps) {
      if (typeof step === 'string') {
        await sendAndWait(step, SEQUENCE_STEP_TIMEOUT_MS)
      } else if (step.command) {
        await sendAndWait(step.command, (step.delay || 0) + SEQUENCE_STEP_BUFFER_MS)
      } else if (step.delay) {
        addToTerminal(`Waiting ${step.delay / 1000}s...`, 'system')
        await new Promise(r => setTimeout(r, step.delay))
      }
    }
  }

  return { send: _send, sendAndWait, sendSequence }
}
