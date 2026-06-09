import { metrics } from '../utils/metrics'
import { logger } from '../utils/logger'

const RAW_BUFFER_MAX = 65536
const RAW_BUFFER_TRIM_TO = 32768
const MAX_LINE_LENGTH = 4096 // Prevent extremely long lines from consuming too much memory

type SerialReaderPort = Pick<SerialPort, 'readable'>

// Optimized UTF-8 boundary detection with bit masks for better performance
function findLastUtf8Boundary(buf: Uint8Array, limit: number): number {
  const startIdx = Math.max(buf.length - limit, 0)
  
  // Fast path: if we're already at or below the limit, return full length
  if (startIdx >= buf.length - limit) {
    return buf.length
  }
  
  // Use lookup table for common ASCII and UTF-8 patterns
  const utf8StartMasks = [0x80, 0xC0, 0xE0, 0xF0]
  const utf8ContinuationMask = 0xC0
  
  let end = startIdx
  
  // Scan forward to find the next safe boundary
  while (end < buf.length) {
    const byte = buf[end]
    
    // ASCII character - safe boundary
    if (byte < 0x80) break
    
    // Check for UTF-8 start byte
    let isStartByte = false
    for (const mask of utf8StartMasks) {
      if ((byte & mask) === mask) {
        isStartByte = true
        break
      }
    }
    
    if (isStartByte) break
    
    // Check for continuation byte (should not happen at this point)
    if ((byte & utf8ContinuationMask) === utf8ContinuationMask) {
      end++
      continue
    }
    
    end++
  }
  
  // Back up to ensure we don't cut in the middle of a multi-byte character
  while (end > startIdx) {
    const byte = buf[end - 1]
    
    // ASCII character - safe to cut
    if (byte < 0x80) break
    
    // Start of a new character - safe to cut
    if ((byte & utf8ContinuationMask) !== utf8ContinuationMask) break
    
    end--
  }
  
  return end
}

export function createSerialReader() {
  let _reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  let _active = false
  let _listenPromise: Promise<void> | null = null
  let _bufferTrimLogged = false
  let _onTrimNotice: ((msg: string) => void) | null = null

  const isActive = (): boolean => _active

  const start = (port: SerialReaderPort, sink: (line: string) => void, options?: { onTrimNotice?: (msg: string) => void }): Promise<void> => {
    if (!port || !port.readable) return Promise.resolve()
    _active = true
    _bufferTrimLogged = false
    _onTrimNotice = options?.onTrimNotice ?? null

    _listenPromise = (async () => {
      _reader = port.readable!.getReader()
      const streamDecoder = new TextDecoder('utf-8')
      let textBuffer = ''
      try {
        while (_active) {
          const { value, done } = await _reader.read()
          if (done) break
          if (value) {
            metrics.inc('serialBytes', value.length)
            textBuffer += streamDecoder.decode(value, { stream: true })

            const lines = textBuffer.split('\n')
            textBuffer = lines.pop() || ''

            let linesProcessed = 0
            for (const line of lines) {
              const clean = line.replace(/\r$/, '').trim()
              if (!clean) continue
              if (clean.length > MAX_LINE_LENGTH) {
                metrics.inc('serialLinesTruncated', 1)
              }
              try {
                metrics.inc('serialLines', 1)
                sink(clean)
                linesProcessed++
              } catch (e) {
                metrics.inc('serialDecodeErrors', 1)
                logger.warn('Failed to process line', e, 'serialReader')
              }
            }

            if (textBuffer.length > RAW_BUFFER_MAX) {
              _onTrimNotice?.(`Text buffer overflow — ${textBuffer.length} chars pending, clearing`)
              textBuffer = textBuffer.slice(-RAW_BUFFER_TRIM_TO)
              metrics.inc('serialBufferTrimmed', 1)
            }
          }
        }
      } finally {
        try { _reader?.releaseLock() } catch (e) { 
          logger.warn('Failed to release reader lock', e, 'serialReader')
        }
        _reader = null
        _active = false
      }
    })()
    return _listenPromise
  }

  const stop = async (): Promise<void> => {
    _active = false
    if (_reader) {
      try { await _reader.cancel() } catch (e) { 
        logger.warn('Failed to cancel reader', e, 'serialReader')
      }
    }
    if (_listenPromise) {
      try { await _listenPromise } catch (e) { 
        logger.warn('Failed to await listen promise', e, 'serialReader')
      }
      _listenPromise = null
    }
  }

  return { start, stop, isActive }
}

export type SerialReader = ReturnType<typeof createSerialReader>
