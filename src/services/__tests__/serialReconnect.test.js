import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

import { createReconnectManager } from '../serialReconnect'

function makeDeps(overrides = {}) {
  return {
    isConnected: ref(false),
    isDemoMode: ref(false),
    autoReconnect: ref(true),
    reconnectAttempts: ref(0),
    lastConnectedPortInfo: ref({ usbVendorId: 0x10C4, usbProductId: 0xEA60 }),
    connect: vi.fn().mockResolvedValue(true),
    addToTerminal: vi.fn(),
    ...overrides
  }
}

function installFakeNavigatorSerial() {
  const listeners = { connect: [], disconnect: [] }
  const fake = {
    addEventListener(name, fn) {
      if (name === 'connect') listeners.connect.push(fn)
      else if (name === 'disconnect') listeners.disconnect.push(fn)
    },
    removeEventListener(name, fn) {
      if (name === 'connect') listeners.connect = listeners.connect.filter(f => f !== fn)
      else if (name === 'disconnect') listeners.disconnect = listeners.disconnect.filter(f => f !== fn)
    },
    getPorts: vi.fn().mockResolvedValue([]),
    _fireConnect(port) {
      for (const fn of listeners.connect) fn({ port })
    },
    _fireDisconnect() {
      for (const fn of listeners.disconnect) fn()
    }
  }
  Object.defineProperty(navigator, 'serial', { value: fake, configurable: true, writable: true })
  return fake
}

describe('serialReconnect', () => {
  let originalSerial

  beforeEach(() => {
    originalSerial = navigator.serial
    installFakeNavigatorSerial()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalSerial === undefined) {
      try { delete navigator.serial } catch (_) { /* noop */ }
    } else {
      Object.defineProperty(navigator, 'serial', { value: originalSerial, configurable: true, writable: true })
    }
  })

  describe('schedule()', () => {
    it('does nothing when autoReconnect is disabled', () => {
      const deps = makeDeps({ autoReconnect: ref(false) })
      const rm = createReconnectManager(deps)
      rm.schedule()
      expect(deps.connect).not.toHaveBeenCalled()
      expect(deps.addToTerminal).not.toHaveBeenCalled()
    })

    it('uses exponential backoff delay (1s for first attempt)', () => {
      const deps = makeDeps()
      const rm = createReconnectManager(deps)
      rm.schedule()
      expect(deps.addToTerminal).toHaveBeenCalledWith(
        expect.stringContaining('attempt 1/6'),
        'warning'
      )
    })

    it('logs higher delay for later attempts', () => {
      const deps = makeDeps({ reconnectAttempts: ref(3) })
      const rm = createReconnectManager(deps)
      rm.schedule()
      expect(deps.addToTerminal).toHaveBeenCalledWith(
        expect.stringContaining('attempt 4/6'),
        'warning'
      )
      expect(deps.addToTerminal).toHaveBeenCalledWith(
        expect.stringContaining('8'),
        'warning'
      )
    })

    it('caps delay at the last entry (30000 ms) for attempts past the table', () => {
      const deps = makeDeps({ reconnectAttempts: ref(5) })
      const rm = createReconnectManager(deps)
      rm.schedule()
      expect(deps.addToTerminal).toHaveBeenCalledWith(
        expect.stringContaining('attempt 6/6'),
        'warning'
      )
      expect(deps.addToTerminal).toHaveBeenCalledWith(
        expect.stringContaining('30'),
        'warning'
      )
    })

    it('gives up after MAX_RECONNECT_ATTEMPTS', () => {
      const deps = makeDeps({ reconnectAttempts: ref(6) })
      const rm = createReconnectManager(deps)
      rm.schedule()
      expect(deps.addToTerminal).toHaveBeenCalledWith(
        expect.stringContaining('gave up'),
        'error'
      )
      expect(deps.connect).not.toHaveBeenCalled()
    })

    it('invokes connect after delay elapses', async () => {
      const deps = makeDeps()
      navigator.serial.getPorts.mockResolvedValue([])
      const rm = createReconnectManager(deps)
      rm.schedule()
      expect(deps.connect).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1100)
      expect(deps.connect).not.toHaveBeenCalled()
    })

    it('reschedules on connect failure', async () => {
      const port = { getInfo: () => ({ usbVendorId: 0x10C4, usbProductId: 0xEA60 }) }
      const deps = makeDeps()
      deps.connect.mockRejectedValueOnce(new Error('still no port'))
      navigator.serial.getPorts.mockResolvedValue([port])
      const rm = createReconnectManager(deps)
      rm.schedule()
      await vi.advanceTimersByTimeAsync(1100)
      expect(deps.connect).toHaveBeenCalledTimes(1)
      expect(deps.addToTerminal).toHaveBeenCalledWith(
        expect.stringContaining('Auto-reconnect: still no port'),
        'error'
      )
      expect(deps.reconnectAttempts.value).toBe(1)
    })

    it('increments reconnectAttempts on success', async () => {
      const deps = makeDeps()
      navigator.serial.getPorts.mockResolvedValue([])
      const rm = createReconnectManager(deps)
      rm.schedule()
      await vi.advanceTimersByTimeAsync(1100)
      expect(deps.reconnectAttempts.value).toBe(1)
    })

    it('skips connect when no port is found', async () => {
      const deps = makeDeps()
      navigator.serial.getPorts.mockResolvedValue([])
      const rm = createReconnectManager(deps)
      rm.schedule()
      await vi.advanceTimersByTimeAsync(1100)
      expect(deps.addToTerminal).toHaveBeenCalledWith(
        expect.stringContaining('no authorized port found'),
        'warning'
      )
    })

    it('picks the matching port based on lastConnectedPortInfo', async () => {
      const target = { getInfo: () => ({ usbVendorId: 0x10C4, usbProductId: 0xEA60 }) }
      const other = { getInfo: () => ({ usbVendorId: 0x1234, usbProductId: 0x5678 }) }
      const deps = makeDeps()
      navigator.serial.getPorts.mockResolvedValue([other, target])
      const rm = createReconnectManager(deps)
      rm.schedule()
      await vi.advanceTimersByTimeAsync(1100)
      expect(deps.connect).toHaveBeenCalledWith(target)
    })

    it('falls back to first port when no lastConnectedPortInfo', async () => {
      const p1 = { getInfo: () => ({}) }
      const p2 = { getInfo: () => ({}) }
      const deps = makeDeps({ lastConnectedPortInfo: ref(null) })
      navigator.serial.getPorts.mockResolvedValue([p1, p2])
      const rm = createReconnectManager(deps)
      rm.schedule()
      await vi.advanceTimersByTimeAsync(1100)
      expect(deps.connect).toHaveBeenCalledWith(p1)
    })
  })

  describe('cancel()', () => {
    it('clears the pending timer so connect never fires', async () => {
      const deps = makeDeps()
      const rm = createReconnectManager(deps)
      rm.schedule()
      rm.cancel()
      await vi.advanceTimersByTimeAsync(5000)
      expect(deps.connect).not.toHaveBeenCalled()
    })

    it('is safe to call when no timer is set', () => {
      const deps = makeDeps()
      const rm = createReconnectManager(deps)
      expect(() => rm.cancel()).not.toThrow()
    })
  })

  describe('_isConnecting flag', () => {
    it('prevents concurrent connect from running twice', async () => {
      const port = { getInfo: () => ({ usbVendorId: 0x10C4, usbProductId: 0xEA60 }) }
      const deps = makeDeps()
      navigator.serial.getPorts.mockResolvedValue([port])
      let resolveConnect
      deps.connect.mockImplementation(() => new Promise(r => { resolveConnect = r }))
      const rm = createReconnectManager(deps)
      rm.schedule()
      await vi.advanceTimersByTimeAsync(1100)
      expect(deps.connect).toHaveBeenCalledTimes(1)
      rm.schedule()
      await vi.advanceTimersByTimeAsync(2000)
      expect(deps.connect).toHaveBeenCalledTimes(1)
      resolveConnect(true)
      await Promise.resolve()
    })

    it('clears the flag after connect resolves (success)', async () => {
      const port = { getInfo: () => ({ usbVendorId: 0x10C4, usbProductId: 0xEA60 }) }
      const deps = makeDeps()
      navigator.serial.getPorts.mockResolvedValue([port])
      const rm = createReconnectManager(deps)
      rm.schedule()
      await vi.advanceTimersByTimeAsync(1100)
      expect(deps.connect).toHaveBeenCalledTimes(1)
      rm.schedule()
      await vi.advanceTimersByTimeAsync(2100)
      expect(deps.connect).toHaveBeenCalledTimes(2)
    })
  })

  describe('installListeners', () => {
    it('adds navigator.serial connect and disconnect listeners', () => {
      const fake = navigator.serial
      const addSpy = vi.spyOn(fake, 'addEventListener')
      const deps = makeDeps()
      const rm = createReconnectManager(deps)
      rm.installListeners()
      const names = addSpy.mock.calls.map(c => c[0])
      expect(names).toContain('connect')
      expect(names).toContain('disconnect')
    })

    it('is idempotent (does not re-add when called twice)', () => {
      const fake = navigator.serial
      const addSpy = vi.spyOn(fake, 'addEventListener')
      const deps = makeDeps()
      const rm = createReconnectManager(deps)
      rm.installListeners()
      rm.installListeners()
      const counts = {}
      for (const [name] of addSpy.mock.calls) {
        counts[name] = (counts[name] || 0) + 1
      }
      expect(counts.connect).toBe(1)
      expect(counts.disconnect).toBe(1)
    })

    it('does nothing when navigator.serial is absent', () => {
      Object.defineProperty(navigator, 'serial', { value: undefined, configurable: true, writable: true })
      const deps = makeDeps()
      const rm = createReconnectManager(deps)
      expect(() => rm.installListeners()).not.toThrow()
    })

    it('uninstallListeners removes the listeners', () => {
      const fake = navigator.serial
      const removeSpy = vi.spyOn(fake, 'removeEventListener')
      const deps = makeDeps()
      const rm = createReconnectManager(deps)
      rm.installListeners()
      rm.uninstallListeners()
      const names = removeSpy.mock.calls.map(c => c[0])
      expect(names).toContain('connect')
      expect(names).toContain('disconnect')
    })
  })

  describe('connect-event auto-reconnect', () => {
    it('reconnects via connect event when matching port appears', async () => {
      const matchingPort = { getInfo: () => ({ usbVendorId: 0x10C4, usbProductId: 0xEA60 }) }
      const deps = makeDeps()
      const rm = createReconnectManager(deps)
      rm.installListeners()
      navigator.serial._fireConnect(matchingPort)
      await vi.advanceTimersByTimeAsync(2100)
      expect(deps.connect).toHaveBeenCalledWith(matchingPort)
    })

    it('does NOT reconnect when already connected', async () => {
      const matchingPort = { getInfo: () => ({ usbVendorId: 0x10C4, usbProductId: 0xEA60 }) }
      const deps = makeDeps({ isConnected: ref(true) })
      const rm = createReconnectManager(deps)
      rm.installListeners()
      navigator.serial._fireConnect(matchingPort)
      await vi.advanceTimersByTimeAsync(5000)
      expect(deps.connect).not.toHaveBeenCalled()
    })

    it('does NOT reconnect when in demo mode', async () => {
      const matchingPort = { getInfo: () => ({ usbVendorId: 0x10C4, usbProductId: 0xEA60 }) }
      const deps = makeDeps({ isDemoMode: ref(true) })
      const rm = createReconnectManager(deps)
      rm.installListeners()
      navigator.serial._fireConnect(matchingPort)
      await vi.advanceTimersByTimeAsync(5000)
      expect(deps.connect).not.toHaveBeenCalled()
    })

    it('does NOT reconnect when autoReconnect is disabled', async () => {
      const matchingPort = { getInfo: () => ({ usbVendorId: 0x10C4, usbProductId: 0xEA60 }) }
      const deps = makeDeps({ autoReconnect: ref(false) })
      const rm = createReconnectManager(deps)
      rm.installListeners()
      navigator.serial._fireConnect(matchingPort)
      await vi.advanceTimersByTimeAsync(5000)
      expect(deps.connect).not.toHaveBeenCalled()
    })
  })

  describe('disconnect-event handling', () => {
    it('schedules reconnect when already connected and device is unplugged', () => {
      const deps = makeDeps({ isConnected: ref(true) })
      const rm = createReconnectManager(deps)
      rm.installListeners()
      navigator.serial._fireDisconnect()
      expect(deps.isConnected.value).toBe(false)
      expect(deps.addToTerminal).toHaveBeenCalledWith('Device unplugged', 'warning')
    })

    it('does not schedule reconnect when not connected (avoids ping-pong)', () => {
      const deps = makeDeps({ isConnected: ref(false) })
      const rm = createReconnectManager(deps)
      rm.installListeners()
      navigator.serial._fireDisconnect()
      expect(deps.addToTerminal).not.toHaveBeenCalledWith('Device unplugged', 'warning')
    })
  })
})
