import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { useApStore } from './apStore'
import { parseDemoAP, parseDemoBLE, parseDemoPacketCounts, parseDemoChannelUtil } from '../services/parserEngine'
import { escHtml } from '../utils/format'

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000]
const MAX_RECONNECT_ATTEMPTS = 6

export const useSerialStore = defineStore('serial', () => {
  const port = ref(null)
  const reader = ref(null)
  const readLoopActive = ref(false)
  const isConnected = ref(false)
  const isDemoMode = ref(false)
  const terminalOutput = shallowRef([])
  const rawBuffer = ref('')
  const baudRate = ref(115200)
  const autoReconnect = ref(true)
  const reconnectAttempts = ref(0)
  const lastConnectedPortInfo = ref(null)
  let listenPromise = null
  let _lineHandlers = []
  let _reconnectTimer = null
  let _navigatorListeners = null

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

  const connect = async (portArg = null) => {
    if (!navigator.serial) {
      throw new Error('Web Serial API not supported — use Chrome or Edge with HTTPS')
    }
    if (!portArg) {
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
    } else {
      port.value = portArg
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
    try {
      const info = port.value.getInfo?.() || {}
      lastConnectedPortInfo.value = info
    } catch (_) { /* ignore */ }
    isConnected.value = true
    reconnectAttempts.value = 0
    addToTerminal('Connected', 'success')
    _installNavigatorListeners()
    listenPromise = listen()
    return true
  }

  const disconnect = async () => {
    _cancelReconnect()
    _uninstallNavigatorListeners()
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

  const _cancelReconnect = () => {
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer)
      _reconnectTimer = null
    }
  }

  const _scheduleReconnect = () => {
    if (!autoReconnect.value) return
    if (reconnectAttempts.value >= MAX_RECONNECT_ATTEMPTS) {
      addToTerminal(`Auto-reconnect: gave up after ${MAX_RECONNECT_ATTEMPTS} attempts. Click Connect to retry.`, 'error')
      return
    }
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttempts.value, RECONNECT_DELAYS.length - 1)]
    const attempt = reconnectAttempts.value + 1
    addToTerminal(`Auto-reconnect: attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s...`, 'warning')
    _reconnectTimer = setTimeout(async () => {
      _reconnectTimer = null
      reconnectAttempts.value = attempt
      try {
        let targetPort = null
        const ports = await navigator.serial.getPorts()
        if (lastConnectedPortInfo.value) {
          targetPort = ports.find(p => {
            const info = p.getInfo?.()
            if (!info || !lastConnectedPortInfo.value) return false
            return info.usbVendorId === lastConnectedPortInfo.value.usbVendorId
              && info.usbProductId === lastConnectedPortInfo.value.usbProductId
          })
        }
        if (!targetPort && ports.length > 0) targetPort = ports[0]
        if (!targetPort) {
          addToTerminal('Auto-reconnect: no authorized port found, click Connect', 'warning')
          return
        }
        await connect(targetPort)
        addToTerminal(`Auto-reconnect: reconnected on attempt ${attempt}`, 'success')
      } catch (e) {
        addToTerminal(`Auto-reconnect: ${e.message}`, 'error')
        _scheduleReconnect()
      }
    }, delay)
  }

  const _onDeviceConnect = (event) => {
    if (isConnected.value || isDemoMode.value) return
    if (!autoReconnect.value) return
    const newPort = event.port
    const newInfo = newPort.getInfo?.() || {}
    if (lastConnectedPortInfo.value
      && newInfo.usbVendorId === lastConnectedPortInfo.value.usbVendorId
      && newInfo.usbProductId === lastConnectedPortInfo.value.usbProductId) {
      addToTerminal('Device plugged in — attempting immediate reconnect', 'system')
      _cancelReconnect()
      reconnectAttempts.value = 0
      connect(newPort).catch(e => {
        addToTerminal(`Reconnect failed: ${e.message}`, 'error')
      })
    }
  }

  const _onDeviceDisconnect = () => {
    if (isConnected.value) {
      addToTerminal('Device unplugged', 'warning')
      isConnected.value = false
      _scheduleReconnect()
    }
  }

  const _installNavigatorListeners = () => {
    if (!navigator.serial || _navigatorListeners) return
    const connHandler = _onDeviceConnect
    const discHandler = _onDeviceDisconnect
    navigator.serial.addEventListener('connect', connHandler)
    navigator.serial.addEventListener('disconnect', discHandler)
    _navigatorListeners = { connHandler, discHandler }
  }

  const _uninstallNavigatorListeners = () => {
    if (!navigator.serial || !_navigatorListeners) return
    navigator.serial.removeEventListener('connect', _navigatorListeners.connHandler)
    navigator.serial.removeEventListener('disconnect', _navigatorListeners.discHandler)
    _navigatorListeners = null
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
        isConnected.value = false
        _scheduleReconnect()
      }
    } finally {
      reader.value = null
      readLoopActive.value = false
    }
  }

  const sendCommand = async (command) => {
    if (!command) return false
    if (command === 'clearlist -a') {
      useApStore().clearAPs()
    } else if (command === 'clearlist -c') {
      useApStore().clearSelected()
    }
    if (isDemoMode.value) {
      addToTerminal(`> ${command}`, 'command')
      _simulateDemoCommand(command)
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
        await writer.write(new TextEncoder().encode(command + '\n'))
        addToTerminal(`> ${command}`, 'command')
        return true
      } finally {
        writer.releaseLock()
      }
    } catch (e) {
      addToTerminal(`Failed: ${e.message}`, 'error')
      return false
    }
  }

  const _simulateDemoCommand = (command) => {
    const genMAC = () => Array.from({length:6},()=>Math.floor(Math.random()*256).toString(16).padStart(2,'0')).join(':').toUpperCase()
    const genRSSI = () => -(Math.floor(Math.random()*40)+40)
    const genCH = () => Math.floor(Math.random()*13)+1

    if (['scanall','sniffbeacon','list'].some(s => command.startsWith(s))) {
      parseDemoAP()
      for (let i = 0; i < 5; i++) {
        addToTerminal(`${genRSSI()} Ch: ${genCH()} ${genMAC()} ESSID: DemoNet-${Math.floor(Math.random()*9999)}`, 'data')
      }
    }
    if (command.startsWith('sniffbt') || command.startsWith('blespam')) {
      parseDemoBLE()
      for (let i = 0; i < 3; i++) {
        addToTerminal(`${genRSSI()} Device: ${['iPhone','AirPods','Samsung Galaxy','Fitbit'][Math.floor(Math.random()*4)]}`, 'data')
      }
    }
    if (command.startsWith('sniffdeauth')) {
      parseDemoPacketCounts()
      for (let i = 0; i < 3; i++) {
        addToTerminal(`${genRSSI()} Ch: ${genCH()} ${genMAC()} -> ${genMAC()}`, 'data')
      }
    }
    if (command.startsWith('sniffprobe') || command.startsWith('list -p')) {
      for (let i = 0; i < 3; i++) {
        addToTerminal(`${genRSSI()} Ch: ${genCH()} Client: ${genMAC()} Requesting: DemoWiFi-${Math.floor(Math.random()*999)}`, 'data')
      }
    }
    if (command.startsWith('packetcount')) { parseDemoPacketCounts() }
    if (command.startsWith('channelanalyzer')) { parseDemoChannelUtil() }
    if (command.startsWith('stopscan')) { addToTerminal('Scanning stopped', 'system') }
    if (command.startsWith('clearlist')) {
      addToTerminal('List cleared', 'system')
      if (command.includes('-a')) useApStore().clearAPs()
    }
  }

  const PROMPT_RE = /^>\s*$|^esp32marauder>\s*$/i

  const sendAndWait = (command, timeout = 15000) => {
    return new Promise((resolve) => {
      if (isDemoMode.value || !port.value) {
        sendCommand(command)
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
      sendCommand(command).then(sent => {
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
        await sendAndWait(step, 5000)
      } else if (step.command) {
        await sendAndWait(step.command, (step.delay || 0) + 5000)
      } else if (step.delay) {
        addToTerminal(`Waiting ${step.delay / 1000}s...`, 'system')
        await new Promise(r => setTimeout(r, step.delay))
      }
    }
  }

  const scanAll = async () => {
    if (isDemoMode.value) {
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
    rawBuffer, baudRate, autoReconnect, reconnectAttempts,
    connect, disconnect, sendCommand, sendAndWait, sendSequence, scanAll, clearListAndScan,
    addToTerminal, clearOutput, toggleDemo, onLine,
    cancelReconnect: _cancelReconnect, scheduleReconnect: _scheduleReconnect
  }
})
