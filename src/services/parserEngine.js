import { useApStore } from '../stores/apStore'
import { useBleStore } from '../stores/bleStore'
import { useDashboardStore } from '../stores/dashboardStore'
import { useProbeStore } from '../stores/probeStore'
import { lookupVendor } from '../utils/oui'

const CLEANUP_INTERVAL = 30000
const AP_MAX_AGE = 300000

let intervalId = null

function safeInt(value, fallback = null) {
  if (value === null || value === undefined) return fallback
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? fallback : n
}

export function startParser() {
  intervalId = setInterval(() => {
    const apStore = useApStore()
    apStore.removeOldAPs(AP_MAX_AGE)
  }, CLEANUP_INTERVAL)
}

export function stopParser() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

export function resetParserState() {
  _bleKeyCounter = 0
  _infoAPIndex = -1
  _ipListBuffer = []
}

export function parseLine(line) {
  const apStore = useApStore()
  const bleStore = useBleStore()
  const dashStore = useDashboardStore()

  if (!line || !line.trim()) return
  const trimmed = line.trim()

  if (trimmed.startsWith('> ')) return
  if (trimmed.startsWith('#')) return

  if (parseAPBeacon(trimmed, apStore, dashStore)) return
  if (parseAPList(trimmed, apStore, dashStore)) return
  if (parseStationDetect(trimmed, apStore, dashStore)) return
  if (parseStationList(trimmed, apStore, dashStore)) return
  if (parseDeauthSniff(trimmed, apStore, dashStore)) return
  if (parseProbeSniff(trimmed, apStore, dashStore)) return
  if (parsePMKID(trimmed, apStore, dashStore)) return
  if (parseBLESniff(trimmed, bleStore, dashStore)) return
  if (parseBLEMeta(trimmed, bleStore, dashStore)) return
  if (parseSignalMonitor(trimmed, apStore, dashStore)) return
  if (parsePacketCount(trimmed, dashStore)) return
  if (parseChannelAnalyzer(trimmed, dashStore)) return
  if (parseAPInfo(trimmed, apStore, dashStore)) return
  if (parseIPList(trimmed, dashStore)) return
  if (parseSystemMsg(trimmed, dashStore)) return
}

const MAC_RE = /([0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2})/

const AP_BEACON_RE = new RegExp(`^(-?\\d+)\\s+Ch:\\s*(\\d+)\\s+${MAC_RE.source}\\s+ESSID:\\s*(.*)$`, 'i')
const STATION_DETECT_RE = new RegExp(`^(\\d+):\\s*(ap|sta):\\s*(${MAC_RE.source})\\s*->\\s*(sta|ap):\\s*(${MAC_RE.source})`)
const STATION_LIST_STA_RE = new RegExp(`^\\[(\\d+)\\]\\s+(${MAC_RE.source})(?:\\s+\\(selected\\))?\\s*$`)
const DEAUTH_SNIFF_RE = new RegExp(`^(-?\\d+)\\s+Ch:\\s*(\\d+)\\s+${MAC_RE.source}\\s*->\\s*${MAC_RE.source}`)
const PROBE_SNIFF_RE = new RegExp(`^(-?\\d+)\\s+Ch:\\s*(\\d+)\\s+Client:\\s+(${MAC_RE.source})\\s+Requesting:\\s+(.+)`)
const PMKID_CAPTURE_RE = new RegExp(`Received EAPOL:\\s*(${MAC_RE.source})`)
const BLE_SNIFF_MAC_RE = new RegExp(`^(-?\\d+)\\s+(${MAC_RE.source})\\s*$`)

let _bleKeyCounter = 0

function parseAPBeacon(line, apStore, dashStore) {
  const m = line.match(AP_BEACON_RE)
  if (!m) return false

  const [, rssi, ch, bssid, essidRaw] = m
  const essid = essidRaw.replace(/[^\x20-\x7E]/g, '').trim() || '(hidden)'

  apStore.updateOrAddAP({
    rssi: safeInt(rssi),
    channel: safeInt(ch),
    bssid: bssid.toUpperCase(),
    essid: essid,
    isHidden: essid === '(hidden)' || essid === bssid.toUpperCase(),
    vendor: lookupVendor(bssid.toUpperCase()),
    lastSeen: new Date()
  })
  dashStore.addEvent('beacon', line)
  return true
}

function parseAPList(line, apStore, dashStore) {
  const re = /\[(\d+)\]\[CH:(\d+)\]\s+(.+)/
  const m = line.match(re)
  if (!m) return false

  const [, index, ch, rest] = m
  const isSelected = rest.includes('(selected)')
  let essid = rest.replace(/\(selected\)/g, '').trim()
  let rssi = null

  const rssiMatch = essid.match(/(-?\d+)$/)
  if (rssiMatch) {
    rssi = safeInt(rssiMatch[1])
    essid = essid.replace(/\s*-?\d+$/, '').trim()
  }

  const apData = {
    index: safeInt(index),
    channel: safeInt(ch),
    essid: essid || '(hidden)',
    rssi: rssi,
    lastSeen: new Date()
  }
  if (isSelected) apData.isSelected = true
  apStore.updateOrAddAP(apData)
  dashStore.addEvent('list', line)
  return true
}

function parseStationDetect(line, apStore, dashStore) {
  const m = line.match(STATION_DETECT_RE)
  if (!m) return false

  const [, id, firstType, firstMac, , secondType, secondMac] = m
  const apMac = firstType === 'ap' ? firstMac.toUpperCase() : secondMac.toUpperCase()
  const staMac = firstType === 'sta' ? firstMac.toUpperCase() : secondMac.toUpperCase()

  let found = false
  for (const [key, ap] of apStore.accessPoints) {
    if (ap.bssid && ap.bssid.toUpperCase() === apMac) {
      apStore.addStation(key, {
        id: safeInt(id),
        mac: staMac
      })
      found = true
      break
    }
  }

  if (!found) {
    apStore.updateOrAddAP({
      essid: '(unknown)',
      bssid: apMac,
      channel: 0,
      rssi: null,
      vendor: lookupVendor(apMac),
      lastSeen: new Date()
    })
    apStore.addStation(apMac, {
      id: safeInt(id),
      mac: staMac
    })
  }
  return true
}

export function parseDemoPacketCounts() {
  const store = useDashboardStore()
  store.setPacketCounts({
    beacon: Math.floor(Math.random() * 500) + 100,
    probe: Math.floor(Math.random() * 200) + 50,
    deauth: Math.floor(Math.random() * 100) + 10,
    eapol: Math.floor(Math.random() * 30) + 5,
    data: Math.floor(Math.random() * 1000) + 200,
    management: Math.floor(Math.random() * 300) + 50
  })
}

export function parseDemoChannelUtil() {
  const store = useDashboardStore()
  const util = {}
  for (let ch = 1; ch <= 13; ch++) {
    util[ch] = Math.floor(Math.random() * 200)
  }
  store.setChannelUtilization(util)
}

function parseStationList(line, apStore, dashStore) {
  const apRe = /^\[(\d+)\]\s+(.+)\s+(-?\d+):\s*$/
  const apM = line.match(apRe)
  if (apM) {
    const [, index, essid, rssi] = apM
    dashStore.setLastStationAP(safeInt(index), essid.trim())
    return true
  }

  const staM = line.match(STATION_LIST_STA_RE)
  if (staM) {
    const [, staIndex, staMac, ] = staM
    const apIndex = dashStore.lastStationAPIndex
    if (apIndex !== undefined) {
      for (const [key, ap] of apStore.accessPoints) {
        if (ap.index === apIndex) {
          apStore.addStation(key, {
            id: safeInt(staIndex),
            mac: staMac.toUpperCase(),
            isSelected: line.includes('(selected)')
          })
          dashStore.addEvent('station', line)
          break
        }
      }
    }
    return true
  }
  return false
}

function parseDeauthSniff(line, apStore, dashStore) {
  const m = line.match(DEAUTH_SNIFF_RE)
  if (!m) return false

  const [, rssi, ch, srcMac, , dstMac, ] = m
  dashStore.addEvent('deauth', `Deauth: ${srcMac} -> ${dstMac} Ch:${ch} RSSI:${rssi}`)
  dashStore.incrementPackets()
  return true
}

function parseProbeSniff(line, apStore, dashStore) {
  const m = line.match(PROBE_SNIFF_RE)
  if (!m) return false

  const [, rssi, ch, clientMac, , ssid] = m
  dashStore.addEvent('probe', `Probe: ${clientMac} -> ${ssid.trim()} Ch:${ch} RSSI:${rssi}`)
  dashStore.incrementPackets()
  const probeStore = useProbeStore()
  probeStore.addProbe(safeInt(rssi), safeInt(ch), clientMac, ssid.trim())
  return true
}

function parsePMKID(line, apStore, dashStore) {
  if (line.includes('Received EAPOL')) {
    const m = line.match(PMKID_CAPTURE_RE)
    if (m) {
      dashStore.addEvent('pmkid', `EAPOL: ${m[1].toUpperCase()}`)
      dashStore.incrementPackets()
      return true
    }
  }
  const pmkidCapturedRe = /^PMKID captured:\s*([0-9A-Fa-f:]{17})/
  const pmkidCapturedM = line.match(pmkidCapturedRe)
  if (pmkidCapturedM) {
    dashStore.addEvent('pmkid', `PMKID captured: ${pmkidCapturedM[1].toUpperCase()}`)
    dashStore.incrementPackets()
    return true
  }
  return false
}

function parseBLESniff(line, bleStore, dashStore) {
  const re = /^(-?\d+)\s+Device:\s+(.+)/
  const m = line.match(re)
  if (m) {
    const [, rssi, name] = m
    const isMac = MAC_RE.test(name)
    bleStore.updateOrAddDevice({
      mac: isMac ? name.toUpperCase() : `BLE:${rssi}-${++_bleKeyCounter}`,
      rssi: safeInt(rssi),
      name: isMac ? `BLE Device ${name}` : name.trim(),
      lastSeen: new Date()
    })
    dashStore.addEvent('ble', line)
    return true
  }

  const m2 = line.match(BLE_SNIFF_MAC_RE)
  if (m2) {
    const [, rssi, mac, ] = m2
    bleStore.updateOrAddDevice({
      mac: mac.toUpperCase(),
      rssi: safeInt(rssi),
      name: `BLE ${mac}`,
      lastSeen: new Date()
    })
    dashStore.addEvent('ble', line)
    return true
  }

  return false
}

function parseBLEMeta(line, bleStore, dashStore) {
  const re = /^Meta Device:\s*(-?\d+)\s+(.+)/
  const m = line.match(re)
  if (!m) return false

  const [, rssi, name] = m
  bleStore.updateOrAddDevice({
    mac: `META:${rssi}`,
    rssi: safeInt(rssi),
    name: `Meta: ${name.trim()}`,
    isAirtag: false,
    manufacturer: 'Meta/Ray-Ban',
    lastSeen: new Date()
  })
  dashStore.addEvent('ble', line)
  return true
}

function parseSignalMonitor(line, apStore, dashStore) {
  const re = /^(.+?)\s+RSSI:\s*(-?\d+)/
  const m = line.match(re)
  if (!m) return false

  const [, essid, rssi] = m
  for (const [key, ap] of apStore.accessPoints) {
    if (ap.essid === essid.trim()) {
      apStore.updateOrAddAP({
        ...ap,
        rssi: safeInt(rssi),
        lastSeen: new Date()
      })
      dashStore.addEvent('signal', line)
      return true
    }
  }
  return false
}

function parsePacketCount(line, store) {
  if (line.startsWith('Packet Statistics') || /^-{3,}$/.test(line)) {
    store.setPacketCounts({ beacon: 0, probe: 0, deauth: 0, eapol: 0, data: 0, management: 0 })
    return true
  }
  const re = /\b(beacon|probe|deauth|eapol|data|management)\s*:\s*(\d+)/i
  const m = line.match(re)
  if (!m) return false

  const [, type, count] = m
  const key = type.toLowerCase()
  if (['beacon', 'probe', 'deauth', 'eapol', 'data', 'management'].includes(key)) {
    store.setPacketCounts({ [key]: safeInt(count, 0) })
    return true
  }
  return false
}

function parseChannelAnalyzer(line, store) {
  if (line.startsWith('Channel Analyzer') || /^-{3,}$/.test(line)) {
    store.setChannelUtilization({})
    return true
  }
  const re = /\bCh\s*(\d+)\s*:\s*(\d+)/
  const m = line.match(re)
  if (!m) return false

  const [, ch, count] = m
  store.setChannelUtilization({ [safeInt(ch, 0)]: safeInt(count, 0) })
  return true
}

let _infoAPIndex = -1

function parseAPInfo(line, apStore) {
  const idxRe = /^Index:\s*(\d+)/
  const idxM = line.match(idxRe)
  if (idxM) {
    _infoAPIndex = safeInt(idxM[1], -1)
    return true
  }
  if (_infoAPIndex < 0) return false
  const bssidRe = /^BSSID:\s*([0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2})/
  const bssidM = line.match(bssidRe)
  if (bssidM) {
    apStore.updateAP(_infoAPIndex, { bssid: bssidM[1].toUpperCase() })
    return true
  }
  const secRe = /^Security:\s*(.+)/
  const secM = line.match(secRe)
  if (secM) {
    apStore.updateAP(_infoAPIndex, { encryption: secM[1].trim() })
    return true
  }
  const venRe = /^Vendor:\s*(.+)/
  const venM = line.match(venRe)
  if (venM) {
    apStore.updateAP(_infoAPIndex, { vendor: venM[1].trim() })
    return true
  }
  const chanRe = /^Channel:\s*(\d+)/
  const chanM = line.match(chanRe)
  if (chanM) {
    apStore.updateAP(_infoAPIndex, { channel: safeInt(chanM[1]) })
    return true
  }
  const rssiRe = /^RSSI:\s*(-?\d+)/
  const rssiM = line.match(rssiRe)
  if (rssiM) {
    apStore.updateAP(_infoAPIndex, { rssi: safeInt(rssiM[1]) })
    return true
  }
  const encRe = /^Encryption:\s*(.+)/
  const encM = line.match(encRe)
  if (encM) {
    apStore.updateAP(_infoAPIndex, { encryption: encM[1].trim() })
    return true
  }
  const essidRe = /^ESSID:\s*(.+)/
  const essidM = line.match(essidRe)
  if (essidM) {
    apStore.updateAP(_infoAPIndex, { essid: essidM[1].trim() })
    return true
  }
  const lastSeenRe = /^Last seen:\s*(.+)/
  const lastSeenM = line.match(lastSeenRe)
  if (lastSeenM) {
    return true
  }
  const stationsRe = /^Stations:\s*(\d+)/
  const stationsM = line.match(stationsRe)
  if (stationsM) {
    return true
  }
  _infoAPIndex = -1
  return false
}

let _ipListBuffer = []

function parseIPList(line, dashStore) {
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
    index: safeInt(idx),
    ip,
    mac: macMatch ? macMatch[1].toUpperCase() : ''
  })
  dashStore.setIPList([..._ipListBuffer])
  return true
}

function parseSystemMsg(line, store) {
  if (/^\[(INFO|WARN|ERROR|SYSTEM|APP)\]/.test(line)) {
    store.addEvent('system', line)
    return true
  }
  // Handle hash-prefixed commands like #sniffbeacon, #stopscan (Marauder output)
  if (/^#[a-z]+/i.test(line)) {
    store.addEvent('system', line)
    return true
  }
  if (/^(Starting|Stopping|Clearing|Scanning|Sniffing|Wardriving)/i.test(line)) {
    store.addEvent('system', line)
    return true
  }
  return false
}

export function parseDemoAP() {
  const store = useApStore()
  const PREFIXES = ['Home-', 'WiFi-', 'Network-', 'Guest-', 'Office-', 'IoT-']

  for (let i = 0; i < 10 + Math.floor(Math.random() * 15); i++) {
    const mac = Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join(':').toUpperCase()

    store.updateOrAddAP({
      index: i,
      bssid: mac,
      essid: PREFIXES[Math.floor(Math.random() * PREFIXES.length)] +
        Math.floor(Math.random() * 9999).toString().padStart(4, '0'),
      rssi: -(Math.floor(Math.random() * 60) + 30),
      channel: Math.floor(Math.random() * 13) + 1,
      isHidden: Math.random() < 0.1,
      isSelected: Math.random() < 0.2,
      vendor: lookupVendor(mac),
      lastSeen: new Date()
    })
  }
}

export function parseDemoBLE() {
  const store = useBleStore()
  const names = ['iPhone', 'AirPods', 'Apple Watch', 'Samsung Galaxy', 'Fitbit', 'AirTag']

  for (let i = 0; i < 5 + Math.floor(Math.random() * 8); i++) {
    const mac = Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join(':').toUpperCase()

    const name = names[Math.floor(Math.random() * names.length)]
    store.updateOrAddDevice({
      mac,
      name: `${name} ${Math.floor(Math.random() * 1000)}`,
      rssi: -(Math.floor(Math.random() * 70) + 30),
      isAirtag: name === 'AirTag',
      lastSeen: new Date()
    })
  }
}
