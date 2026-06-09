import { defineStore } from 'pinia'
import { ref, shallowRef, triggerRef, type Ref } from 'vue'
import { useApStore } from './apStore'
import { useBleStore } from './bleStore'
import { useProbeStore } from './probeStore'
import { useDashboardStore } from './dashboardStore'
import { parseDemoAP, parseDemoBLE, parseDemoPacketCounts, parseDemoChannelUtil, resetParserState, startParser, stopParser, resetCtxCache } from '../services/parserEngine'
import { sanitizeText } from '../utils/sanitize'
import { logger } from '../utils/logger'
import { metrics } from '../utils/metrics'
import { cancelPendingSaves } from '../utils/persist'
import { createSerialReader, type SerialReader } from '../services/serialReader'
import { createCommandExecutor, type CommandExecutor } from '../services/commandExecutor'
import { createReconnectManager, type ReconnectManager } from '../services/serialReconnect'
import type { TerminalLineType } from '../types/serial'

const TERMINAL_MAX_LINES = 2000

const _noopReconnect: ReconnectManager = {
  cancel: () => {},
  schedule: () => {},
  installListeners: () => {},
  uninstallListeners: () => {},
  dispose: () => {}
}

export const useSerialStore = defineStore('serial', () => {
  const port = ref<SerialPort | null>(null)
  const isConnected = ref(false)
  const isDemoMode = ref(false)
  const terminalOutput = shallowRef<Array<{ text: string; cls: string }>>([])
  const baudRate = ref(115200)
  const autoReconnect = ref(true)
  const reconnectAttempts = ref(0)
  const lastConnectedPortInfo = ref<{ usbVendorId?: number; usbProductId?: number } | null>(null)

  const apStore = useApStore()

  let _lineHandlers: Array<(line: string) => void> = []
  let _pendingLines: string[] = []
  let _microtaskScheduled = false

  const reader: SerialReader = createSerialReader()
  let _reconnect: ReconnectManager | null = null
  const _workflowAbortController = ref<AbortController | null>(null)

  const getReconnect = (): ReconnectManager => _reconnect ?? _noopReconnect

  const onLine = (handler: (line: string) => void): (() => void) => {
    _lineHandlers.push(handler)
    return () => { _lineHandlers = _lineHandlers.filter(h => h !== handler) }
  }

  const _notifyLine = (text: string): void => {
    _pendingLines.push(text)
    if (!_microtaskScheduled) {
      _microtaskScheduled = true
      queueMicrotask(() => {
        const batch = _pendingLines
        _pendingLines = []
        _microtaskScheduled = false
        for (const h of _lineHandlers) {
          for (const line of batch) {
            try { h(line) } catch (e) { logger.warn('Line handler error', e, 'serialStore') }
          }
        }
      })
    }
  }

  const TERMINAL_TYPES: Record<TerminalLineType, string> = {
    normal: 'text-green-400',
    success: 'text-blue-400',
    error: 'text-red-500',
    command: 'text-yellow-400',
    warning: 'text-orange-400',
    data: 'text-purple-400',
    system: 'text-cyan-400'
  }

  const _isTerminalLineType = (t: unknown): t is TerminalLineType => {
    return typeof t === 'string' && Object.prototype.hasOwnProperty.call(TERMINAL_TYPES, t)
  }

  let _terminalDirty = false
  const scheduleTerminalUpdate = (): void => {
    if (_terminalDirty) return
    _terminalDirty = true
    requestAnimationFrame(() => {
      triggerRef(terminalOutput)
      _terminalDirty = false
    })
  }

  const addToTerminal = (text: string, type: TerminalLineType = 'normal'): void => {
    const safe = sanitizeText(text, { maxLength: 8192 })
    if (!safe) return
    _notifyLine(safe)
    const safeType: TerminalLineType = _isTerminalLineType(type) ? type : 'normal'
    const cls = TERMINAL_TYPES[safeType]
    terminalOutput.value.push({ text: safe, cls })
    metrics.inc('terminalPushes', 1)
    if (terminalOutput.value.length > TERMINAL_MAX_LINES) {
      terminalOutput.value = terminalOutput.value.slice(-TERMINAL_MAX_LINES)
    }
    scheduleTerminalUpdate()
  }

  const _simulateDemoCommand = (command: string): void => {
    const genMAC = (): string => Array.from({length:6},()=>Math.floor(Math.random()*256).toString(16).padStart(2,'0')).join(':').toUpperCase()
    const genRSSI = (): number => -(Math.floor(Math.random()*40)+40)
    const genCH = (): number => Math.floor(Math.random()*13)+1

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
    }
  }

  const _buildConnect = (targetPort?: SerialPort | null) => async (portArg: SerialPort | null = null): Promise<boolean> => {
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
        if (e instanceof Error && e.name === 'NotFoundError') {
          throw new Error('No device selected. Make sure ESP32 is connected and drivers installed (CP210x/CH340).')
        }
        throw e
      }
    }
    port.value = next
    const current = port.value
    if (!current) {
      throw new Error('Failed to acquire serial port reference')
    }
    try {
      await current.open({ baudRate: baudRate.value })
    } catch (e) {
      port.value = null
      throw new Error(`Failed to open serial port: ${e instanceof Error ? e.message : String(e)}. Check baud rate (${baudRate.value}) and USB connection.`)
    }
    if (!current.readable) {
      await current.close()
      port.value = null
      throw new Error('Serial port has no readable stream (try a different USB port)')
    }
    try {
      const info = current.getInfo?.() || {}
      lastConnectedPortInfo.value = info
    } catch (e) {
      logger.warn('port.getInfo failed', (e as Error)?.message, 'serial')
    }
    isConnected.value = true
    reconnectAttempts.value = 0
    addToTerminal('Connected', 'success')
    getReconnect().installListeners()
    if (port.value) {
      await reader.start(port.value, addToTerminal, {
        onTrimNotice: (msg) => addToTerminal(msg, 'warning')
      })
    }
    resetCtxCache()
    return true
  }

  const disconnect = async (): Promise<void> => {
    _workflowAbortController.value?.abort()
    _workflowAbortController.value = null
    getReconnect().cancel()
    getReconnect().uninstallListeners()
    await reader.stop()
    isConnected.value = false
    if (port.value) {
      try { await port.value.close() } catch (e) {
        logger.warn('port.close during disconnect', (e as Error)?.message, 'serial')
      }
      port.value = null
    }
    stopParser()
    resetParserState()
    resetCtxCache()
    _lineHandlers = []
    _pendingLines = []
    _microtaskScheduled = false
    executor.cancelPending?.()
    cancelPendingSaves()
    metrics.stop()
    terminalOutput.value = []
    addToTerminal('Disconnected', 'error')
  }

  const executor: CommandExecutor = createCommandExecutor({
    isDemoMode,
    port: port as Ref<{ writable: WritableStream<Uint8Array> | null } | null>,
    onLine,
    addToTerminal: addToTerminal as (text: string, type?: string) => void,
    simulateDemo: _simulateDemoCommand,
    onPrompt: () => {
      resetParserState()
      resetCtxCache()
    }
  })

  const clearAllStores = (): void => {
    apStore.clearAPs()
    useBleStore().clearDevices()
    useProbeStore().clearProbes()
    useDashboardStore().resetStats()
  }

  let _isConnecting = false
  let _connectTimeout: ReturnType<typeof setTimeout> | null = null

  const _connect = async (portArg: SerialPort | null = null): Promise<boolean> => {
    if (_isConnecting) return false
    _isConnecting = true
    getReconnect().cancel()
    _connectTimeout = setTimeout(() => {
      _isConnecting = false
      _connectTimeout = null
    }, 30000)
    try {
      return await _buildConnect(portArg)()
    } catch (e) {
      isConnected.value = false
      addToTerminal(`Connection failed: ${(e as Error).message}`, 'error')
      getReconnect().schedule()
      throw e
    } finally {
      if (_connectTimeout) {
        clearTimeout(_connectTimeout)
        _connectTimeout = null
      }
      _isConnecting = false
    }
  }

  _reconnect = createReconnectManager({
    isConnected,
    isDemoMode,
    autoReconnect,
    reconnectAttempts,
    lastConnectedPortInfo,
    connect: _connect,
    addToTerminal: addToTerminal as (text: string, type?: string) => void,
    onDisconnect: () => {
      executor.cancelPending?.()
      _lineHandlers = []
      _pendingLines = []
      _microtaskScheduled = false
    }
  })

  const clearOutput = (): void => {
    terminalOutput.value = []
    triggerRef(terminalOutput)
  }

  const toggleDemo = (): void => {
    isDemoMode.value = !isDemoMode.value
  }

  const setTerminalOutput = (arr: Array<{ text: string; cls: string }>): void => {
    // Replace atomically, then re-emit the rAF-triggered update so subscribers see the change.
    terminalOutput.value = arr.slice(-TERMINAL_MAX_LINES)
    if (terminalOutput.value.length > TERMINAL_MAX_LINES) {
      terminalOutput.value.shift()
    }
    scheduleTerminalUpdate()
  }

  return {
    port, isConnected, isDemoMode, terminalOutput,
    baudRate, autoReconnect, reconnectAttempts,
    connect: _connect, disconnect,
    sendCommand: executor.send,
    sendAndWait: executor.sendAndWait,
    sendSequence: executor.sendSequence,
    addToTerminal, clearOutput, toggleDemo, onLine, setTerminalOutput,
    clearAllStores,
    getWorkflowSignal: () => {
      if (!_workflowAbortController.value) {
        _workflowAbortController.value = new AbortController()
      }
      return _workflowAbortController.value.signal
    },
    cancelReconnect: () => getReconnect().cancel(),
    scheduleReconnect: () => getReconnect().schedule()
  }
})
