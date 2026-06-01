import { describe, it, expect, beforeEach, vi } from 'vitest'
import { copyToClipboard, readFromClipboard } from '../clipboard'

describe('clipboard utility', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(), readText: vi.fn().mockResolvedValue('clip-text') },
      configurable: true,
      writable: true
    })
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true, writable: true })
  })

  it('copyToClipboard uses navigator.clipboard.writeText', async () => {
    const ok = await copyToClipboard('hello world')
    expect(ok).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello world')
  })

  it('copyToClipboard returns false for empty text', async () => {
    expect(await copyToClipboard('')).toBe(false)
    expect(await copyToClipboard(null)).toBe(false)
    expect(await copyToClipboard(undefined)).toBe(false)
  })

  it('falls back to execCommand when clipboard API throws', async () => {
    navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error('denied'))
    document.execCommand = vi.fn().mockReturnValue(true)
    const ok = await copyToClipboard('fallback text')
    expect(ok).toBe(true)
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('readFromClipboard returns clipboard text', async () => {
    const text = await readFromClipboard()
    expect(text).toBe('clip-text')
  })
})
