import { defineStore } from 'pinia'
import { ref, shallowRef, triggerRef, type Ref, type ShallowRef } from 'vue'
import { useApStore } from './apStore'
import { parseDemoAP, parseDemoBLE, parseDemoPacketCounts, parseDemoChannelUtil, resetParserState } from '../services/parserEngine'
import { sanitizeText } from '../utils/sanitize'
import { logger } from '../utils/logger'
import { metrics } from '../utils/metrics'
import { createSerialReader, type SerialReader } from '../services/serialReader'
import { createCommandExecutor, type CommandExecutor } from '../services/commandExecutor'
import { createReconnectManager, type ReconnectManager } from '../services/serialReconnect'
import type { TerminalLineType } from '../types/serial'

interface SerialPortLike {
  readable?: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  open?(options: { baudRate: number }): Promise<void>
  close?(): Promise<void>
  getInfo?(): { usbVendorId?: number; usbProductId?: number }
}

const TERMINAL_MAX_LINES = 2000

export const useSerialStore = defineStore('serial', () => {
  const port = ref<SerialPortLike | null>(null)
  const isConnected = ref(false)
  const isDemoMode = ref(false)
  const terminalOutput = shallowRef<Array<{ text: string; cls: string }>>([])
  const baudRate = ref(115200)
  const autoReconnect = ref(true)
  const reconnectAttempts = ref(0)
  const lastConnectedPortInfo = ref<{ usbVendorId?: number; usbProductId?: number } | null>(null)

  let _lineHandlers: Array<(line: string) => void> = []
  let _pendingLines: string[] = []
  let _microtaskScheduled = false

  const reader: SerialReader = createSerialReader()
  let _reconnect: ReconnectManager | null = null

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
          for (const line of batch) h(line)
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

  const addToTerminal = (text: string, type: TerminalLineType = 'normal'): void => {
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

  const _simulateDemoCommand = (command: string): void => {
    const apStore = useApStore()
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
      if (command.includes('-a')) apStore.clearAPs()
    }
  }

  const _buildConnect = (targetPort?: SerialPortLike | null) => async (portArg: SerialPortLike | null = null): Promise<boolean> => {
    if (!(navigator as any).serial) {
      throw new Error('Web Serial API not supported — use Chrome or Edge with HTTPS')
    }
    let next = portArg
    if (!next) {
      try {
        next = await (navigator as any).serial.requestPort({
          filters: [
            { usbVendorId: 0x10C4, usbProductId: 0xEA60 },
            { usbVendorId: 0x1A86, usbProductId: 0x7523 },
            { usbVendorId: 0x0403, usbProductId: 0x6001 },
            { usbVendorId: 0x1A86, usbProductId: 0x55D4 },
            { usbVendorId: 0x303A, usbProductId: 0x1001 },
          ]
        })
      } catch (e) {
        if ((e as Error).name === 'NotFoundError') {
          throw new Error('No device selected. Make sure ESP32 is connected and drivers installed (CP210x/CH340).')
        }
        throw e
      }
    }
    port.value = next
    try {
      await port.value.open?.({ baudRate: baudRate.value })
    } catch (e) {
      port.value = null
      throw new Error(`Failed to open serial port: ${(e as Error).message}. Check baud rate (${baudRate.value}) and USB connection.`)
    }
    if (!port.value.readable) {
      await port.value.close?.()
      port.value = null
      throw new Error('Serial port has no readable stream (try a different USB port)')
    }
    try {
      const info = port.value.getInfo?.() || {}
      lastConnectedPortInfo.value = info as { usbVendorId?: number; usbProductId?: number }
    } catch (e) {
      logger.warn('port.getInfo failed', (e as Error)?.message, 'serial')
    }
    isConnected.value = true
    reconnectAttempts.value = 0
    addToTerminal('Connected', 'success')
    _reconnect!.installListeners()
    await reader.start(port.value as any, addToTerminal)
    return true
  }

  const connect = async (portArg: SerialPortLike | null = null): Promise<boolean> => {
    const fn = _buildConnect()
    return fn(portArg)
  }

  const disconnect = async (): Promise<void> => {
    _reconnect!.cancel()
    _reconnect!.uninstallListeners()
    await reader.stop()
    if (port.value) {
      try { await port.value.close?.() } catch (e) {
        logger.warn('port.close during disconnect', (e as Error)?.message, 'serial')
      }
      port.value = null
    }
    isConnected.value = false
    resetParserState()
    terminalOutput.value = []
    addToTerminal('Disconnected', 'error')
  }

  const apStore = useApStore()
  const executor: CommandExecutor = createCommandExecutor({
    isDemoMode,
    port: port as any,
    onLine,
    addToTerminal,
    simulateDemo: _simulateDemoCommand,
    clearAPs: () => apStore.clearAPs(),
    clearSelected: () => apStore.clearSelected()
  })

  const _wrappedConnect = async (portArg: SerialPortLike | null = null): Promise<boolean> => {
    try {
      return await _buildConnect(portArg)()
    } catch (e) {
      isConnected.value = false
      addToTerminal(`Connection failed: ${(e as Error).message}`, 'error')
      _reconnect!.schedule()
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

  const connectPublic = async (portArg: SerialPortLike | null = null): Promise<boolean> => {
    try {
      return await _buildConnect()(portArg)
    } catch (e) {
      isConnected.value = false
      addToTerminal(`Connection failed: ${(e as Error).message}`, 'error')
      _reconnect.schedule()
      throw e
    }
  }

  const scanAll = async (): Promise<void> => {
    if (isDemoMode.value) {
      addToTerminal('> scanall (demo)', 'command')
      await new Promise<void>(r => setTimeout(r, 1500))
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

  const clearListAndScan = async (): Promise<void> => {
    await executor.sendSequence([
      'clearlist -a',
      { delay: 500 },
    ])
    await scanAll()
  }

  const clearOutput = (): void => {
    terminalOutput.value = []
    triggerRef(terminalOutput)
  }

  const toggleDemo = (): void => {
    isDemoMode.value = !isDemoMode.value
  }

  const setTerminalOutput = (arr: Array<{ text: string; cls: string }>): void => {
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
    cancelReconnect: () => _reconnect!.cancel(),
    scheduleReconnect: () => _reconnect!.schedule()
  }
})
