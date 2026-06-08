const DB_NAME = 'marauder-ui'
const DB_VERSION = 1
const STORES = ['accessPoints', 'bleDevices', 'probes', 'preferences', 'stats'] as const

type StoreName = (typeof STORES)[number]

let _dbPromise: Promise<IDBDatabase> | null = null

async function withLock(storeName: string, fn: () => Promise<void>): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    await navigator.locks.request(`idb:${storeName}`, async () => {
      await fn()
    })
  } else {
    await fn()
  }
}

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      _dbPromise = null
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest)?.result
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
    req.onsuccess = () => {
      const db = req.result
      // R-11: another tab opened the DB at a newer version. The spec says
      // we must close the connection so the upgrade can proceed. Closing
      // here can race with in-flight transactions; downstream code calls
      // openDB() again on the next putItem / getItem and gets a fresh
      // connection. We do not currently surface a "reload me" prompt to
      // the user — most sessions only have one tab, so this is rare in
      // practice. If the app ever becomes multi-tab-aware, this is the
      // hook to show one.
      db.onversionchange = () => {
        try { db.close() } catch (_) { /* ignore */ }
        _dbPromise = null
      }
      db.onclose = () => {
        _dbPromise = null
      }
      resolve(db)
    }
    req.onerror = () => {
      _dbPromise = null
      reject(req.error)
    }
  })
  return _dbPromise
}

export function _resetDbPromise() {
  _dbPromise = null
}

export async function putItem(storeName: string, value: any): Promise<IDBValidKey> {
  if (!value || typeof value !== 'object') {
    throw new Error(`putItem('${storeName}'): value must be an object`)
  }
  let result: IDBValidKey | undefined
  await withLock(storeName, async () => {
    const db = await openDB()
    const key = await new Promise<IDBValidKey>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      let req: IDBRequest<IDBValidKey>
      if (storeName === 'preferences' || storeName === 'stats') {
        if (!value || !value.id) {
          reject(new Error(`putItem('${storeName}'): value.id is required`))
          return
        }
        if (typeof value.id !== 'string' && typeof value.id !== 'number') {
          reject(new Error(`putItem('${storeName}'): value.id must be string or number`))
          return
        }
        req = store.put(value, value.id)
      } else {
        if (storeName === 'accessPoints' || storeName === 'bleDevices' || storeName === 'probes') {
          if (!value.id && !value.bssid && !value.mac) {
            reject(new Error(`putItem('${storeName}'): value must have id, bssid, or mac`))
            return
          }
        }
        req = store.put(value)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => { if (!tx.abort) { reject(req.error) } }
    })
    result = key
  })
  return result!
}

export async function getItem(storeName: string, key: IDBValidKey): Promise<any> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => {
      // Prevent double rejection by ensuring we only reject once
      if (!tx.abort) {
        reject(req.error)
      }
    }
  })
}

export async function getAll(storeName: string): Promise<any[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => {
      // Prevent double rejection by ensuring we only reject once
      if (!tx.abort) {
        reject(req.error)
      }
    }
  })
}

export async function clearStore(storeName: string): Promise<void> {
  return withLock(storeName, async () => {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => { if (!tx.abort) { reject(req.error) } }
    })
  })
}

export async function clearAll(): Promise<void> {
  await Promise.all(STORES.map(clearStore))
}

export async function putAll(storeName: string, items: any[]): Promise<void> {
  if (!Array.isArray(items)) {
    throw new Error(`putAll('${storeName}'): items must be an array`)
  }
  if (items.length === 0) { return }
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item || typeof item !== 'object') {
      throw new Error(`putAll('${storeName}'): item at index ${i} must be an object`)
    }
  }
  return withLock(storeName, async () => {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      let hasError = false
      for (const item of items) {
        const req = store.put(item)
        req.onerror = () => {
          hasError = true
          try { tx.abort() } catch (_) { }
        }
      }
      tx.oncomplete = () => { if (!hasError) resolve() }
      tx.onerror = () => { if (!hasError) reject(tx.error) }
      tx.onabort = () => { if (!hasError) reject(tx.error || new Error('Transaction aborted')) }
    })
  })
}

export const IDB_STORES = STORES
