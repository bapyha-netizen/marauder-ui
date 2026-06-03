import { putAll, clearStore, getAll, putItem, getItem } from './idb'
import { recordKey } from './uuid'

const SAVE_DEBOUNCE_MS = 1000
const SAVE_MAX_WAIT_MS = 5000

const _timers = new Map<string, ReturnType<typeof setTimeout>>()
const _pending = new Map<string, { items: Record<string, unknown>[]; getKey: ((item: Record<string, unknown>) => string) | null; seq: number }>()
const _seq = new Map<string, number>()
const _firstCall = new Map<string, number>()

function _stampId(item: Record<string, unknown>, getKey: ((item: Record<string, unknown>) => string) | null): Record<string, unknown> {
  if (getKey) {
    const id = getKey(item)
    return { ...item, id }
  }
  return { ...item, id: recordKey(item) }
}

export function debouncedSave(
  storeName: string,
  items: Record<string, unknown>[],
  getKey?: ((item: Record<string, unknown>) => string) | null
): void {
  const seq = (_seq.get(storeName) || 0) + 1
  _seq.set(storeName, seq)
  _pending.set(storeName, { items, getKey: getKey ?? null, seq })
  if (_timers.has(storeName)) {
    clearTimeout(_timers.get(storeName)!)
  } else {
    _firstCall.set(storeName, Date.now())
  }
  const elapsed = Date.now() - (_firstCall.get(storeName) || Date.now())
  const delay = elapsed >= SAVE_MAX_WAIT_MS ? 0 : SAVE_DEBOUNCE_MS
  _timers.set(storeName, setTimeout(async () => {
    const pending = _pending.get(storeName)
    _pending.delete(storeName)
    _timers.delete(storeName)
    _firstCall.delete(storeName)
    if (!pending) return
    if (pending.seq !== _seq.get(storeName)) return
    try {
      const itemsWithKey = pending.items.map(item => _stampId(item, pending.getKey))
      await putAll(storeName, itemsWithKey)
    } catch (e) {
      console.warn(`[persist] save ${storeName} failed:`, e)
    }
  }, delay))
}

export async function loadStore(storeName: string): Promise<Record<string, unknown>[]> {
  try {
    return await getAll(storeName)
  } catch (e) {
    console.warn(`[persist] load ${storeName} failed:`, e)
    return []
  }
}

export async function clearPersistedStore(storeName: string): Promise<void> {
  try {
    await clearStore(storeName)
  } catch (e) {
    console.warn(`[persist] clear ${storeName} failed:`, e)
  }
}

export async function savePref(key: string, value: unknown): Promise<void> {
  try {
    await putItem('preferences', { id: key, value, updatedAt: new Date() })
  } catch (e) {
    console.warn(`[persist] save pref ${key} failed:`, e)
  }
}

export async function loadPref(key: string): Promise<unknown> {
  try {
    const item = await getItem('preferences', key)
    return item ? item.value : null
  } catch (e) {
    console.warn(`[persist] load pref ${key} failed:`, e)
    return null
  }
}

export function cancelPendingSaves(): void {
  for (const t of _timers.values()) clearTimeout(t)
  _timers.clear()
  _pending.clear()
  _firstCall.clear()
}

export async function flushPendingSaves(): Promise<void> {
  const promises: Promise<void>[] = []
  for (const [storeName, timer] of _timers.entries()) {
    clearTimeout(timer)
    const pending = _pending.get(storeName)
    _pending.delete(storeName)
    if (pending && pending.seq === _seq.get(storeName)) {
      try {
        const itemsWithKey = pending.items.map(item => _stampId(item, pending.getKey))
        promises.push(putAll(storeName, itemsWithKey))
      } catch (e) {
        console.warn(`[persist] flush ${storeName} failed:`, e)
      }
    }
  }
  _timers.clear()
  _firstCall.clear()
  await Promise.allSettled(promises)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingSaves()
  })
  window.addEventListener('beforeunload', () => {
    flushPendingSaves()
  })
}
