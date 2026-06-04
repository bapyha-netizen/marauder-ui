import { ref } from 'vue'

interface Toast {
  id: number
  message: string
  type: string
  timerId?: ReturnType<typeof setTimeout>
}

const toasts = ref<Toast[]>([])
let nextId = 0
const _lastToast = new Map<string, number>()
const _lastToastOrder: string[] = []
const _MAX_TRACKED = 100
const _THROTTLE_WINDOW_MS = 100
let _lastToastTime = 0

export function useToast() {
  /**
   * Show a toast. Returns the toast id, or undefined if the call was
   * deduped (same message shown within 500ms). Callers can pass the id to
   * `remove(id)` to dismiss a toast early — useful for "running..." / "OK"
   * pairs that should be replaced instead of stacked.
   */
  function show(message: string, type: string = 'info', duration: number = 3000): number | undefined {
    const now = Date.now()
    if (now - _lastToastTime < _THROTTLE_WINDOW_MS) return
    const last = _lastToast.get(message) || 0
    if (now - last < 500) return
    _lastToastTime = now
    _lastToast.set(message, now)
    _lastToastOrder.push(message)
    if (_lastToastOrder.length > _MAX_TRACKED) {
      const evicted = _lastToastOrder.shift()!
      _lastToast.delete(evicted)
    }

    const id = ++nextId
    const toast: Toast = { id, message, type }
    toasts.value.push(toast)
    if (toasts.value.length > 5) {
      const oldest = toasts.value.shift()
      if (oldest?.timerId) clearTimeout(oldest.timerId)
    }

    toast.timerId = setTimeout(() => {
      remove(id)
    }, duration)

    return id
  }

  function remove(id: number): void {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx === -1) return
    const toast = toasts.value[idx]
    if (toast.timerId) clearTimeout(toast.timerId)
    toasts.value.splice(idx, 1)
  }

  return { toasts, show, remove }
}

export function _resetToastState(): void {
  toasts.value.splice(0).forEach(t => {
    if (t.timerId) clearTimeout(t.timerId)
  })
  _lastToast.clear()
  _lastToastOrder.length = 0
  nextId = 0
}
