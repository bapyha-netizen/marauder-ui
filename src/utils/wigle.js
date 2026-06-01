function escCsv(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function pad2(n) { return n < 10 ? '0' + n : '' + n }

function isoTime(d) {
  if (!d) return ''
  const dt = (d instanceof Date) ? d : new Date(d)
  if (isNaN(dt.getTime())) return ''
  const y = dt.getFullYear()
  const mo = pad2(dt.getMonth() + 1)
  const da = pad2(dt.getDate())
  const h = pad2(dt.getHours())
  const mi = pad2(dt.getMinutes())
  const se = pad2(dt.getSeconds())
  return `${y}-${mo}-${da} ${h}:${mi}:${se}`
}

export function apsToWigle(aps) {
  const HEADER = [
    'MAC',
    'SSID',
    'AuthMode',
    'FirstSeen',
    'Channel',
    'RSSI',
    'CurrentLatitude',
    'CurrentLongitude',
    'AltitudeMeters',
    'AccuracyMeters',
    'Type'
  ]
  const rows = [HEADER.join(',')]
  for (const ap of aps) {
    const mac = (ap.bssid || '').toUpperCase()
    if (!mac || !/^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(mac)) continue
    const row = [
      mac,
      escCsv(ap.essid || ''),
      escCsv(ap.encryption || ''),
      isoTime(ap.lastSeen),
      ap.channel || '',
      ap.rssi ?? '',
      '',
      '',
      '',
      '',
      'WIFI'
    ]
    rows.push(row.join(','))
  }
  return rows.join('\n')
}

export function bleToWigle(ble) {
  const HEADER = [
    'MAC',
    'Name',
    'FirstSeen',
    'RSSI',
    'Type'
  ]
  const rows = [HEADER.join(',')]
  for (const dev of ble) {
    const mac = (dev.mac || '').toUpperCase()
    if (!mac) continue
    const row = [
      mac,
      escCsv(dev.name || ''),
      isoTime(dev.lastSeen),
      dev.rssi ?? '',
      'BLE'
    ]
    rows.push(row.join(','))
  }
  return rows.join('\n')
}

export function probesToWigle(probes) {
  const HEADER = [
    'ClientMAC',
    'SSID',
    'RSSI',
    'Channel',
    'FirstSeen',
    'Type'
  ]
  const rows = [HEADER.join(',')]
  for (const p of probes) {
    const mac = (p.clientMac || '').toUpperCase()
    if (!mac) continue
    const row = [
      mac,
      escCsv(p.ssid || ''),
      p.rssi ?? '',
      p.ch ?? '',
      isoTime(p.time),
      'WIFI'
    ]
    rows.push(row.join(','))
  }
  return rows.join('\n')
}

export function downloadWigle(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
