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
    const out: Array<{ text: string; cls: string }> = [
        { text: 'ESP32 Marauder', cls: 'text-blue-400' },
        { text: 'By: justcallmekoko', cls: 'text-blue-400' },
        { text: '> scanall', cls: 'text-cyan-400' },
        { text: 'Scanning for APs and Stations. Stop with stopscan', cls: 'text-green-400' }
    ]
    for (const ap of aps.slice(0, 8)) {
        out.push({
            text: `${ap.rssi} Ch: ${ap.channel} ${ap.bssid} ESSID: ${ap.essid}`,
            cls: 'text-green-400'
        })
    }
    out.push({ text: '> list -a', cls: 'text-cyan-400' })
    aps.slice(0, 10).forEach((ap, i) => {
        out.push({
            text: `[${i}][CH:${ap.channel}] ${ap.essid} ${ap.rssi}`,
            cls: 'text-green-400'
        })
    })
    out.push({ text: '> sniffdeauth', cls: 'text-cyan-400' })
    out.push({ text: 'Starting Deauth sniff. Stop with stopscan', cls: 'text-green-400' })
    out.push({ text: '-65 Ch: 6 AA:BB:CC:DD:EE:FF -> 11:22:33:44:55:66', cls: 'text-red-400' })
    out.push({ text: '-72 Ch: 1 00:11:22:33:44:55 -> 66:77:88:99:AA:BB', cls: 'text-red-400' })
    out.push({ text: '> sniffbt', cls: 'text-cyan-400' })
    out.push({ text: 'Starting Bluetooth scan. Stop with stopscan', cls: 'text-green-400' })
    out.push({ text: '-45 Device: iPhone 15 Pro', cls: 'text-purple-400' })
    out.push({ text: '-62 Device: AirPods Pro', cls: 'text-purple-400' })
    out.push({ text: '-38 Device: AA:BB:CC:DD:EE:FF', cls: 'text-purple-400' })
    aps.slice(0, 3).forEach((_ap, i) => {
        out.push({
            text: `${i}: ap: ${generateMAC()} -> sta: ${generateMAC()}`,
            cls: 'text-yellow-400'
        })
    })
    return out
}
