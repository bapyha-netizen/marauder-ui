import { putAll, clearStore, getAll, putItem, getItem } from './idb'

const SAVE_DEBOUNCE_MS = 1000

const _timers = new Map()
const _pending = new Map()
const _seq = new Map()

export function debouncedSave(storeName, items, getKey) {
  const seq = (_seq.get(storeName) || 0) + 1
  _seq.set(storeName, seq)
  _pending.set(storeName, { items, getKey, seq })
  if (_timers.has(storeName)) clearTimeout(_timers.get(storeName))
  _timers.set(storeName, setTimeout(async () => {
    const pending = _pending.get(storeName)
    _pending.delete(storeName)
    _timers.delete(storeName)
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
  }, SAVE_DEBOUNCE_MS))
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
}
