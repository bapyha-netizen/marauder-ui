import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSerialStore = defineStore('serial', () => {
  const port = ref(null)
  const reader = ref(null)
  const readLoopActive = ref(false)
  const isConnected = ref(false)
  const isDemoMode = ref(false)
  const terminalOutput = ref([])
  const rawBuffer = ref('')
  const baudRate = ref(115200)
  let listenPromise = null
  let _lineHandlers = []

  const escHtml = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

  const onLine = (handler) => {
    _lineHandlers.push(handler)
    return () => { _lineHandlers = _lineHandlers.filter(h => h !== handler) }
  }

  const _notifyLine = (text) => {
    for (const h of _lineHandlers) h(text)
  }

  const addToTerminal = (text, type = 'normal') => {
    if (text.trim()) {
      _notifyLine(text)
      const safe = escHtml(text)
      const types = {
        normal: 'text-green-400',
        success: 'text-blue-400',
        error: 'text-red-500',
        command: 'text-yellow-400',
        warning: 'text-orange-400',
        data: 'text-purple-400',
        system: 'text-cyan-400'
      }
      const cls = types[type] || types.normal
      terminalOutput.value = [
        ...terminalOutput.value,
        `<span class="${cls}">${safe}</span>`
      ]
      if (terminalOutput.value.length > 2000) {
        terminalOutput.value = terminalOutput.value.slice(-2000)
      }
    }
  }

  const connect = async () => {
    if (!navigator.serial) {
      throw new Error('Web Serial API not supported — use Chrome or Edge with HTTPS')
    }
    try {
      port.value = await navigator.serial.requestPort({
        filters: [
          { usbVendorId: 0x10C4, usbProductId: 0xEA60 },
          { usbVendorId: 0x1A86, usbProductId: 0x7523 },
          { usbVendorId: 0x0403, usbProductId: 0x6001 },
          { usbVendorId: 0x1A86, usbProductId: 0x55D4 },
          { usbVendorId: 0x303A, usbProductId: 0x1001 },
        ]
      })
    } catch (e) {
      if (e.name === 'NotFoundError') {
        throw new Error('No device selected. Make sure ESP32 is connected and drivers installed (CP210x/CH340).')
      }
      throw e
    }
    try {
      await port.value.open({ baudRate: baudRate.value })
    } catch (e) {
      port.value = null
      throw new Error(`Failed to open serial port: ${e.message}. Check baud rate (${baudRate.value}) and USB connection.`)
    }
    if (!port.value.readable) {
      await port.value.close()
      port.value = null
      throw new Error('Serial port has no readable stream (try a different USB port)')
    }
    isConnected.value = true
    addToTerminal('Connected', 'success')
    listenPromise = listen()
    return true
  }

  const disconnect = async () => {
    readLoopActive.value = false
    if (reader.value) {
      try { await reader.value.cancel() } catch (_) { /* ignore */ }
    }
    if (listenPromise) {
      try { await listenPromise } catch (_) { /* ignore */ }
      listenPromise = null
    }
    reader.value = null
    if (port.value) {
      try { await port.value.close() } catch (_) { /* ignore */ }
      port.value = null
    }
    isConnected.value = false
    addToTerminal('Disconnected', 'error')
  }

  const listen = async () => {
    if (!port.value || !port.value.readable) return
    readLoopActive.value = true
    try {
      const txtDecoder = new TextDecoder()
      reader.value = port.value.readable.getReader()
      while (readLoopActive.value) {
        const { value, done } = await reader.value.read()
        if (done) break
        if (value) {
          rawBuffer.value += txtDecoder.decode(value, { stream: true })
          if (rawBuffer.value.length > 65536) rawBuffer.value = rawBuffer.value.slice(-32768)
          const lines = rawBuffer.value.split('\n')
          rawBuffer.value = lines.pop()
          for (const line of lines) {
            if (line.trim()) addToTerminal(line.trim())
          }
        }
      }
    } catch (e) {
      if (readLoopActive.value) {
        addToTerminal(`Read error: ${e.message}`, 'error')
      }
    } finally {
      reader.value = null
      readLoopActive.value = false
    }
  }

  const sendCommand = async (command) => {
    if (!command) return
    if (command === 'clearlist -a' || command === 'clearlist -c') {
      const { useApStore } = await import('../stores/apStore')
      useApStore().clearSelected()
    }
    if (isDemoMode.value) {
      addToTerminal(`> ${command}`, 'command')
      return
    }
    if (!port.value) {
      addToTerminal('Not connected', 'error')
      return
    }
    try {
      if (!port.value.writable) {
        addToTerminal('Port is not writable', 'error')
        return
      }
      const writer = port.value.writable.getWriter()
      try {
        await writer.write(new TextEncoder().encode(command + '\n'))
        addToTerminal(`> ${command}`, 'command')
      } finally {
        writer.releaseLock()
      }
    } catch (e) {
      addToTerminal(`Failed: ${e.message}`, 'error')
    }
  }

  const PROMPT_RE = /^>\s*$|^esp32marauder>\s*$/i

  const sendAndWait = (command, timeout = 15000) => {
    return new Promise((resolve, reject) => {
      if (isDemoMode.value || !port.value) {
        sendCommand(command)
        setTimeout(resolve, 500)
        return
      }
      const echo = `> ${command}`
      const unsub = onLine((line) => {
        if (line.startsWith('> ') && line !== echo && PROMPT_RE.test(line)) {
          unsub()
          clearTimeout(timer)
          resolve()
        }
      })
      sendCommand(command)
      const timer = setTimeout(() => {
        unsub()
        resolve()
      }, timeout)
    })
  }

  const sendSequence = async (steps) => {
    for (const step of steps) {
      if (typeof step === 'string') {
        await sendCommand(step)
      } else if (step.command) {
        await sendCommand(step.command)
        if (step.delay) await new Promise(r => setTimeout(r, step.delay))
      } else if (step.delay) {
        addToTerminal(`Waiting ${step.delay / 1000}s...`, 'system')
        await new Promise(r => setTimeout(r, step.delay))
      }
    }
  }

  const scanAll = async () => {
    if (isDemoMode.value) {
      const { parseDemoAP, parseDemoBLE } = await import('../services/parserEngine')
      addToTerminal('> scanall (demo)', 'command')
      await new Promise(r => setTimeout(r, 1500))
      parseDemoAP()
      parseDemoBLE()
      addToTerminal('> stopscan (demo)', 'command')
      addToTerminal('> list -a (demo)', 'command')
      return
    }
    await sendSequence([
      { command: 'scanall', delay: 6000 },
      'stopscan',
      { delay: 500 },
      'list -a'
    ])
  }

  const clearListAndScan = async () => {
    await sendSequence([
      'clearlist -a',
      { delay: 500 },
    ])
    await scanAll()
  }

  const clearOutput = () => {
    terminalOutput.value = []
  }

  const toggleDemo = () => {
    isDemoMode.value = !isDemoMode.value
  }

  return {
    port, reader, isConnected, isDemoMode, terminalOutput,
    rawBuffer, baudRate,
    connect, disconnect, sendCommand, sendAndWait, sendSequence, scanAll, clearListAndScan,
    addToTerminal, clearOutput, toggleDemo, onLine
  }
})
