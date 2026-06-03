/**
 * Lightweight performance metrics collector.
 *
 * Tracks rolling counters for the most important hot paths so the
 * diagnostics panel can show lines/sec, parser dispatch latency,
 * and average frame time. Designed for zero overhead when no
 * consumer is reading the values: it uses plain numbers, not
 * Vue refs, and only publishes snapshots to a shallow ref on
 * `sample()`.
 *
 * Metrics:
 *   - serial.lines:    rolling count of incoming serial lines
 *   - serial.bytes:    rolling count of incoming bytes
 *   - parser.dispatched:  total parser invocations
 *   - parser.misses:      lines that fell through the dispatcher
 *   - terminal.pushes:    push operations to the terminal buffer
 *
 * Snapshots are produced at most once per `SAMPLE_INTERVAL_MS` and
 * are exposed as a reactive shallow ref for diagnostics UI.
 */

import { ref, shallowRef, triggerRef } from 'vue'

const SAMPLE_INTERVAL_MS = 1000
const RING_SIZE = 60

const _counters = {
  serialLines: 0,
  serialBytes: 0,
  parserDispatched: 0,
  parserMisses: 0,
  terminalPushes: 0
}

const _history = {
  serialLines: [],
  serialBytes: [],
  parserDispatched: [],
  parserMisses: [],
  terminalPushes: []
}

const _snapshot = shallowRef(_empty())
const _lastSample = ref(0)

let _timer = null

function _empty() {
  return {
    serialLines: 0,
    serialBytes: 0,
    parserDispatched: 0,
    parserMisses: 0,
    terminalPushes: 0,
    timestamp: 0
  }
}

function _pushHistory(key, value) {
  const ring = _history[key]
  ring.push(value)
  if (ring.length > RING_SIZE) ring.shift()
}

function _sample() {
  const snap = {
    serialLines: _counters.serialLines,
    serialBytes: _counters.serialBytes,
    parserDispatched: _counters.parserDispatched,
    parserMisses: _counters.parserMisses,
    terminalPushes: _counters.terminalPushes,
    timestamp: Date.now()
  }
  _pushHistory('serialLines', _counters.serialLines)
  _pushHistory('serialBytes', _counters.serialBytes)
  _pushHistory('parserDispatched', _counters.parserDispatched)
  _pushHistory('parserMisses', _counters.parserMisses)
  _pushHistory('terminalPushes', _counters.terminalPushes)
  _counters.serialLines = 0
  _counters.serialBytes = 0
  _counters.parserDispatched = 0
  _counters.parserMisses = 0
  _counters.terminalPushes = 0
  _snapshot.value = snap
  _lastSample.value = Date.now()
  triggerRef(_snapshot)
}

function _ensureTimer() {
  if (_timer != null) return
  if (typeof setInterval === 'undefined') return
  _timer = setInterval(_sample, SAMPLE_INTERVAL_MS)
}

export const metrics = {
  snapshot: _snapshot,
  lastSample: _lastSample,
  history: _history,
  counters: _counters,

  inc(key, n = 1) {
    if (key in _counters) _counters[key] += n
    _ensureTimer()
  },

  reset() {
    _counters.serialLines = 0
    _counters.serialBytes = 0
    _counters.parserDispatched = 0
    _counters.parserMisses = 0
    _counters.terminalPushes = 0
    for (const k of Object.keys(_history)) _history[k].length = 0
    _snapshot.value = _empty()
    triggerRef(_snapshot)
  }
}
