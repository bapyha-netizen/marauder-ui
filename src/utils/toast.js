import { ref } from 'vue'

const toasts = ref([])
let nextId = 0
const _lastToast = new Map()

export function useToast() {
  function show(message, type = 'info', duration = 3000) {
    const now = Date.now()
    const last = _lastToast.get(message) || 0
    if (now - last < 500) return
    _lastToast.set(message, now)

    const id = ++nextId
    const toast = { id, message, type }
    toasts.value.push(toast)

    toast.timerId = setTimeout(() => {
      remove(id)
    }, duration)

    return id
  }

  function remove(id) {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx === -1) return
    const toast = toasts.value[idx]
    if (toast.timerId) clearTimeout(toast.timerId)
    toasts.value.splice(idx, 1)
  }

  return { toasts, show, remove }
}
