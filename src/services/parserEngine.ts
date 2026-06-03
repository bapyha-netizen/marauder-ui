import { useApStore } from '../stores/apStore'
import { useBleStore } from '../stores/bleStore'
import { useDashboardStore } from '../stores/dashboardStore'
import { DISPATCH, FALLBACK_PARSERS, resetState as profileReset } from './firmwareProfiles/marauderV1'
import type { ParserContext } from '../types/parser'
import { metrics } from '../utils/metrics'

const CLEANUP_INTERVAL = 30000
const AP_MAX_AGE = 300000

let intervalId: ReturnType<typeof setInterval> | null = null

export function startParser(): void {
  if (intervalId) return
  intervalId = setInterval(() => {
    try {
      useApStore().removeOldAPs(AP_MAX_AGE)
    } catch (_) { /* ignore */ }
  }, CLEANUP_INTERVAL)
}

export function stopParser(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

export function resetParserState(): void {
  profileReset()
}

export function parseLine(line: string): void {
  if (!line || !line.trim()) return
  const trimmed = line.trim()
  if (trimmed.startsWith('> ')) return

  metrics.inc('parserDispatched', 1)

  const ctx: ParserContext = {
    apStore: useApStore(),
    bleStore: useBleStore(),
    dashStore: useDashboardStore()
  }

  const first = trimmed.charCodeAt(0)
  const buckets = DISPATCH[first]
  if (buckets) {
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i](trimmed, ctx)) return
    }
  }
  for (let i = 0; i < FALLBACK_PARSERS.length; i++) {
    if (FALLBACK_PARSERS[i](trimmed, ctx)) return
  }
  metrics.inc('parserMisses', 1)
}

export function parseDemoAP(): void {
  const store = useApStore()
  const PREFIXES = ['Home-', 'WiFi-', 'Network-', 'Guest-', 'Office-', 'IoT-']
  for (let i = 0; i < 10 + Math.floor(Math.random() * 15); i++) {
    const mac = Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join(':').toUpperCase()
    store.updateOrAddAP({
      index: i,
      bssid: mac,
      essid: PREFIXES[Math.floor(Math.random() * PREFIXES.length)] +
        Math.floor(Math.random() * 9999).toString().padStart(4, '0'),
      rssi: -(Math.floor(Math.random() * 60) + 30),
      channel: Math.floor(Math.random() * 13) + 1,
      isHidden: Math.random() < 0.1,
      isSelected: Math.random() < 0.2,
      vendor: '',
      lastSeen: new Date()
    })
  }
}

export function parseDemoBLE(): void {
  const store = useBleStore()
  const names = ['iPhone', 'AirPods', 'Apple Watch', 'Samsung Galaxy', 'Fitbit', 'AirTag']
  for (let i = 0; i < 5 + Math.floor(Math.random() * 8); i++) {
    const mac = Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join(':').toUpperCase()
    const name = names[Math.floor(Math.random() * names.length)]
    store.updateOrAddDevice({
      mac,
      name: `${name} ${Math.floor(Math.random() * 1000)}`,
      rssi: -(Math.floor(Math.random() * 70) + 30),
      isAirtag: name === 'AirTag',
      lastSeen: new Date()
    })
  }
}

export function parseDemoPacketCounts(): void {
  useDashboardStore().setPacketCounts({
    beacon: Math.floor(Math.random() * 500) + 100,
    probe: Math.floor(Math.random() * 200) + 50,
    deauth: Math.floor(Math.random() * 100) + 10,
    eapol: Math.floor(Math.random() * 30) + 5,
    data: Math.floor(Math.random() * 1000) + 200,
    management: Math.floor(Math.random() * 300) + 50
  })
}

export function parseDemoChannelUtil(): void {
  const store = useDashboardStore()
  const util: Record<number, number> = {}
  for (let ch = 1; ch <= 13; ch++) {
    util[ch] = Math.floor(Math.random() * 200)
  }
  store.setChannelUtilization(util)
}
