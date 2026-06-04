import { logger } from '../utils/logger'

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000]
const MAX_RECONNECT_ATTEMPTS = 6

interface ReconnectDeps {
  isConnected: { value: boolean }
  isDemoMode: { value: boolean }
  autoReconnect: { value: boolean }
  reconnectAttempts: { value: number }
  lastConnectedPortInfo: { value: { usbVendorId?: number; usbProductId?: number } | null }
  connect: (port?: SerialPort | null) => Promise<boolean>
  addToTerminal: (text: string, type?: string) => void
}

interface NavigatorListeners {
  conn: (event: Event) => void
  disc: () => void
}

export function createReconnectManager(deps: ReconnectDeps) {
  let _reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let _connectWaitTimer: ReturnType<typeof setTimeout> | null = null
  let _navigatorListeners: NavigatorListeners | null = null
  let _isConnecting = false

  const cancel = (): void => {
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer)
      _reconnectTimer = null
    }
    if (_connectWaitTimer) {
      clearTimeout(_connectWaitTimer)
      _connectWaitTimer = null
    }
  }

  const installListeners = (): void => {
    if (!navigator.serial || _navigatorListeners) return
    const connHandler = (event: Event) => {
      const customEvent = event as CustomEvent
      const port = customEvent.detail?.port
      if (!port) return
      if (deps.isConnected.value || deps.isDemoMode.value) return
      if (!deps.autoReconnect.value) return
      const newPort = port
      const newInfo = newPort.getInfo?.() || {}
      if (deps.lastConnectedPortInfo.value
        && newInfo.usbVendorId === deps.lastConnectedPortInfo.value.usbVendorId
        && newInfo.usbProductId === deps.lastConnectedPortInfo.value.usbProductId) {
        deps.addToTerminal('Device plugged in — waiting for firmware to boot...', 'system')
        cancel()
        deps.reconnectAttempts.value = 0
        // Clear any existing connection wait timer to prevent duplicates
        if (_connectWaitTimer) {
          clearTimeout(_connectWaitTimer)
          _connectWaitTimer = null
        }
        _connectWaitTimer = setTimeout(() => {
          _connectWaitTimer = null
          if (_isConnecting) return
          _isConnecting = true
          deps.connect(newPort).catch((e: Error) => {
            _isConnecting = false
            deps.addToTerminal(`Reconnect failed: ${e.message}`, 'error')
          })
        }, 2000)
      }
    }
    const discHandler = () => {
      // Q-08: defensive guard — disconnect events can fire when the page is
      // backgrounded or the navigator is mid-shutdown, even though we
      // already called uninstallListeners. No-op if the manager was torn
      // down (autoReconnect disabled, etc.) to avoid scheduling a reconnect
      // from a half-disposed state.
      if (!deps.autoReconnect.value) return
      if (deps.isConnected.value) {
        deps.addToTerminal('Device unplugged', 'warning')
        deps.isConnected.value = false
        schedule()
      }
    }
    navigator.serial.addEventListener('connect', connHandler)
    navigator.serial.addEventListener('disconnect', discHandler)
    _navigatorListeners = { conn: connHandler, disc: discHandler }
  }

  const uninstallListeners = (): void => {
    if (!navigator.serial || !_navigatorListeners) return
    navigator.serial.removeEventListener('connect', _navigatorListeners.conn)
    navigator.serial.removeEventListener('disconnect', _navigatorListeners.disc)
    _navigatorListeners = null
    if (_connectWaitTimer) {
      clearTimeout(_connectWaitTimer)
      _connectWaitTimer = null
    }
  }

  const schedule = (): void => {
    if (!deps.autoReconnect.value) return
    if (deps.reconnectAttempts.value >= MAX_RECONNECT_ATTEMPTS) {
      deps.addToTerminal(`Auto-reconnect: gave up after ${MAX_RECONNECT_ATTEMPTS} attempts. Click Connect to retry.`, 'error')
      return
    }
    
    // Clear any existing reconnect timer to prevent duplicates
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer)
      _reconnectTimer = null
    }
    
    const delay = RECONNECT_DELAYS[Math.min(deps.reconnectAttempts.value, RECONNECT_DELAYS.length - 1)]
    const attempt = deps.reconnectAttempts.value + 1
    deps.addToTerminal(`Auto-reconnect: attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s...`, 'warning')
    _reconnectTimer = setTimeout(async () => {
      _reconnectTimer = null
      if (_isConnecting) return
      deps.reconnectAttempts.value = attempt
      _isConnecting = true
      try {
        let targetPort: SerialPort | null = null
        const serialApi = navigator.serial
        if (!serialApi) {
          deps.addToTerminal('Auto-reconnect: Web Serial API not available', 'error')
          return
        }
        const ports = await serialApi.getPorts()
        if (deps.lastConnectedPortInfo.value) {
          targetPort = ports.find((p: SerialPort) => {
            const info = p.getInfo?.()
            if (!info || !deps.lastConnectedPortInfo.value) return false
            return info.usbVendorId === deps.lastConnectedPortInfo.value.usbVendorId
              && info.usbProductId === deps.lastConnectedPortInfo.value.usbProductId
          }) ?? null
        }
        if (!targetPort && ports.length > 0) targetPort = ports[0]
        if (!targetPort) {
          deps.addToTerminal('Auto-reconnect: no authorized port found, click Connect', 'warning')
          return
        }
        await deps.connect(targetPort)
        deps.addToTerminal(`Auto-reconnect: reconnected on attempt ${attempt}`, 'success')
        logger.info('reconnect success', { attempt })
      } catch (e) {
        deps.addToTerminal(`Auto-reconnect: ${e instanceof Error ? e.message : String(e)}`, 'error')
        schedule()
      } finally {
        _isConnecting = false
      }
    }, delay)
  }

  const dispose = (): void => {
    cancel()
    uninstallListeners()
  }

  return { cancel, schedule, installListeners, uninstallListeners, dispose }
}

export type ReconnectManager = ReturnType<typeof createReconnectManager>
