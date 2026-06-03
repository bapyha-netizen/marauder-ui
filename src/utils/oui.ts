const _vendorCache = new Map<string, string>()
let _db: Record<string, string> | null = null
let _dbPromise: Promise<Record<string, string>> | null = null

export function loadDB(): Promise<Record<string, string>> {
  if (!_dbPromise) {
    _dbPromise = import('./ouiData').then(m => {
      _db = m.OUI_DATA
      return _db!
    })
  }
  return _dbPromise
}

export async function lookupVendorAsync(mac: string): Promise<string> {
  if (!mac || mac.length < 8) return ''
  const prefix = mac.toUpperCase().substring(0, 8)
  if (_vendorCache.has(prefix)) return _vendorCache.get(prefix)!
  const db = await loadDB()
  const vendor = db[prefix] || ''
  _vendorCache.set(prefix, vendor)
  return vendor
}

export function lookupVendor(mac: string): string {
  if (!mac || mac.length < 8) return ''
  const prefix = mac.toUpperCase().substring(0, 8)
  if (_vendorCache.has(prefix)) return _vendorCache.get(prefix)!
  if (!_db) {
    loadDB()
    return ''
  }
  const vendor = _db[prefix] || ''
  _vendorCache.set(prefix, vendor)
  return vendor
}

loadDB()
