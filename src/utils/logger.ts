import { ref, shallowRef, triggerRef } from 'vue'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  id: number
  ts: string
  level: LogLevel
  tag: string
  message: string
  data: unknown
}

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']
const DEFAULT_LEVEL: LogLevel = 'info'
const DEFAULT_CAPACITY = 500

const _buffer: LogEntry[] = []
const _level = ref<LogLevel>(DEFAULT_LEVEL)
const _entries = shallowRef<LogEntry[]>([])

let _seq = 0

function _shouldLog(level: LogLevel): boolean {
  const a = LEVELS.indexOf(level)
  const b = LEVELS.indexOf(_level.value)
  return a >= 0 && b >= 0 && a >= b
}

function safeStringify(v: unknown): string {
  // Q-12: tolerate circular structures, BigInt, and other non-JSON values
  // by falling back to String(). Avoids throwing into callers that
  // expected a best-effort stringification.
  try {
    if (typeof v === 'string') return v
    return JSON.stringify(v, (_k, val) => {
      if (typeof val === 'bigint') return val.toString() + 'n'
      return val
    })
  } catch (_) {
    try { return String(v) } catch { return '[unserializable]' }
  }
}

// R-15: _logRafScheduled is module-level on purpose. We only ever have one
// in-flight animation frame for log updates; queueing more would be wasted
// work. Because the module is a singleton in the bundle, the flag is shared
// across the whole app and persists for the lifetime of the page (HMR may
// reset it, which is the desired behavior in dev).
let _logRafScheduled = false

function _scheduleLogUpdate(): void {
  if (_logRafScheduled) return
  _logRafScheduled = true
  requestAnimationFrame(() => {
    _entries.value = _buffer.slice()
    triggerRef(_entries)
    _logRafScheduled = false
  })
}

function _push(level: LogLevel, tag: string | undefined, message: unknown, data?: unknown): void {
  if (!_shouldLog(level)) return
  const entry: LogEntry = {
    id: ++_seq,
    ts: new Date().toISOString(),
    level,
    tag: tag || 'app',
    message: typeof message === 'string' ? message : safeStringify(message),
    data: data ?? null
  }
  _buffer.push(entry)
  if (_buffer.length > DEFAULT_CAPACITY) _buffer.splice(0, _buffer.length - DEFAULT_CAPACITY)
  _scheduleLogUpdate()

  // Silently log errors - no console leaks
  const fn = () => {} // Silent logging
}

export const logger = {
  debug: (msg: unknown, data?: unknown, tag?: string) => _push('debug', tag, msg, data),
  info:  (msg: unknown, data?: unknown, tag?: string) => _push('info',  tag, msg, data),
  warn:  (msg: unknown, data?: unknown, tag?: string) => _push('warn',  tag, msg, data),
  error: (msg: unknown, data?: unknown, tag?: string) => _push('error', tag, msg, data),
  entries: _entries,
  level: _level,
  setLogLevel(l: LogLevel): void {
    if (LEVELS.includes(l)) _level.value = l
  },
  clear(): void {
    _buffer.length = 0
    _entries.value = []
    triggerRef(_entries)
  }
}
