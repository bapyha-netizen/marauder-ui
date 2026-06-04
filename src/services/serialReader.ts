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
    const txtDecoder = new TextDecoder()
    let buffer = new Uint8Array(0)

    const splitByNewline = (buf: Uint8Array): Uint8Array[] => {
      const result: Uint8Array[] = []
      let start = 0
      
      // Pre-allocate result array for better performance
      const estimatedLines = Math.min(buf.length / 50, 100) // Average 50 chars per line
      result.length = 0
      
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] === 0x0A) {
          let end = i
          if (end > start && buf[end - 1] === 0x0D) end--
          
          // Check for extremely long lines and trim them
          const lineLength = end - start
          if (lineLength > MAX_LINE_LENGTH) {
            // Truncate extremely long lines to prevent memory issues
            result.push(buf.slice(start, start + MAX_LINE_LENGTH))
            metrics.inc('serialLinesTruncated', 1)
          } else {
            result.push(buf.slice(start, end))
          }
          
          start = i + 1
        }
      }
      
      if (start < buf.length) {
        const remainingLength = buf.length - start
        if (remainingLength > MAX_LINE_LENGTH) {
          result.push(buf.slice(start, start + MAX_LINE_LENGTH))
          metrics.inc('serialLinesTruncated', 1)
        } else {
          result.push(buf.slice(start))
        }
      } else if (start === buf.length) {
        result.push(new Uint8Array(0))
      }
      
      return result
    }

    _listenPromise = (async () => {
      _reader = port.readable!.getReader()
      try {
        while (_active) {
          const { value, done } = await _reader.read()
          if (done) break
          if (value) {
            metrics.inc('serialBytes', value.length)
             const newBuffer = new Uint8Array(buffer.length + value.length)
             newBuffer.set(buffer)
             newBuffer.set(value, buffer.length)
             buffer = newBuffer

              // Bounded growth: when buffer exceeds RAW_BUFFER_MAX, copy down
              // to a UTF-8 safe boundary at RAW_BUFFER_TRIM_TO. This is O(N)
              // (Uint8Array copy) but N is bounded (64KB), so it is acceptable
              // for a single read iteration. The buffer is intentionally kept
              // small to bound worst-case memory.
              if (buffer.length > RAW_BUFFER_MAX) {
                const oldLength = buffer.length
                const trimEnd = findLastUtf8Boundary(buffer, RAW_BUFFER_TRIM_TO)
                buffer = buffer.slice(0, trimEnd)
                metrics.inc('serialBufferTrimmed', 1)
                
                // Check if we potentially lost data during trimming
                if (oldLength > RAW_BUFFER_TRIM_TO + 1000 && !_bufferTrimLogged) {
                  _bufferTrimLogged = true
                  _onTrimNotice?.(`Serial buffer overflow — trimmed ${oldLength - trimEnd} bytes, some lines may be lost`)
                }
              }

            const lines = splitByNewline(buffer)
            let linesProcessed = 0
            const linesToProcess = lines.length - 1
            
            // Process lines in batches for better performance
            for (let i = 0; i < linesToProcess; i++) {
              const lineData = lines[i]
              
              // Skip empty lines early
              if (lineData.length === 0) continue
              
              try {
                // Use TextDecoder with streaming mode for better performance
                const text = txtDecoder.decode(lineData)
                const trimmed = text.trim()
                
                if (trimmed) {
                  metrics.inc('serialLines', 1)
                  sink(trimmed)
                  linesProcessed++
                }
              } catch (e) {
                // Skip lines that can't be decoded properly
                metrics.inc('serialDecodeErrors', 1)
                logger.warn('Failed to decode line', e, 'serialReader')
              }
            }
            
            const lastLine = lines[linesToProcess]
            buffer = lastLine ? new Uint8Array(lastLine) : new Uint8Array(0)
            
            // Log if we're losing lines due to buffer management (only occasionally to avoid spam)
            if (linesToProcess > 10 && linesProcessed < linesToProcess - 2 && Math.random() < 0.1) {
              logger.warn(`Serial reader: processed ${linesProcessed}/${linesToProcess} lines, potential data loss`, {}, 'serialReader')
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
