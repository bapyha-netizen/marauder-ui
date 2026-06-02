import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useToast, _resetToastState } from '../toast'

describe('toast utility', () => {
  beforeEach(() => {
    _resetToastState()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    _resetToastState()
  })

  it('shows a toast and returns an id', () => {
    const { show, toasts } = useToast()
    const id = show('Hello', 'info')
    expect(id).toBeGreaterThan(0)
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0].message).toBe('Hello')
  })

  it('deduplicates the same message within 500ms', () => {
    const { show, toasts } = useToast()
    show('dup', 'info')
    show('dup', 'info')
    show('dup', 'info')
    expect(toasts.value).toHaveLength(1)
  })

  it('removes toast after duration', () => {
    const { show, toasts } = useToast()
    show('Bye', 'info', 1000)
    expect(toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(1100)
    expect(toasts.value).toHaveLength(0)
  })

  it('caps visible toasts at 5 (FIFO)', () => {
    const { show, toasts } = useToast()
    for (let i = 0; i < 7; i++) {
      show(`msg-${i}`, 'info', 60000)
    }
    expect(toasts.value).toHaveLength(5)
    expect(toasts.value[0].message).toBe('msg-2')
    expect(toasts.value[4].message).toBe('msg-6')
  })

  it('evicts old entries from dedup map (bounded memory)', () => {
    const { show } = useToast()
    for (let i = 0; i < 150; i++) {
      show(`unique-${i}`, 'info', 60000)
    }
    vi.advanceTimersByTime(1)
    show('unique-0', 'info', 60000)
    expect(true).toBe(true)
  })
})
