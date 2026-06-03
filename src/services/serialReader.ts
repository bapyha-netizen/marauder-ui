import { metrics } from '../utils/metrics'

const RAW_BUFFER_MAX = 65536
const RAW_BUFFER_TRIM_TO = 32768

interface SerialReaderPort {
  readable: ReadableStream<Uint8Array> | null
}

export function createSerialReader() {
  let _reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  let _active = false
  let _listenPromise: Promise<void> | null = null

  const isActive = (): boolean => _active

  const start = (port: SerialReaderPort, sink: (line: string) => void): Promise<void> => {
    if (!port || !port.readable) return Promise.resolve()
    _active = true
    const txtDecoder = new TextDecoder()
    let buffer = ''
    _listenPromise = (async () => {
      _reader = port.readable!.getReader()
      try {
        while (_active) {
          const { value, done } = await _reader.read()
          if (done) break
          if (value) {
            const text = txtDecoder.decode(value, { stream: true })
            buffer += text
            metrics.inc('serialBytes', text.length)
            if (buffer.length > RAW_BUFFER_MAX) {
              buffer = buffer.slice(-RAW_BUFFER_TRIM_TO)
            }
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed) {
                metrics.inc('serialLines', 1)
                sink(trimmed)
              }
            }
          }
        }
      } finally {
        try { _reader?.releaseLock() } catch (_) { /* ignore */ }
        _reader = null
        _active = false
      }
    })()
    return _listenPromise
  }

  const stop = async (): Promise<void> => {
    _active = false
    if (_reader) {
      try { await _reader.cancel() } catch (_) { /* ignore */ }
    }
    if (_listenPromise) {
      try { await _listenPromise } catch (_) { /* ignore */ }
      _listenPromise = null
    }
  }

  return { start, stop, isActive }
}

export type SerialReader = ReturnType<typeof createSerialReader>
