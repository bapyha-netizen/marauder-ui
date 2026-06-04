import { OUI_DATA } from './ouiData'

const _vendorCache = new Map<string, string>()
const _MAC_RE = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/
const _db: Record<string, string> = OUI_DATA ?? {}

export { _vendorCache, _db }

export function loadDB(): Promise<Record<string, string>> {
  return Promise.resolve(_db)
}

function _normalizeMac(mac: string): string | null {
  if (!mac || typeof mac !== 'string') return null
  
  // Remove any leading/trailing whitespace
  mac = mac.trim()
  
  // Remove non-hex characters
  mac = mac.replace(/[^0-9A-Fa-f]/g, '')
  
  // Check if we have exactly 12 hex characters
  if (mac.length !== 12) return null
  
  // Format as XX:XX:XX:XX:XX:XX
  const normalized = mac.match(/.{1,2}/g)?.join(':')?.toUpperCase()
  return normalized || null
}

function _isValidMac(mac: string): boolean {
  const normalized = _normalizeMac(mac)
  return normalized !== null
}

export async function lookupVendorAsync(mac: string): Promise<string> {
  const normalizedMac = _normalizeMac(mac)
  if (!normalizedMac) return ''
  const prefix = normalizedMac.substring(0, 8)
  if (_vendorCache.has(prefix)) return _vendorCache.get(prefix)!
  const vendor = _db[prefix] || ''
  _vendorCache.set(prefix, vendor)
  return vendor
}

export function lookupVendor(mac: string): string {
  const normalizedMac = _normalizeMac(mac)
  if (!normalizedMac) return ''
  const prefix = normalizedMac.substring(0, 8)
  if (_vendorCache.has(prefix)) return _vendorCache.get(prefix)!
  const vendor = _db[prefix] || ''
  _vendorCache.set(prefix, vendor)
  return vendor
}
