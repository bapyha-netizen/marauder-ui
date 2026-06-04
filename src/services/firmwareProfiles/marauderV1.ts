import { lookupVendor } from '../../utils/oui'
import { sanitizeText } from '../../utils/sanitize'
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
const AP_INFO_LAST_SEEN_RE = /^Last seen:\s*(.+)/
const AP_INFO_STATIONS_RE = /^Stations:\s*(\d+)/

let _infoAPIndex = -1
let _ipListBuffer: { index: number; ip: string; mac: string }[] = []

function parseAPBeacon(line: string, ctx: ParserContext): boolean {
  const m = line.match(AP_BEACON_RE)
  if (!m) return false
  const [, rssi, ch, bssid, essidRaw] = m
  // D-06: use sanitizeText for Unicode normalization and to strip ANSI /
  // invisible / control characters in one pass. The previous regex only
  // caught ASCII control bytes, leaving RTL overrides and ZWSP intact.
  const essid = sanitizeText(essidRaw, { maxLength: 64 }) || '(hidden)'
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
  const parsedIndex = safeInt(index)
const apData = {
    index: parseInt(m[1]),
    channel: parseInt(m[2]),
    bssid: m[3],
    essid: essid || '(hidden)',
    rssi,
    lastSeen: new Date(),
    isSelected: isSelected || false
  }
  ctx.apStore.updateOrAddAP(apData)
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
    ctx.dashStore.setLastStationAP(Number(index), essid.trim())
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
          id: Number(staIndex),
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
  useProbeStore().addProbe(Number(rssi), Number(ch), clientMac, trimmedSsid)
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
        rssi: Number(rssi),
        name: vendor || `BLE Device ${mac}`,
        manufacturer: vendor || '',
        lastSeen: new Date()
      })
    } else {
      const name = rawName.trim()
      ctx.bleStore.updateOrAddDevice({
        mac: `BLE:${name.toUpperCase()}`,
        rssi: Number(rssi),
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
      rssi: Number(rssi),
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
  const key = type.toLowerCase() as 'beacon' | 'probe' | 'deauth' | 'eapol' | 'data' | 'management'
  if (['beacon', 'probe', 'deauth', 'eapol', 'data', 'management'].includes(key)) {
    ctx.dashStore.setPacketCounts({ [key]: safeInt(count, 0) })
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
  const channel = safeInt(ch, 0)
  const utilization = safeInt(count, 0) ?? 0
  if (channel !== null) {
    ctx.dashStore.setChannelUtilization({ [channel]: utilization })
  }
  return true
}

function parseAPInfo(line: string, ctx: ParserContext): boolean {
  const idxRe = /^Index:\s*(\d+)/
  const idxM = line.match(idxRe)
  if (idxM) {
    const index = safeInt(idxM[1], -1)
    ctx.infoAPIndex = index ?? -1
    return true
  }
  if (ctx.infoAPIndex < 0) return false

  const bssidRe = /^BSSID:\s*([0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2})/
  const bssidM = line.match(bssidRe)
  if (bssidM) { ctx.apStore.updateAP(ctx.infoAPIndex, { bssid: bssidM[1].toUpperCase() }); return true }

  const secRe = /^Security:\s*(.+)/
  const secM = line.match(secRe)
  if (secM) { ctx.apStore.updateAP(ctx.infoAPIndex, { encryption: secM[1].trim() }); return true }

  const venRe = /^Vendor:\s*(.+)/
  const venM = line.match(venRe)
  if (venM) { ctx.apStore.updateAP(ctx.infoAPIndex, { vendor: venM[1].trim() }); return true }

  const chanRe = /^Channel:\s*(\d+)/
  const chanM = line.match(chanRe)
  if (chanM) { ctx.apStore.updateAP(ctx.infoAPIndex, { channel: safeInt(chanM[1]) ?? 0 }); return true }

  const rssiRe = /^RSSI:\s*(-?\d+)/
  const rssiM = line.match(rssiRe)
  if (rssiM) { ctx.apStore.updateAP(ctx.infoAPIndex, { rssi: safeInt(rssiM[1]) }); return true }

  const encRe = /^Encryption:\s*(.+)/
  const encM = line.match(encRe)
  if (encM) { ctx.apStore.updateAP(ctx.infoAPIndex, { encryption: encM[1].trim() }); return true }

  const essidRe = /^ESSID:\s*(.+)/
  const essidM = line.match(essidRe)
  if (essidM) { ctx.apStore.updateAP(ctx.infoAPIndex, { essid: essidM[1].trim() }); return true }

  if (AP_INFO_LAST_SEEN_RE.test(line)) return true

  if (AP_INFO_STATIONS_RE.test(line)) return true

  ctx.infoAPIndex = -1
  return false
}

function parseIPList(line: string, ctx: ParserContext): boolean {
  if (/^IP List/i.test(line) || /^─{3,}$/.test(line)) {
    ctx.ipListBuffer = []
    return true
  }
  const re = /^\[(\d+)\]\s+(\S+)/
  const m = line.match(re)
  if (!m) return false
  const [, idx, ip] = m
  const macMatch = line.match(MAC_RE)
  ctx.ipListBuffer.push({
    index: safeInt(idx) ?? 0,
    ip,
    mac: macMatch ? macMatch[1].toUpperCase() : ''
  })
  ctx.dashStore.setIPList([...ctx.ipListBuffer])
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
  description: 'Current upstream Marauder output grammar (v1.x firmware)',
  // Q-13: tighter than /^>\s*$/ — the old pattern would match any line
  // beginning with '>'. Marauder v1.x prints either ">" (interactive) or
  // "esp32marauder>" as a prompt, and only the line itself (possibly with
  // trailing ANSI/cursor escapes). We still allow an optional trailing
  // escape sequence and require nothing else after the prompt.
  prompt: /^(?:>\s*|esp32marauder>\s*)$/i
}

export const marauderV1: FirmwareProfile = {
  name: 'marauderV1',
  id: META.id,
  description: META.description,
  version: 1,
  DISPATCH,
  FALLBACK_PARSERS,
  resetState: () => ({})
}

export function resetState(): void {}
