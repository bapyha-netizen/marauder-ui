import { escHtml } from './format'

interface Station {
  id: number
  mac: string
  vendor: string
  lastSeen: Date
}

interface Ap {
  index: number
  bssid: string
  essid: string
  rssi: number
  channel: number
  isHidden: boolean
  isSelected: boolean
  lastSeen: Date
  stations: Station[]
}

const VENDORS = ['Cisco', 'TP-Link', 'Netgear', 'D-Link', 'Asus', 'Linksys', 'Ubiquiti']
const SSID_PREFIXES = ['Home-', 'WiFi-', 'Network-', 'Guest-', 'Office-', 'IoT-']

function generateMAC() {
    return Array.from({ length: 6 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join(':').toUpperCase()
}

function generateSSID() {
    const prefix = SSID_PREFIXES[Math.floor(Math.random() * SSID_PREFIXES.length)]
    const suffix = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
    return `${prefix}${suffix}`
}

function generateRSSI() {
    return -(Math.floor(Math.random() * 60) + 30)
}

function generateChannel() {
    return Math.floor(Math.random() * 13) + 1
}

export function generateDemoData(): Ap[] {
    const apCount = 10 + Math.floor(Math.random() * 10)
    const aps: Ap[] = []

    for (let i = 0; i < apCount; i++) {
        const ap: Ap = {
            index: i,
            bssid: generateMAC(),
            essid: generateSSID(),
            rssi: generateRSSI(),
            channel: generateChannel(),
            isHidden: Math.random() < 0.1,
            isSelected: Math.random() < 0.2,
            lastSeen: new Date(),
            stations: []
        }

        const stationCount = Math.floor(Math.random() * 6)
        for (let j = 0; j < stationCount; j++) {
            ap.stations.push({
                id: j,
                mac: generateMAC(),
                vendor: VENDORS[Math.floor(Math.random() * VENDORS.length)],
                lastSeen: new Date(Date.now() - Math.random() * 3600000)
            })
        }

        aps.push(ap)
    }

    return aps
}

export function generateDemoTerminalOutput(): Array<{ text: string; cls: string }> {
    const aps = generateDemoData()
    const raw: string[] = [
        '<span class="text-blue-400">ESP32 Marauder</span>',
        '<span class="text-blue-400">By: justcallmekoko</span>',
        '<span class="text-cyan-400">> scanall</span>',
        '<span class="text-green-400">Scanning for APs and Stations. Stop with stopscan</span>',
        ...aps.slice(0, 8).map(ap =>
            `<span class="text-green-400">${ap.rssi} Ch: ${escHtml(ap.channel)} ${escHtml(ap.bssid)} ESSID: ${escHtml(ap.essid)}</span>`
        ),
        '<span class="text-cyan-400">> list -a</span>',
        ...aps.slice(0, 10).map((ap, i) =>
            `<span class="text-green-400">[${i}][CH:${escHtml(ap.channel)}] ${escHtml(ap.essid)} ${ap.rssi}</span>`
        ),
        '<span class="text-cyan-400">> sniffdeauth</span>',
        '<span class="text-green-400">Starting Deauth sniff. Stop with stopscan</span>',
        '<span class="text-red-400">-65 Ch: 6 AA:BB:CC:DD:EE:FF -> 11:22:33:44:55:66</span>',
        '<span class="text-red-400">-72 Ch: 1 00:11:22:33:44:55 -> 66:77:88:99:AA:BB</span>',
        '<span class="text-cyan-400">> sniffbt</span>',
        '<span class="text-green-400">Starting Bluetooth scan. Stop with stopscan</span>',
        '<span class="text-purple-400">-45 Device: iPhone 15 Pro</span>',
        '<span class="text-purple-400">-62 Device: AirPods Pro</span>',
        '<span class="text-purple-400">-38 Device: AA:BB:CC:DD:EE:FF</span>'
    ]

    raw.push(...aps.slice(0, 3).map((ap, i) =>
        `<span class="text-yellow-400">${i}: ap: ${escHtml(ap.bssid)} -> sta: ${escHtml(generateMAC())}</span>`
    ))

    return raw.map(html => ({ text: html, cls: '' }))
}
