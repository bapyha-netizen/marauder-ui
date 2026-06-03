import { ref, shallowRef, triggerRef } from 'vue'

const SAMPLE_INTERVAL_MS = 1000
const RING_SIZE = 60

interface MetricSnapshot {
  serialLines: number
  serialBytes: number
  parserDispatched: number
  parserMisses: number
  terminalPushes: number
  timestamp: number
}

interface MetricCounters {
  serialLines: number
  serialBytes: number
  parserDispatched: number
  parserMisses: number
  terminalPushes: number
}

type MetricKey = keyof MetricCounters

const _counters: MetricCounters = {
  serialLines: 0,
  serialBytes: 0,
  parserDispatched: 0,
  parserMisses: 0,
  terminalPushes: 0
}

const _history: Record<MetricKey, number[]> = {
  serialLines: [],
  serialBytes: [],
  parserDispatched: [],
  parserMisses: [],
  terminalPushes: []
}

function _empty(): MetricSnapshot {
  return { serialLines: 0, serialBytes: 0, parserDispatched: 0, parserMisses: 0, terminalPushes: 0, timestamp: 0 }
}

const _snapshot = shallowRef<MetricSnapshot>(_empty())
const _lastSample = ref(0)

let _timer: ReturnType<typeof setInterval> | null = null

function _pushHistory(key: MetricKey, value: number): void {
  const ring = _history[key]
  ring.push(value)
  if (ring.length > RING_SIZE) ring.shift()
}

function _sample(): void {
  const snap: MetricSnapshot = {
    serialLines: _counters.serialLines,
    serialBytes: _counters.serialBytes,
    parserDispatched: _counters.parserDispatched,
    parserMisses: _counters.parserMisses,
    terminalPushes: _counters.terminalPushes,
    timestamp: Date.now()
  }
  for (const key of Object.keys(_counters) as MetricKey[]) {
    _pushHistory(key, _counters[key])
    _counters[key] = 0
  }
  _snapshot.value = snap
  _lastSample.value = Date.now()
  triggerRef(_snapshot)
}

function _ensureTimer(): void {
  if (_timer != null) return
  if (typeof setInterval === 'undefined') return
  _timer = setInterval(_sample, SAMPLE_INTERVAL_MS)
}

export const metrics = {
  snapshot: _snapshot,
  lastSample: _lastSample,
  history: _history,
  counters: _counters,

  inc(key: MetricKey, n: number = 1): void {
    if (key in _counters) _counters[key] += n
    _ensureTimer()
  },

  reset(): void {
    for (const key of Object.keys(_counters) as MetricKey[]) {
      _counters[key] = 0
      _history[key].length = 0
    }
    _snapshot.value = _empty()
    triggerRef(_snapshot)
  }
}
