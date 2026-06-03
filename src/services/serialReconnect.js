/**
 * Reconnect manager for the Web Serial layer.
 *
 * Owns the auto-reconnect state machine:
 *   - exponential-ish backoff via RECONNECT_DELAYS
 *   - device plug-in detection via `navigator.serial` events
 *   - last-known port matching by USB VID/PID
 *
 * The store delegates `connect`/`disconnect` to the connection
 * module and the read loop to the reader module; this file only
 * handles the "what happens when the cable wiggles" logic.
 */

import { logger } from '../utils/logger'

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000]
const MAX_RECONNECT_ATTEMPTS = 6

export function createReconnectManager({
  isConnected,
  isDemoMode,
  autoReconnect,
  reconnectAttempts,
  lastConnectedPortInfo,
  connect,
  addToTerminal
}) {
  let _reconnectTimer = null
  let _navigatorListeners = null
  let _onDeviceConnect = null
  let _onDeviceDisconnect = null

  const cancel = () => {
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer)
      _reconnectTimer = null
    }
  }

  const installListeners = () => {
    if (!navigator.serial || _navigatorListeners) return
    _onDeviceConnect = (event) => {
      if (isConnected.value || isDemoMode.value) return
      if (!autoReconnect.value) return
      const newPort = event.port
      const newInfo = newPort.getInfo?.() || {}
      if (lastConnectedPortInfo.value
        && newInfo.usbVendorId === lastConnectedPortInfo.value.usbVendorId
        && newInfo.usbProductId === lastConnectedPortInfo.value.usbProductId) {
        addToTerminal('Device plugged in — attempting immediate reconnect', 'system')
        cancel()
        reconnectAttempts.value = 0
        connect(newPort).catch(e => {
          addToTerminal(`Reconnect failed: ${e.message}`, 'error')
        })
      }
    }
    _onDeviceDisconnect = () => {
      if (isConnected.value) {
        addToTerminal('Device unplugged', 'warning')
        isConnected.value = false
        schedule()
      }
    }
    navigator.serial.addEventListener('connect', _onDeviceConnect)
    navigator.serial.addEventListener('disconnect', _onDeviceDisconnect)
    _navigatorListeners = { conn: _onDeviceConnect, disc: _onDeviceDisconnect }
  }

  const uninstallListeners = () => {
    if (!navigator.serial || !_navigatorListeners) return
    navigator.serial.removeEventListener('connect', _navigatorListeners.conn)
    navigator.serial.removeEventListener('disconnect', _navigatorListeners.disc)
    _navigatorListeners = null
    _onDeviceConnect = null
    _onDeviceDisconnect = null
  }

  const schedule = () => {
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
        logger.info('reconnect success', { attempt })
      } catch (e) {
        addToTerminal(`Auto-reconnect: ${e.message}`, 'error')
        schedule()
      }
    }, delay)
  }

  return {
    cancel,
    schedule,
    installListeners,
    uninstallListeners
  }
}
