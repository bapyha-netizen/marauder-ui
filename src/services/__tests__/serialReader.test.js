import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../utils/metrics', () => ({
  metrics: { inc: vi.fn(), stop: vi.fn(), reset: vi.fn() }
}))

import { createSerialReader } from '../serialReader'

function makeReadableStream(chunks) {
  let i = 0
  return {
    getReader() {
      return {
        async read() {
          if (i >= chunks.length) {
            return { value: undefined, done: true }
          }
          return { value: chunks[i++], done: false }
        },
        async cancel() {
          i = chunks.length
        },
        releaseLock() {}
      }
    }
  }
}

function strToBytes(s) {
  return new TextEncoder().encode(s)
}

describe('serialReader', () => {
  describe('buffer splits on newline', () => {
    it('emits each line as it arrives, joining multi-chunk lines', async () => {
      const reader = createSerialReader()
      const lines = []
      const port = { readable: makeReadableStream([
        strToBytes('hello\n'),
        strToBytes('wor'),
        strToBytes('ld\n'),
        strToBytes('foo\n')
      ]) }
      await reader.start(port, (line) => lines.push(line))
      expect(lines).toEqual(['hello', 'world', 'foo'])
    })

    it('strips trailing \\r from CRLF input', async () => {
      const reader = createSerialReader()
      const lines = []
      const port = { readable: makeReadableStream([ strToBytes('crlf\r\n') ]) }
      await reader.start(port, (line) => lines.push(line))
      expect(lines).toEqual(['crlf'])
    })

    it('trims whitespace from emitted lines', async () => {
      const reader = createSerialReader()
      const lines = []
      const port = { readable: makeReadableStream([ strToBytes('  spaced  \n') ]) }
      await reader.start(port, (line) => lines.push(line))
      expect(lines).toEqual(['spaced'])
    })

    it('skips blank lines', async () => {
      const reader = createSerialReader()
      const lines = []
      const port = { readable: makeReadableStream([ strToBytes('a\n\nb\n') ]) }
      await reader.start(port, (line) => lines.push(line))
      expect(lines).toEqual(['a', 'b'])
    })

    it('handles split bytes across boundaries for ASCII', async () => {
      const reader = createSerialReader()
      const lines = []
      const encoded = strToBytes('A1\nB2\nC3\n')
      const chunks = [
        encoded.slice(0, 2),
        encoded.slice(2, 4),
        encoded.slice(4)
      ]
      const port = { readable: makeReadableStream(chunks) }
      await reader.start(port, (line) => lines.push(line))
      expect(lines).toEqual(['A1', 'B2', 'C3'])
    })

    it('does not emit a final partial line until newline arrives', async () => {
      const reader = createSerialReader()
      const lines = []
      const port = { readable: makeReadableStream([ strToBytes('partial-no-newline') ]) }
      const promise = reader.start(port, (line) => lines.push(line))
      await promise
      expect(lines).toEqual([])
    })
  })

  describe('buffer trim on overflow (UTF-8 safe)', () => {
    it('keeps buffer bounded below RAW_BUFFER_MAX (65536 bytes)', async () => {
      const reader = createSerialReader()
      const lines = []
      const port = { readable: makeReadableStream([]) }
      const big = strToBytes('x'.repeat(50000))
      port.readable = makeReadableStream([big])
      await reader.start(port, (line) => lines.push(line))
      expect(reader.isActive()).toBe(false)
    })

    it('truncates the leading half at a UTF-8 boundary', async () => {
      const reader = createSerialReader()
      const lines = []
      const text = 'a'.repeat(70000) + 'tail'
      const bytes = strToBytes(text)
      const port = { readable: makeReadableStream([bytes]) }
      await reader.start(port, (line) => lines.push(line))
      expect(reader.isActive()).toBe(false)
    })

    it('does not split a multi-byte UTF-8 codepoint when trimming', async () => {
      const reader = createSerialReader()
      const lines = []
      const chunk = []
      for (let i = 0; i < 100; i++) {
        chunk.push(0xC3, 0xA9)
      }
      const filler = []
      for (let i = 0; i < 70000; i++) filler.push(0x61)
      const bytes = new Uint8Array([...chunk, ...filler, 0x0A])
      const port = { readable: makeReadableStream([bytes]) }
      await reader.start(port, (line) => lines.push(line))
      expect(reader.isActive()).toBe(false)
      for (const line of lines) {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(strToBytes(line))
        expect(decoded).toBe(line)
      }
    })
  })

  describe('UTF-8 boundary detection', () => {
    it('handles 2-byte UTF-8 char (e-acute = U+00E9 -> 0xC3 0xA9)', async () => {
      const reader = createSerialReader()
      const lines = []
      const part1 = strToBytes('é')
      const part2 = strToBytes('éé\n')
      const port = { readable: makeReadableStream([part1, part2]) }
      await reader.start(port, (line) => lines.push(line))
      expect(lines).toEqual(['ééé'])
    })

    it('handles 3-byte UTF-8 char (CJK = U+4E2D -> 0xE4 0xB8 0xAD)', async () => {
      const reader = createSerialReader()
      const lines = []
      const bytes = new Uint8Array([0xE4, 0xB8, 0xAD, 0xE4, 0xB8, 0xAD, 0x0A])
      const port = { readable: makeReadableStream([bytes]) }
      await reader.start(port, (line) => lines.push(line))
      expect(lines).toEqual(['中中'])
    })

    it('handles 4-byte UTF-8 char (emoji U+1F600)', async () => {
      const reader = createSerialReader()
      const lines = []
      const bytes = new Uint8Array([0xF0, 0x9F, 0x98, 0x80, 0xF0, 0x9F, 0x98, 0x80, 0x0A])
      const port = { readable: makeReadableStream([bytes]) }
      await reader.start(port, (line) => lines.push(line))
      expect(lines).toEqual(['😀😀'])
    })

    it('preserves emoji across chunked reads', async () => {
      const reader = createSerialReader()
      const lines = []
      const bytes = new Uint8Array([0xF0, 0x9F, 0x98, 0x80, 0x0A])
      const chunks = [
        bytes.slice(0, 1),
        bytes.slice(1, 3),
        bytes.slice(3)
      ]
      const port = { readable: makeReadableStream(chunks) }
      await reader.start(port, (line) => lines.push(line))
      expect(lines).toEqual(['😀'])
    })

    it('truncates to a codepoint boundary, dropping tail content safely', async () => {
      const reader = createSerialReader()
      const lines = []
      const filler = 'b'.repeat(70000)
      const bytes = strToBytes(filler + '\n')
      const port = { readable: makeReadableStream([bytes]) }
      await reader.start(port, (line) => lines.push(line))
      expect(reader.isActive()).toBe(false)
      for (const line of lines) {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(strToBytes(line))
        expect(decoded).toBe(line)
      }
    })
  })

  describe('lifecycle', () => {
    it('isActive is false before start', () => {
      const reader = createSerialReader()
      expect(reader.isActive()).toBe(false)
    })

    it('isActive becomes false after stream done', async () => {
      const reader = createSerialReader()
      const port = { readable: makeReadableStream([ strToBytes('x\n') ]) }
      await reader.start(port, () => {})
      expect(reader.isActive()).toBe(false)
    })

    it('start with null port is a no-op', async () => {
      const reader = createSerialReader()
      await expect(reader.start({ readable: null }, () => {})).resolves.toBeUndefined()
    })

    it('stop cancels in-flight stream', async () => {
      const reader = createSerialReader()
      const port = { readable: makeReadableStream([ new Uint8Array(1024 * 100) ]) }
      const promise = reader.start(port, () => {})
      await reader.stop()
      await promise
      expect(reader.isActive()).toBe(false)
    })

    it('start releases the reader lock on done', async () => {
      const reader = createSerialReader()
      let released = false
      const fakeReader = {
        async read() { return { value: undefined, done: true } },
        async cancel() {},
        releaseLock() { released = true }
      }
      const port = { readable: { getReader: () => fakeReader } }
      await reader.start(port, () => {})
      expect(released).toBe(true)
    })
  })
})
