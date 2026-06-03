import { lookupVendor } from '../../utils/oui'
import type { ParserContext, FirmwareProfile, ParserFn } from '../../types/parser'
import { useProbeStore } from '../../stores/probeStore'

function safeInt(value: unknown, fallback: number | null = null): number | null {
  if (value === null || value === undefined) return fallback
  const n = parseInt(String(value), 10)
  return Number.isNaN(n) ? fallback : n
}

const MAC_RE = /([0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2})/

const AP_BEACON_RE = new RegExp(`^(-?\\d+)\\s+Ch:\\s*(\\d+)\\s+${MAC_RE.source}\\s+ESSID:\\s*(.*)$`, 'i')
const STATION_DETECT_RE = new RegExp(`^(\\d+):\\s*(ap|sta):\\s*(${MAC_RE.source})\\s*->\\s*(sta|ap):\\s*(${MAC_RE.source})`)
const STATION_LIST_STA_RE = new RegExp(`^\\[(\\d+)\\]\\s+(${MAC_RE.source})(?:\\s+\\(selected\\))?\\s*$`)
const DEAUTH_SNIFF_RE = new RegExp(`^(-?\\d+)\\s+Ch:\\s*(\\d+)\\s+${MAC_RE.source}\\s*->\\s*${MAC_RE.source}`)
const PROBE_SNIFF_RE = new RegExp(`^(-?\\d+)\\s+Ch:\\s*(\\d+)\\s+Client:\\s+(${MAC_RE.source})\\s+Requesting:\\s+(.+)`)
const PMKID_CAPTURE_RE = new RegExp(`Received EAPOL:\\s*(${MAC_RE.source})`)
const BLE_SNIFF_MAC_RE = new RegExp(`^(-?\\d+)\\s+${MAC_RE.source}\\s*$`)

let _infoAPIndex = -1
let _ipListBuffer: { index: number; ip: string; mac: string }[] = []

function parseAPBeacon(line: string, ctx: ParserContext): boolean {
  const m = line.match(AP_BEACON_RE)
  if (!m) return false
  const [, rssi, ch, bssid, essidRaw] = m
  const essid = essidRaw.replace(/[^\x20-\x7E]/g, '').trim() || '(hidden)'
  ctx.apStore.updateOrAddAP({
    rssi: safeInt(rssi),
    channel: safeInt(ch) ?? 0,
    bssid: bssid.toUpperCase(),
    essid,
    isHidden: essid === '(hidden)' || essid === bssid.toUpperCase(),
    vendor: lookupVendor(bssid.toUpperCase()),
    lastSeen: new Date()
  })
  ctx.dashStore.addEvent('beacon', line)
  return true
}

function parseAPList(line: string, ctx: ParserContext): boolean {
  const re = /\[(\d+)\]\[CH:(\d+)\]\s+(.+)/
  const m = line.match(re)
  if (!m) return false
  const [, index, ch, rest] = m
  const isSelected = rest.includes('(selected)')
  let essid = rest.replace(/\(selected\)/g, '').trim()
  let rssi: number | null = null
  const rssiMatch = essid.match(/(-?\d+)$/)
  if (rssiMatch) {
    rssi = safeInt(rssiMatch[1])
    essid = essid.replace(/\s*-?\d+$/, '').trim()
  }
  const apData: Record<string, unknown> = {
    index: safeInt(index),
    channel: safeInt(ch) ?? 0,
    essid: essid || '(hidden)',
    rssi,
    lastSeen: new Date()
  }
  if (isSelected) apData.isSelected = true
  ctx.apStore.updateOrAddAP(apData as any)
  ctx.dashStore.addEvent('list', line)
  return true
}

function parseStationDetect(line: string, ctx: ParserContext): boolean {
  const m = line.match(STATION_DETECT_RE)
  if (!m) return false
  const [, id, firstType, firstMac, , secondType, secondMac] = m
  const apMac = (firstType === 'ap' ? firstMac : secondMac).toUpperCase()
  const staMac = (firstType === 'sta' ? firstMac : secondMac).toUpperCase()
  const found = ctx.apStore.findAPByBSSID(apMac)
  if (found) {
    ctx.apStore.addStation(found.key, { id: safeInt(id) ?? 0, mac: staMac })
  } else {
    ctx.apStore.updateOrAddAP({
      essid: '(unknown)', bssid: apMac, channel: 0, rssi: null,
      vendor: lookupVendor(apMac), lastSeen: new Date()
    })
    ctx.apStore.addStation(apMac, { id: safeInt(id) ?? 0, mac: staMac })
  }
  return true
}

function parseStationList(line: string, ctx: ParserContext): boolean {
  const apRe = /^\[(\d+)\]\s+(.+)\s+(-?\d+):\s*$/
  const apM = line.match(apRe)
  if (apM) {
    const [, index, essid] = apM
    ctx.dashStore.setLastStationAP(safeInt(index) ?? 0, essid.trim())
    return true
  }
  const staM = line.match(STATION_LIST_STA_RE)
  if (staM) {
    const [, staIndex, staMac] = staM
    const apIndex = ctx.dashStore.lastStationAPIndex
    if (apIndex !== undefined && apIndex !== null) {
      const found = ctx.apStore.findAPByIndex(apIndex)
      if (found) {
        ctx.apStore.addStation(found.key, {
          id: safeInt(staIndex) ?? 0,
          mac: staMac.toUpperCase(),
          isSelected: line.includes('(selected)')
        })
        ctx.dashStore.addEvent('station', line)
      }
    }
    return true
  }
  return false
}

function parseDeauthSniff(line: string, ctx: ParserContext): boolean {
  const m = line.match(DEAUTH_SNIFF_RE)
  if (!m) return false
  const [, rssi, ch, srcMac, , dstMac] = m
  ctx.dashStore.addEvent('deauth', `Deauth: ${srcMac} -> ${dstMac} Ch:${ch} RSSI:${rssi}`)
  ctx.dashStore.incrementPackets()
  return true
}

function parseProbeSniff(line: string, ctx: ParserContext): boolean {
  const m = line.match(PROBE_SNIFF_RE)
  if (!m) return false
  const [, rssi, ch, clientMac, , ssid] = m
  const trimmedSsid = ssid.trim()
  ctx.dashStore.addEvent('probe', `Probe: ${clientMac} -> ${trimmedSsid} Ch:${ch} RSSI:${rssi}`)
  ctx.dashStore.incrementPackets()
  useProbeStore().addProbe(safeInt(rssi) ?? 0, safeInt(ch) ?? 0, clientMac, trimmedSsid)
  return true
}

function parsePMKID(line: string, ctx: ParserContext): boolean {
  if (line.includes('Received EAPOL')) {
    const m = line.match(PMKID_CAPTURE_RE)
    if (m) {
      ctx.dashStore.addEvent('pmkid', `EAPOL: ${m[1].toUpperCase()}`)
      ctx.dashStore.incrementPackets()
      return true
    }
  }
  const pmkidCapturedRe = /^PMKID captured:\s*([0-9A-Fa-f:]{17})/
  const cm = line.match(pmkidCapturedRe)
  if (cm) {
    ctx.dashStore.addEvent('pmkid', `PMKID captured: ${cm[1].toUpperCase()}`)
    ctx.dashStore.incrementPackets()
    return true
  }
  return false
}

function parseBLESniff(line: string, ctx: ParserContext): boolean {
  const re = /^(-?\d+)\s+Device:\s+(.+)/
  const m1 = line.match(re)
  if (m1) {
    const [, rssi, rawName] = m1
    const macMatch = rawName.match(MAC_RE)
    if (macMatch) {
      const mac = macMatch[1].toUpperCase()
      const vendor = lookupVendor(mac)
      ctx.bleStore.updateOrAddDevice({
        mac,
        rssi: safeInt(rssi) ?? 0,
        name: vendor || `BLE Device ${mac}`,
        manufacturer: vendor || '',
        lastSeen: new Date()
      })
    } else {
      const name = rawName.trim()
      ctx.bleStore.updateOrAddDevice({
        mac: `BLE:${name.toUpperCase()}`,
        rssi: safeInt(rssi) ?? 0,
        name,
        lastSeen: new Date()
      })
    }
    ctx.dashStore.addEvent('ble', line)
    return true
  }
  const m2 = line.match(BLE_SNIFF_MAC_RE)
  if (m2) {
    const [, rssi, mac] = m2
    const macUpper = mac.toUpperCase()
    const vendor = lookupVendor(macUpper)
    ctx.bleStore.updateOrAddDevice({
      mac: macUpper,
      rssi: safeInt(rssi) ?? 0,
      name: vendor || `BLE ${macUpper}`,
      manufacturer: vendor || '',
      lastSeen: new Date()
    })
    ctx.dashStore.addEvent('ble', line)
    return true
  }
  return false
}

function parseBLEMeta(line: string, ctx: ParserContext): boolean {
  const re = /^Meta Device:\s*(-?\d+)\s+(.+)/
  const m = line.match(re)
  if (!m) return false
  const [, rssi, name] = m
  const trimmed = name.trim()
  ctx.bleStore.updateOrAddDevice({
    mac: `META:${trimmed.toUpperCase()}`,
    rssi: safeInt(rssi) ?? 0,
    name: `Meta: ${trimmed}`,
    isAirtag: false,
    manufacturer: 'Meta/Ray-Ban',
    lastSeen: new Date()
  })
  ctx.dashStore.addEvent('ble', line)
  return true
}

function parseSignalMonitor(line: string, ctx: ParserContext): boolean {
  const re = /^(.+?)\s+RSSI:\s*(-?\d+)/
  const m = line.match(re)
  if (!m) return false
  const [, essid, rssi] = m
  for (const [, ap] of ctx.apStore.accessPoints) {
    if (ap.essid === essid.trim()) {
      ctx.apStore.updateOrAddAP({
        ...ap,
        rssi: safeInt(rssi),
        lastSeen: new Date()
      })
      ctx.dashStore.addEvent('signal', line)
      return true
    }
  }
  return false
}

function parsePacketCount(line: string, ctx: ParserContext): boolean {
  if (line.startsWith('Packet Statistics') || /^-{3,}$/.test(line)) {
    ctx.dashStore.setPacketCounts({ beacon: 0, probe: 0, deauth: 0, eapol: 0, data: 0, management: 0 })
    return true
  }
  const re = /\b(beacon|probe|deauth|eapol|data|management)\s*:\s*(\d+)/i
  const m = line.match(re)
  if (!m) return false
  const [, type, count] = m
  const key = type.toLowerCase() as keyof import('../../types').PacketCounts
  if (['beacon', 'probe', 'deauth', 'eapol', 'data', 'management'].includes(key)) {
    ctx.dashStore.setPacketCounts({ [key]: safeInt(count, 0) } as any)
    return true
  }
  return false
}

function parseChannelAnalyzer(line: string, ctx: ParserContext): boolean {
  if (line.startsWith('Channel Analyzer') || /^-{3,}$/.test(line)) {
    ctx.dashStore.setChannelUtilization({})
    return true
  }
  const re = /\bCh\s*(\d+)\s*:\s*(\d+)/
  const m = line.match(re)
  if (!m) return false
  const [, ch, count] = m
  ctx.dashStore.setChannelUtilization({ [safeInt(ch, 0) ?? 0]: safeInt(count, 0) ?? 0 })
  return true
}

function parseAPInfo(line: string, ctx: ParserContext): boolean {
  const idxRe = /^Index:\s*(\d+)/
  const idxM = line.match(idxRe)
  if (idxM) {
    _infoAPIndex = safeInt(idxM[1], -1) ?? -1
    return true
  }
  if (_infoAPIndex < 0) return false

  const bssidRe = /^BSSID:\s*([0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2})/
  const bssidM = line.match(bssidRe)
  if (bssidM) { ctx.apStore.updateAP(_infoAPIndex, { bssid: bssidM[1].toUpperCase() }); return true }

  const secRe = /^Security:\s*(.+)/
  const secM = line.match(secRe)
  if (secM) { ctx.apStore.updateAP(_infoAPIndex, { encryption: secM[1].trim() }); return true }

  const venRe = /^Vendor:\s*(.+)/
  const venM = line.match(venRe)
  if (venM) { ctx.apStore.updateAP(_infoAPIndex, { vendor: venM[1].trim() }); return true }

  const chanRe = /^Channel:\s*(\d+)/
  const chanM = line.match(chanRe)
  if (chanM) { ctx.apStore.updateAP(_infoAPIndex, { channel: safeInt(chanM[1]) ?? 0 }); return true }

  const rssiRe = /^RSSI:\s*(-?\d+)/
  const rssiM = line.match(rssiRe)
  if (rssiM) { ctx.apStore.updateAP(_infoAPIndex, { rssi: safeInt(rssiM[1]) }); return true }

  const encRe = /^Encryption:\s*(.+)/
  const encM = line.match(encRe)
  if (encM) { ctx.apStore.updateAP(_infoAPIndex, { encryption: encM[1].trim() }); return true }

  const essidRe = /^ESSID:\s*(.+)/
  const essidM = line.match(essidRe)
  if (essidM) { ctx.apStore.updateAP(_infoAPIndex, { essid: essidM[1].trim() }); return true }

  const lastSeenRe = /^Last seen:\s*(.+)/
  if (lastSeenRe.test(line)) return true

  const stationsRe = /^Stations:\s*(\d+)/
  if (stationsRe.test(line)) return true

  _infoAPIndex = -1
  return false
}

function parseIPList(line: string, ctx: ParserContext): boolean {
  if (/^IP List/i.test(line) || /^─{3,}$/.test(line)) {
    _ipListBuffer = []
    return true
  }
  const re = /^\[(\d+)\]\s+(\S+)/
  const m = line.match(re)
  if (!m) return false
  const [, idx, ip] = m
  const macMatch = line.match(MAC_RE)
  _ipListBuffer.push({
    index: safeInt(idx) ?? 0,
    ip,
    mac: macMatch ? macMatch[1].toUpperCase() : ''
  })
  ctx.dashStore.setIPList([..._ipListBuffer])
  return true
}

function parseSystemMsg(line: string, ctx: ParserContext): boolean {
  if (/^\[(INFO|WARN|ERROR|SYSTEM|APP)\]/.test(line)) {
    ctx.dashStore.addEvent('system', line)
    return true
  }
  if (/^#[a-z]+/i.test(line)) {
    ctx.dashStore.addEvent('system', line)
    return true
  }
  if (/^(Starting|Stopping|Clearing|Scanning|Sniffing|Wardriving)/i.test(line)) {
    ctx.dashStore.addEvent('system', line)
    return true
  }
  return false
}

export const DISPATCH: Record<number, ParserFn[]> = {
  45: [parseAPBeacon, parseDeauthSniff, parseProbeSniff, parseBLESniff],
  91: [parseAPList, parseStationList, parseIPList, parseSystemMsg],
  82: [parsePMKID, parseAPInfo, parseSystemMsg],
  80: [parsePMKID, parsePacketCount, parseSystemMsg],
  77: [parseBLEMeta, parsePacketCount, parseSystemMsg],
  73: [parseIPList, parseAPInfo, parseSystemMsg],
  66: [parseAPInfo, parsePacketCount, parseSystemMsg],
  67: [parseChannelAnalyzer, parseAPInfo, parseSystemMsg],
  83: [parseAPInfo, parseSystemMsg],
  86: [parseAPInfo, parseSystemMsg],
  69: [parseAPInfo, parseSystemMsg],
  76: [parseAPInfo, parseSystemMsg],
  98: [parsePacketCount, parseSystemMsg],
  112: [parsePacketCount, parseSystemMsg],
  100: [parsePacketCount, parseSystemMsg],
  101: [parsePacketCount, parseSystemMsg],
  109: [parsePacketCount, parseSystemMsg]
}

export const FALLBACK_PARSERS: ParserFn[] = [
  parseStationDetect,
  parseSignalMonitor,
  parseSystemMsg
]

export const META = {
  id: 'marauder-v1',
  description: 'Current upstream Marauder output grammar (v1.x firmware)'
}

export function resetState(): void {
  _infoAPIndex = -1
  _ipListBuffer = []
}
