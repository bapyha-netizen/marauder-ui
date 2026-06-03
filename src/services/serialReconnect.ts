import { logger } from '../utils/logger'

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000]
const MAX_RECONNECT_ATTEMPTS = 6

interface ReconnectDeps {
  isConnected: { value: boolean }
  isDemoMode: { value: boolean }
  autoReconnect: { value: boolean }
  reconnectAttempts: { value: number }
  lastConnectedPortInfo: { value: { usbVendorId?: number; usbProductId?: number } | null }
  connect: (port?: any) => Promise<boolean>
  addToTerminal: (text: string, type?: string) => void
}

interface NavigatorListeners {
  conn: (event: Event) => void
  disc: () => void
}

export function createReconnectManager(deps: ReconnectDeps) {
  let _reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let _navigatorListeners: NavigatorListeners | null = null

  const cancel = (): void => {
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer)
      _reconnectTimer = null
    }
  }

  const installListeners = (): void => {
    if (!navigator.serial || _navigatorListeners) return
    const connHandler = (event: Event) => {
      const e = event as unknown as { port: { getInfo?: () => { usbVendorId?: number; usbProductId?: number } } }
      if (deps.isConnected.value || deps.isDemoMode.value) return
      if (!deps.autoReconnect.value) return
      const newPort = e.port
      const newInfo = newPort.getInfo?.() || {}
      if (deps.lastConnectedPortInfo.value
        && newInfo.usbVendorId === deps.lastConnectedPortInfo.value.usbVendorId
        && newInfo.usbProductId === deps.lastConnectedPortInfo.value.usbProductId) {
        deps.addToTerminal('Device plugged in — attempting immediate reconnect', 'system')
        cancel()
        deps.reconnectAttempts.value = 0
        deps.connect(newPort).catch((e: Error) => {
          deps.addToTerminal(`Reconnect failed: ${e.message}`, 'error')
        })
      }
    }
    const discHandler = () => {
      if (deps.isConnected.value) {
        deps.addToTerminal('Device unplugged', 'warning')
        deps.isConnected.value = false
        schedule()
      }
    }
    navigator.serial.addEventListener('connect', connHandler as EventListener)
    navigator.serial.addEventListener('disconnect', discHandler)
    _navigatorListeners = { conn: connHandler as unknown as (event: Event) => void, disc: discHandler }
  }

  const uninstallListeners = (): void => {
    if (!navigator.serial || !_navigatorListeners) return
    navigator.serial.removeEventListener('connect', _navigatorListeners.conn as unknown as EventListener)
    navigator.serial.removeEventListener('disconnect', _navigatorListeners.disc)
    _navigatorListeners = null
  }

  const schedule = (): void => {
    if (!deps.autoReconnect.value) return
    if (deps.reconnectAttempts.value >= MAX_RECONNECT_ATTEMPTS) {
      deps.addToTerminal(`Auto-reconnect: gave up after ${MAX_RECONNECT_ATTEMPTS} attempts. Click Connect to retry.`, 'error')
      return
    }
    const delay = RECONNECT_DELAYS[Math.min(deps.reconnectAttempts.value, RECONNECT_DELAYS.length - 1)]
    const attempt = deps.reconnectAttempts.value + 1
    deps.addToTerminal(`Auto-reconnect: attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s...`, 'warning')
    _reconnectTimer = setTimeout(async () => {
      _reconnectTimer = null
      deps.reconnectAttempts.value = attempt
      try {
        let targetPort: any = null
        const ports = await navigator.serial.getPorts()
        if (deps.lastConnectedPortInfo.value) {
          targetPort = ports.find((p: any) => {
            const info = p.getInfo?.()
            if (!info || !deps.lastConnectedPortInfo.value) return false
            return info.usbVendorId === deps.lastConnectedPortInfo.value.usbVendorId
              && info.usbProductId === deps.lastConnectedPortInfo.value.usbProductId
          })
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
        deps.addToTerminal(`Auto-reconnect: ${(e as Error).message}`, 'error')
        schedule()
      }
    }, delay)
  }

  return { cancel, schedule, installListeners, uninstallListeners }
}

export type ReconnectManager = ReturnType<typeof createReconnectManager>
