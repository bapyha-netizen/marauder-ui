import { putAll, clearStore, getAll, putItem, getItem } from './idb'

const SAVE_DEBOUNCE_MS = 1000
const SAVE_MAX_WAIT_MS = 5000

const _timers = new Map()
const _pending = new Map()
const _seq = new Map()
const _firstCall = new Map()

export function debouncedSave(storeName, items, getKey) {
  const seq = (_seq.get(storeName) || 0) + 1
  _seq.set(storeName, seq)
  _pending.set(storeName, { items, getKey, seq })
  if (_timers.has(storeName)) {
    clearTimeout(_timers.get(storeName))
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
      const itemsWithKey = pending.getKey
        ? pending.items
        : pending.items.map(item => ({ ...item, id: item.bssid || item.mac || item.id || JSON.stringify(item) }))
      await putAll(storeName, itemsWithKey)
    } catch (e) {
      console.warn(`[persist] save ${storeName} failed:`, e)
    }
  }, delay))
}

export async function loadStore(storeName) {
  try {
    return await getAll(storeName)
  } catch (e) {
    console.warn(`[persist] load ${storeName} failed:`, e)
    return []
  }
}

export async function clearPersistedStore(storeName) {
  try {
    await clearStore(storeName)
  } catch (e) {
    console.warn(`[persist] clear ${storeName} failed:`, e)
  }
}

export async function savePref(key, value) {
  try {
    await putItem('preferences', { id: key, value, updatedAt: new Date() })
  } catch (e) {
    console.warn(`[persist] save pref ${key} failed:`, e)
  }
}

export async function loadPref(key) {
  try {
    const item = await getItem('preferences', key)
    return item ? item.value : null
  } catch (e) {
    console.warn(`[persist] load pref ${key} failed:`, e)
    return null
  }
}

export function cancelPendingSaves() {
  for (const t of _timers.values()) clearTimeout(t)
  _timers.clear()
  _pending.clear()
  _firstCall.clear()
}

export async function flushPendingSaves() {
  const promises = []
  for (const [storeName, timer] of _timers.entries()) {
    clearTimeout(timer)
    const pending = _pending.get(storeName)
    _pending.delete(storeName)
    if (pending && pending.seq === _seq.get(storeName)) {
      try {
        const itemsWithKey = pending.getKey
          ? pending.items
          : pending.items.map(item => ({ ...item, id: item.bssid || item.mac || item.id || JSON.stringify(item) }))
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
}
