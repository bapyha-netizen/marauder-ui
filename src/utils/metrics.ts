import { ref, shallowRef, triggerRef } from 'vue'

const SAMPLE_INTERVAL_MS = 1000
const RING_SIZE = 60

interface MetricSnapshot {
  serialLines: number
  serialBytes: number
  serialBufferTrimmed: number
  serialLinesTruncated: number
  serialDecodeErrors: number
  parserDispatched: number
  parserMisses: number
  terminalPushes: number
  timestamp: number
}

interface MetricCounters {
  serialLines: number
  serialBytes: number
  serialBufferTrimmed: number
  serialLinesTruncated: number
  serialDecodeErrors: number
  parserDispatched: number
  parserMisses: number
  terminalPushes: number
}

type MetricKey = keyof MetricCounters

const _counters: MetricCounters = {
  serialLines: 0,
  serialBytes: 0,
  serialBufferTrimmed: 0,
  serialLinesTruncated: 0,
  serialDecodeErrors: 0,
  parserDispatched: 0,
  parserMisses: 0,
  terminalPushes: 0
}

const _history: Record<MetricKey, number[]> = {
  serialLines: [],
  serialBytes: [],
  serialBufferTrimmed: [],
  serialLinesTruncated: [],
  serialDecodeErrors: [],
  parserDispatched: [],
  parserMisses: [],
  terminalPushes: []
}

function _empty(): MetricSnapshot {
  return { serialLines: 0, serialBytes: 0, serialBufferTrimmed: 0, serialLinesTruncated: 0, serialDecodeErrors: 0, parserDispatched: 0, parserMisses: 0, terminalPushes: 0, timestamp: 0 }
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
    serialBufferTrimmed: _counters.serialBufferTrimmed,
    serialLinesTruncated: _counters.serialLinesTruncated,
    serialDecodeErrors: _counters.serialDecodeErrors,
    parserDispatched: _counters.parserDispatched,
    parserMisses: _counters.parserMisses,
    terminalPushes: _counters.terminalPushes,
    timestamp: Date.now()
  }
  for (const key of Object.keys(_counters)) {
    _pushHistory(key as keyof MetricCounters, _counters[key as keyof MetricCounters])
    _counters[key as keyof MetricCounters] = 0
  }
  _snapshot.value = snap
  _lastSample.value = Date.now()
  triggerRef(_snapshot)
}

function _stopTimer(): void {
  if (_timer !== null) {
    clearInterval(_timer)
    _timer = null
  }
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

  stop(): void {
    _stopTimer()
  },

  reset(): void {
    _stopTimer()
for (const key of Object.keys(_counters)) {
      _counters[key as keyof MetricCounters] = 0
      _history[key as keyof MetricCounters].length = 0
    }
    _snapshot.value = _empty()
    triggerRef(_snapshot)
  }
}
