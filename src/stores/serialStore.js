import { defineStore } from 'pinia'
import { ref, shallowRef, triggerRef } from 'vue'
import { useApStore } from './apStore'
import { parseDemoAP, parseDemoBLE, parseDemoPacketCounts, parseDemoChannelUtil, resetParserState } from '../services/parserEngine'
import { sanitizeText } from '../utils/sanitize'
import { logger } from '../utils/logger'
import { metrics } from '../utils/metrics'
import { createSerialReader } from '../services/serialReader'
import { createCommandExecutor } from '../services/commandExecutor'
import { createReconnectManager } from '../services/serialReconnect'

const TERMINAL_MAX_LINES = 2000

export const useSerialStore = defineStore('serial', () => {
  const port = ref(null)
  const isConnected = ref(false)
  const isDemoMode = ref(false)
  const terminalOutput = shallowRef([])
  const baudRate = ref(115200)
  const autoReconnect = ref(true)
  const reconnectAttempts = ref(0)
  const lastConnectedPortInfo = ref(null)

  let _lineHandlers = []
  let _pendingLines = []
  let _microtaskScheduled = false

  const reader = createSerialReader()
  let _reconnect = null

  const onLine = (handler) => {
    _lineHandlers.push(handler)
    return () => { _lineHandlers = _lineHandlers.filter(h => h !== handler) }
  }

  const _notifyLine = (text) => {
    _pendingLines.push(text)
    if (!_microtaskScheduled) {
      _microtaskScheduled = true
      queueMicrotask(() => {
        const batch = _pendingLines
        _pendingLines = []
        _microtaskScheduled = false
        for (const h of _lineHandlers) {
          for (const line of batch) h(line)
        }
      })
    }
  }

  const TERMINAL_TYPES = {
    normal: 'text-green-400',
    success: 'text-blue-400',
    error: 'text-red-500',
    command: 'text-yellow-400',
    warning: 'text-orange-400',
    data: 'text-purple-400',
    system: 'text-cyan-400'
  }

  const addToTerminal = (text, type = 'normal') => {
    const safe = sanitizeText(text, { maxLength: 8192 })
    if (!safe) return
    _notifyLine(safe)
    const cls = TERMINAL_TYPES[type] || TERMINAL_TYPES.normal
    terminalOutput.value.push({ text: safe, cls })
    metrics.inc('terminalPushes', 1)
    if (terminalOutput.value.length > TERMINAL_MAX_LINES) {
      terminalOutput.value.shift()
    }
    triggerRef(terminalOutput)
  }

  const _simulateDemoCommand = (command) => {
    const apStore = useApStore()
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
      if (command.includes('-a')) apStore.clearAPs()
    }
  }

  const _buildConnect = (targetPort) => async (portArg = null) => {
    if (!navigator.serial) {
      throw new Error('Web Serial API not supported — use Chrome or Edge with HTTPS')
    }
    let next = portArg
    if (!next) {
      try {
        next = await navigator.serial.requestPort({
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
    }
    port.value = next
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
    } catch (e) {
      logger.warn('port.getInfo failed', e?.message, 'serial')
    }
    isConnected.value = true
    reconnectAttempts.value = 0
    addToTerminal('Connected', 'success')
    _reconnect.installListeners()
    await reader.start(port.value, addToTerminal)
    return true
  }

  const connect = async (portArg = null) => {
    const fn = _buildConnect()
    return fn(portArg)
  }

  const disconnect = async () => {
    _reconnect.cancel()
    _reconnect.uninstallListeners()
    await reader.stop()
    if (port.value) {
      try { await port.value.close() } catch (e) {
        logger.warn('port.close during disconnect', e?.message, 'serial')
      }
      port.value = null
    }
    isConnected.value = false
    resetParserState()
    addToTerminal('Disconnected', 'error')
  }

  const apStore = useApStore()
  const executor = createCommandExecutor({
    isDemoMode,
    port,
    onLine,
    addToTerminal,
    simulateDemo: _simulateDemoCommand,
    clearAPs: () => apStore.clearAPs(),
    clearSelected: () => apStore.clearSelected()
  })

  const _wrappedConnect = async (portArg = null) => {
    try {
      return await _buildConnect(portArg)()
    } catch (e) {
      isConnected.value = false
      addToTerminal(`Connection failed: ${e.message}`, 'error')
      _reconnect.schedule()
      throw e
    }
  }

  _reconnect = createReconnectManager({
    isConnected,
    isDemoMode,
    autoReconnect,
    reconnectAttempts,
    lastConnectedPortInfo,
    connect: _wrappedConnect,
    addToTerminal
  })

  const connectPublic = async (portArg = null) => {
    try {
      return await _buildConnect()(portArg)
    } catch (e) {
      isConnected.value = false
      addToTerminal(`Connection failed: ${e.message}`, 'error')
      _reconnect.schedule()
      throw e
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
    await executor.sendSequence([
      { command: 'scanall', delay: 6000 },
      'stopscan',
      { delay: 500 },
      'list -a'
    ])
  }

  const clearListAndScan = async () => {
    await executor.sendSequence([
      'clearlist -a',
      { delay: 500 },
    ])
    await scanAll()
  }

  const clearOutput = () => {
    terminalOutput.value = []
    triggerRef(terminalOutput)
  }

  const toggleDemo = () => {
    isDemoMode.value = !isDemoMode.value
  }

  const setTerminalOutput = (arr) => {
    terminalOutput.value = arr
    triggerRef(terminalOutput)
  }

  return {
    port, isConnected, isDemoMode, terminalOutput,
    baudRate, autoReconnect, reconnectAttempts,
    connect: connectPublic, disconnect,
    sendCommand: executor.send,
    sendAndWait: executor.sendAndWait,
    sendSequence: executor.sendSequence,
    scanAll, clearListAndScan,
    addToTerminal, clearOutput, toggleDemo, onLine, setTerminalOutput,
    cancelReconnect: () => _reconnect.cancel(),
    scheduleReconnect: () => _reconnect.schedule()
  }
})
