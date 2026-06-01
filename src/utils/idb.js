const DB_NAME = 'marauder-ui'
const DB_VERSION = 1
const STORES = ['accessPoints', 'bleDevices', 'probes', 'preferences', 'stats']

let _dbPromise = null

function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = event.target.result
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          if (name === 'preferences' || name === 'stats') {
            db.createObjectStore(name)
          } else {
            db.createObjectStore(name, { keyPath: 'id', autoIncrement: false })
          }
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

export function _resetDbPromise() {
  _dbPromise = null
}

export async function putItem(storeName, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = (storeName === 'preferences' || storeName === 'stats')
      ? store.put(value, value.id || 'default')
      : store.put(value)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getItem(storeName, key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function getAll(storeName) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

export async function clearStore(storeName) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function clearAll() {
  await Promise.all(STORES.map(clearStore))
}

export async function putAll(storeName, items) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    let remaining = items.length
    if (remaining === 0) { resolve(); return }
    let hasError = false
    for (const item of items) {
      const req = store.put(item)
      req.onsuccess = () => { if (--remaining === 0 && !hasError) resolve() }
      req.onerror = () => { if (!hasError) { hasError = true; reject(req.error) } }
    }
    tx.oncomplete = () => { if (!hasError && remaining === 0) resolve() }
  })
}

export const IDB_STORES = STORES
