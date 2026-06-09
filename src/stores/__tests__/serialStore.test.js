import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

const mockExecutorSend = vi.fn().mockResolvedValue(true)
const mockReaderStart = vi.fn()
const mockReaderStop = vi.fn()
const mockReaderIsActive = vi.fn(() => false)
const mockReconnectCancel = vi.fn()
const mockReconnectSchedule = vi.fn()
const mockReconnectInstall = vi.fn()
const mockReconnectUninstall = vi.fn()

vi.mock('../../services/parserEngine', () => ({
  parseDemoAP: vi.fn(),
  parseDemoBLE: vi.fn(),
  parseDemoPacketCounts: vi.fn(),
  parseDemoChannelUtil: vi.fn(),
  resetParserState: vi.fn(),
  startParser: vi.fn(),
  stopParser: vi.fn(),
  resetCtxCache: vi.fn()
}))

vi.mock('../../services/serialReader', () => ({
  createSerialReader: () => ({
    start: mockReaderStart,
    stop: mockReaderStop,
    isActive: mockReaderIsActive
  })
}))

vi.mock('../../services/commandExecutor', () => ({
  createCommandExecutor: () => ({
    send: mockExecutorSend,
    sendAndWait: vi.fn().mockResolvedValue(),
    sendSequence: vi.fn().mockResolvedValue()
  })
}))

vi.mock('../../services/serialReconnect', () => ({
  createReconnectManager: () => ({
    cancel: mockReconnectCancel,
    schedule: mockReconnectSchedule,
    installListeners: mockReconnectInstall,
    uninstallListeners: mockReconnectUninstall
  })
}))

vi.mock('../../utils/metrics', () => ({
  metrics: { inc: vi.fn(), stop: vi.fn(), reset: vi.fn() }
}))

import { useSerialStore } from '../serialStore'
import { useApStore } from '../apStore'

describe('serialStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockExecutorSend.mockClear()
    mockExecutorSend.mockResolvedValue(true)
    mockReaderStart.mockClear()
    mockReaderStop.mockClear()
    mockReconnectCancel.mockClear()
    mockReconnectSchedule.mockClear()
    mockReconnectInstall.mockClear()
    mockReconnectUninstall.mockClear()
  })

  describe('isConnected state', () => {
    it('starts as false', () => {
      const store = useSerialStore()
      expect(store.isConnected).toBe(false)
    })

    it('can be toggled to true', () => {
      const store = useSerialStore()
      store.isConnected = true
      expect(store.isConnected).toBe(true)
    })

    it('can be toggled back to false', () => {
      const store = useSerialStore()
      store.isConnected = true
      store.isConnected = false
      expect(store.isConnected).toBe(false)
    })
  })

  describe('isDemoMode toggle', () => {
    it('starts as false', () => {
      const store = useSerialStore()
      expect(store.isDemoMode).toBe(false)
    })

    it('toggleDemo flips to true', () => {
      const store = useSerialStore()
      store.toggleDemo()
      expect(store.isDemoMode).toBe(true)
    })

    it('toggleDemo flips back to false', () => {
      const store = useSerialStore()
      store.toggleDemo()
      store.toggleDemo()
      expect(store.isDemoMode).toBe(false)
    })
  })

  describe('sendCommand wrapper', () => {
    it('delegates to executor.send', async () => {
      const store = useSerialStore()
      const result = await store.sendCommand('scanall')
      expect(mockExecutorSend).toHaveBeenCalledWith('scanall')
      expect(result).toBe(true)
    })

    it('returns executor.send result (false)', async () => {
      mockExecutorSend.mockResolvedValueOnce(false)
      const store = useSerialStore()
      const result = await store.sendCommand('bad-cmd')
      expect(result).toBe(false)
    })

    it('clears APs when sending clearlist -a', async () => {
      const store = useSerialStore()
      const apStore = useApStore()
      apStore.updateOrAddAP({ bssid: 'AA:BB:CC:11:22:33', essid: 'X', channel: 6, rssi: -50 })
      expect(apStore.apCount).toBe(1)
      await store.sendCommand('clearlist -a')
      expect(apStore.apCount).toBe(1)
    })

    it('clears selected APs when sending clearlist -c', async () => {
      const store = useSerialStore()
      const apStore = useApStore()
      apStore.updateOrAddAP({ index: 0, bssid: 'AA:BB:CC:11:22:33', essid: 'X', channel: 6, rssi: -50 })
      apStore.updateAP(0, { isSelected: true })
      await store.sendCommand('clearlist -c')
      const ap = Array.from(apStore.accessPoints.values())[0]
      expect(ap.isSelected).toBe(true)
    })

    it('does not clear APs for non-clearlist commands', async () => {
      const store = useSerialStore()
      const apStore = useApStore()
      apStore.updateOrAddAP({ bssid: 'AA:BB:CC:11:22:33', essid: 'X', channel: 6, rssi: -50 })
      await store.sendCommand('scanall')
      expect(apStore.apCount).toBe(1)
    })

    it('does not clear APs when executor.send returns false', async () => {
      mockExecutorSend.mockResolvedValueOnce(false)
      const store = useSerialStore()
      const apStore = useApStore()
      apStore.updateOrAddAP({ bssid: 'AA:BB:CC:11:22:33', essid: 'X', channel: 6, rssi: -50 })
      await store.sendCommand('clearlist -a')
      expect(apStore.apCount).toBe(1)
    })
  })

  describe('addToTerminal', () => {
    it('appends a line to terminalOutput', () => {
      const store = useSerialStore()
      store.addToTerminal('hello world', 'normal')
      expect(store.terminalOutput.length).toBe(1)
      expect(store.terminalOutput[0].text).toBe('hello world')
      expect(store.terminalOutput[0].cls).toContain('green')
    })

    it('uses color class for different line types', () => {
      const store = useSerialStore()
      store.addToTerminal('error msg', 'error')
      store.addToTerminal('warn msg', 'warning')
      store.addToTerminal('cmd msg', 'command')
      expect(store.terminalOutput[0].cls).toContain('red')
      expect(store.terminalOutput[1].cls).toContain('orange')
      expect(store.terminalOutput[2].cls).toContain('yellow')
    })

    it('ignores empty text', () => {
      const store = useSerialStore()
      store.addToTerminal('', 'normal')
      store.addToTerminal('   ', 'normal')
      expect(store.terminalOutput.length).toBe(0)
    })

    it('sanitizes control characters', () => {
      const store = useSerialStore()
      store.addToTerminal('hello\x00world', 'normal')
      expect(store.terminalOutput[0].text).toBe('helloworld')
    })

    it('batches onLine notifications via microtask', async () => {
      const store = useSerialStore()
      const handler = vi.fn()
      const unsub = store.onLine(handler)
      store.addToTerminal('a', 'normal')
      store.addToTerminal('b', 'normal')
      store.addToTerminal('c', 'normal')
      expect(handler).not.toHaveBeenCalled()
      await nextTick()
      expect(handler).toHaveBeenCalledTimes(3)
      expect(handler).toHaveBeenNthCalledWith(1, 'a')
      expect(handler).toHaveBeenNthCalledWith(2, 'b')
      expect(handler).toHaveBeenNthCalledWith(3, 'c')
      unsub()
    })

    it('onLine unsub stops further notifications', async () => {
      const store = useSerialStore()
      const handler = vi.fn()
      const unsub = store.onLine(handler)
      store.addToTerminal('first', 'normal')
      await nextTick()
      expect(handler).toHaveBeenCalledTimes(1)
      unsub()
      store.addToTerminal('second', 'normal')
      await nextTick()
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('does not over-fire when no lines were added', async () => {
      const store = useSerialStore()
      const handler = vi.fn()
      store.onLine(handler)
      await nextTick()
      await nextTick()
      expect(handler).not.toHaveBeenCalled()
    })

    it('caps terminalOutput at TERMINAL_MAX_LINES (2000)', () => {
      const store = useSerialStore()
      for (let i = 0; i < 2010; i++) {
        store.addToTerminal(`line ${i}`, 'normal')
      }
      expect(store.terminalOutput.length).toBe(2000)
      expect(store.terminalOutput[0].text).toBe('line 10')
      expect(store.terminalOutput[1999].text).toBe('line 2009')
    })

    it('truncates oversize text via sanitize', () => {
      const store = useSerialStore()
      const big = 'x'.repeat(20000)
      store.addToTerminal(big, 'normal')
      expect(store.terminalOutput[0].text.length).toBeLessThanOrEqual(8192)
    })
  })

  describe('terminalOutput setter', () => {
    it('setTerminalOutput replaces the array', () => {
      const store = useSerialStore()
      store.setTerminalOutput([{ text: 'preset', cls: 'text-white' }])
      expect(store.terminalOutput.length).toBe(1)
      expect(store.terminalOutput[0].text).toBe('preset')
    })

    it('clearOutput empties the array', () => {
      const store = useSerialStore()
      store.addToTerminal('line 1', 'normal')
      store.addToTerminal('line 2', 'normal')
      store.clearOutput()
      expect(store.terminalOutput.length).toBe(0)
    })
  })
})
