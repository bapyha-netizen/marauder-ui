const _vendorCache = new Map()
let _db = null
let _dbPromise = null

export function loadDB() {
  if (!_dbPromise) {
    _dbPromise = import('./ouiData').then(m => {
      _db = m.OUI_DATA
      return _db
    })
  }
  return _dbPromise
}

export async function lookupVendorAsync(mac) {
  if (!mac || mac.length < 8) return ''
  const prefix = mac.toUpperCase().substring(0, 8)
  if (_vendorCache.has(prefix)) return _vendorCache.get(prefix)
  const db = await loadDB()
  const vendor = db[prefix] || ''
  _vendorCache.set(prefix, vendor)
  return vendor
}

export function lookupVendor(mac) {
  if (!mac || mac.length < 8) return ''
  const prefix = mac.toUpperCase().substring(0, 8)
  if (_vendorCache.has(prefix)) return _vendorCache.get(prefix)
  if (!_db) {
    loadDB()
    return ''
  }
  const vendor = _db[prefix] || ''
  _vendorCache.set(prefix, vendor)
  return vendor
}

loadDB()
