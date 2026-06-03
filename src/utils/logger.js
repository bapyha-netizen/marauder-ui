/**
 * Lightweight ring-buffer logger.
 *
 * Replaces ad-hoc `console.warn` / `console.error` calls scattered
 * across stores and services. The buffer is exposed as a reactive
 * ref so the UI can show a diagnostics panel without coupling to
 * any specific store.
 *
 * Levels:
 *   - debug  (off by default)
 *   - info
 *   - warn
 *   - error
 *
 * Output sinks:
 *   - browser console (matching level)
 *   - in-memory ring buffer (last N entries, default 500)
 *
 * Enable debug verbosity by calling `setLogLevel('debug')` from
 * the diagnostics panel or the browser console.
 */

import { ref, shallowRef, triggerRef } from 'vue'

const LEVELS = ['debug', 'info', 'warn', 'error']
const DEFAULT_LEVEL = 'info'
const DEFAULT_CAPACITY = 500

const _buffer = []
const _capacity = DEFAULT_CAPACITY
const _level = ref(DEFAULT_LEVEL)
const _entries = shallowRef([])

let _seq = 0

function _shouldLog(level) {
  const a = LEVELS.indexOf(level)
  const b = LEVELS.indexOf(_level.value)
  return a >= 0 && b >= 0 && a >= b
}

function _push(level, tag, message, data) {
  if (!_shouldLog(level)) return
  const entry = {
    id: ++_seq,
    ts: new Date().toISOString(),
    level,
    tag: tag || 'app',
    message: typeof message === 'string' ? message : safeStringify(message),
    data: data == null ? null : data
  }
  _buffer.push(entry)
  if (_buffer.length > _capacity) _buffer.splice(0, _buffer.length - _capacity)
  _entries.value = _buffer.slice()
  triggerRef(_entries)

  const fn = level === 'error' ? console.error
    : level === 'warn' ? console.warn
    : level === 'debug' ? console.debug
    : console.info
  if (data != null) fn(`[${entry.tag}] ${entry.message}`, data)
  else fn(`[${entry.tag}] ${entry.message}`)
}

function safeStringify(v) {
  try {
    if (typeof v === 'string') return v
    return JSON.stringify(v)
  } catch (_) {
    return String(v)
  }
}

export const logger = {
  debug: (msg, data, tag) => _push('debug', tag, msg, data),
  info:  (msg, data, tag) => _push('info',  tag, msg, data),
  warn:  (msg, data, tag) => _push('warn',  tag, msg, data),
  error: (msg, data, tag) => _push('error', tag, msg, data),
  entries: _entries,
  level: _level,
  setLogLevel(l) {
    if (LEVELS.includes(l)) _level.value = l
  },
  clear() {
    _buffer.length = 0
    _entries.value = []
    triggerRef(_entries)
  }
}
