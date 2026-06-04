import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../utils/oui', () => ({
  lookupVendor: (mac) => {
    if (!mac) return ''
    if (mac.startsWith('AA:BB:CC')) return 'TestVendor'
    if (mac.startsWith('00:11:22')) return 'AnotherVendor'
    if (mac.startsWith('FF:EE:DD')) return 'UnknownVendor'
    return ''
  }
}))

import { useApStore } from '../../stores/apStore'
import { useBleStore } from '../../stores/bleStore'
import { useDashboardStore } from '../../stores/dashboardStore'
import { useProbeStore } from '../../stores/probeStore'
import { parseLine, parseDemoAP, parseDemoBLE, parseDemoPacketCounts, parseDemoChannelUtil, startParser, stopParser, resetCtxCache } from '../parserEngine.ts'

describe('parseLine — ESP32 Marauder output parser', () => {
  let apStore, bleStore, dashStore, probeStore

  beforeEach(() => {
    setActivePinia(createPinia())
    resetCtxCache()
    apStore = useApStore()
    bleStore = useBleStore()
    dashStore = useDashboardStore()
    probeStore = useProbeStore()
  })

  describe('parseAPBeacon', () => {
    it('parses standard beacon with ESSID', () => {
      parseLine('-65 Ch: 6 AA:BB:CC:11:22:33 ESSID: HomeNet')
      const ap = apStore.accessPoints.get('AA:BB:CC:11:22:33')
      expect(ap).toBeDefined()
      expect(ap.essid).toBe('HomeNet')
      expect(ap.channel).toBe(6)
      expect(ap.rssi).toBe(-65)
      expect(ap.vendor).toBe('TestVendor')
      expect(ap.isHidden).toBe(false)
    })

    it('parses hidden ESSID', () => {
      parseLine('-70 Ch: 1 AA:BB:CC:44:55:66 ESSID: AA:BB:CC:44:55:66')
      const ap = apStore.accessPoints.get('AA:BB:CC:44:55:66')
      expect(ap.essid).toBe('AA:BB:CC:44:55:66')
      expect(ap.isHidden).toBe(true)
    })

    it('parses empty ESSID as (hidden)', () => {
      parseLine('-80 Ch: 11 AA:BB:CC:77:88:99 ESSID: ')
      const ap = apStore.accessPoints.get('AA:BB:CC:77:88:99')
      expect(ap.essid).toBe('(hidden)')
      expect(ap.isHidden).toBe(true)
    })

    it('strips non-printable characters from ESSID', () => {
      parseLine('-50 Ch: 3 AA:BB:CC:AA:BB:CC ESSID: \x01\x02Test\x03')
      const ap = apStore.accessPoints.get('AA:BB:CC:AA:BB:CC')
      expect(ap.essid).toBe('Test')
    })

    it('handles negative RSSI', () => {
      parseLine('-95 Ch: 13 AA:BB:CC:DE:AD:BE ESSID: Weak')
      const ap = apStore.accessPoints.get('AA:BB:CC:DE:AD:BE')
      expect(ap.rssi).toBe(-95)
    })

    it('emits beacon event', () => {
      parseLine('-60 Ch: 6 AA:BB:CC:11:22:33 ESSID: Test')
      const ev = dashStore.events
      expect(ev[ev.length - 1].type).toBe('beacon')
    })
  })

  describe('parseAPList (list -a output)', () => {
    it('parses AP list entry with ESSID and RSSI', () => {
      parseLine('[0][CH:6] MyNetwork -65')
      const ap = Array.from(apStore.accessPoints.values())[0]
      expect(ap.essid).toBe('MyNetwork')
      expect(ap.channel).toBe(6)
      expect(ap.rssi).toBe(-65)
      expect(ap.index).toBe(0)
    })

    it('parses AP with (selected) flag', () => {
      parseLine('[1][CH:11] OfficeWiFi (selected) -72')
      const ap = Array.from(apStore.accessPoints.values())[0]
      expect(ap.essid).toBe('OfficeWiFi')
      expect(ap.isSelected).toBe(true)
    })

    it('parses AP without RSSI', () => {
      parseLine('[2][CH:1] NoSignal')
      const ap = Array.from(apStore.accessPoints.values())[0]
      expect(ap.essid).toBe('NoSignal')
      expect(ap.rssi).toBe(null)
    })

    it('handles negative channel indexes (edge case)', () => {
      parseLine('[5][CH:3] TestAP -60')
      const ap = Array.from(apStore.accessPoints.values())[0]
      expect(ap.index).toBe(5)
    })
  })

  describe('parseStationDetect', () => {
    it('parses ap -> sta detection', () => {
      parseLine('-65 Ch: 6 AA:BB:CC:11:22:33 ESSID: Home')
      parseLine('42: ap: AA:BB:CC:11:22:33 -> sta: 00:11:22:33:44:55')
      const ap = apStore.accessPoints.get('AA:BB:CC:11:22:33')
      expect(ap.stations.length).toBe(1)
      expect(ap.stations[0].mac).toBe('00:11:22:33:44:55')
      expect(ap.stations[0].id).toBe(42)
    })

    it('parses sta -> ap detection', () => {
      parseLine('-65 Ch: 6 AA:BB:CC:11:22:33 ESSID: Home')
      parseLine('7: sta: 00:11:22:33:44:55 -> ap: AA:BB:CC:11:22:33')
      const ap = apStore.accessPoints.get('AA:BB:CC:11:22:33')
      expect(ap.stations.length).toBe(1)
      expect(ap.stations[0].mac).toBe('00:11:22:33:44:55')
    })

    it('creates unknown AP if BSSID not seen before', () => {
      parseLine('99: ap: FF:EE:DD:CC:BB:AA -> sta: 00:11:22:33:44:55')
      const ap = apStore.accessPoints.get('FF:EE:DD:CC:BB:AA')
      expect(ap).toBeDefined()
      expect(ap.essid).toBe('(unknown)')
      expect(ap.stations.length).toBe(1)
      expect(ap.stations[0].mac).toBe('00:11:22:33:44:55')
    })
  })

  describe('parseStationList (list -c output)', () => {
    beforeEach(() => {
      apStore.updateOrAddAP({
        index: 0,
        essid: 'HomeNet',
        bssid: 'AA:BB:CC:11:22:33',
        channel: 6,
        rssi: -65
      })
    })

    it('captures AP header for next station', () => {
      parseLine('[0] HomeNet -65:')
      expect(dashStore.lastStationAPIndex).toBe(0)
      expect(dashStore.lastStationAPName).toBe('HomeNet')
    })

    it('appends station to correct AP', () => {
      parseLine('[0] HomeNet -65:')
      parseLine('  [5] 00:11:22:33:44:55')
      const ap = apStore.accessPoints.get('AA:BB:CC:11:22:33')
      expect(ap.stations.length).toBe(1)
      expect(ap.stations[0].id).toBe(5)
    })

    it('marks (selected) station', () => {
      parseLine('[0] HomeNet -65:')
      parseLine('  [3] 00:11:22:33:44:55 (selected)')
      const ap = apStore.accessPoints.get('AA:BB:CC:11:22:33')
      expect(ap.stations[0].isSelected).toBe(true)
    })
  })

  describe('parseDeauthSniff', () => {
    it('parses deauth packet', () => {
      parseLine('-65 Ch: 6 AA:BB:CC:11:22:33 -> 00:11:22:33:44:55')
      expect(dashStore.packetsCaptured).toBe(1)
      const ev = dashStore.events
      expect(ev[ev.length - 1].type).toBe('deauth')
    })

    it('parses multiple deauth packets', () => {
      parseLine('-65 Ch: 6 AA:BB:CC:11:22:33 -> 00:11:22:33:44:55')
      parseLine('-72 Ch: 1 CC:DD:EE:FF:00:11 -> 22:33:44:55:66:77')
      parseLine('-80 Ch: 11 DD:EE:FF:00:11:22 -> 33:44:55:66:77:88')
      expect(dashStore.packetsCaptured).toBe(3)
    })
  })

  describe('parseProbeSniff', () => {
    it('parses probe request', () => {
      parseLine('-65 Ch: 6 Client: 00:11:22:33:44:55 Requesting: CoffeeShop')
      expect(dashStore.packetsCaptured).toBe(1)
      expect(probeStore.probes.length).toBe(1)
      expect(probeStore.probes[0].ssid).toBe('CoffeeShop')
      expect(probeStore.probes[0].clientMac).toBe('00:11:22:33:44:55')
    })

    it('strips trailing whitespace from SSID', () => {
      parseLine('-65 Ch: 6 Client: 00:11:22:33:44:55 Requesting: Trailing   ')
      expect(probeStore.probes[0].ssid).toBe('Trailing')
    })
  })

  describe('parsePMKID', () => {
    it('parses EAPOL capture', () => {
      parseLine('Received EAPOL: AA:BB:CC:11:22:33')
      expect(dashStore.packetsCaptured).toBe(1)
      const ev = dashStore.events
      expect(ev[ev.length - 1].type).toBe('pmkid')
    })

    it('ignores non-PMKID lines', () => {
      parseLine('Some random line without EAPOL')
      expect(dashStore.packetsCaptured).toBe(0)
    })

    it('parses PMKID captured line', () => {
      parseLine('PMKID captured: AA:BB:CC:11:22:33')
      expect(dashStore.packetsCaptured).toBe(1)
      const ev = dashStore.events
      expect(ev[ev.length - 1].type).toBe('pmkid')
    })
  })

  describe('parseBLESniff', () => {
    it('parses BLE device with name', () => {
      parseLine('-45 Device: iPhone 15 Pro')
      expect(bleStore.deviceCount).toBe(1)
      const dev = Array.from(bleStore.devices.values())[0]
      expect(dev.name).toBe('iPhone 15 Pro')
      expect(dev.rssi).toBe(-45)
    })

    it('parses BLE device with MAC', () => {
      parseLine('-65 AA:BB:CC:11:22:33')
      expect(bleStore.deviceCount).toBe(1)
      const dev = Array.from(bleStore.devices.values())[0]
      expect(dev.mac).toBe('AA:BB:CC:11:22:33')
    })

    it('deduplicates same BLE device name', () => {
      parseLine('-50 Device: AirPods')
      parseLine('-50 Device: AirPods')
      expect(bleStore.deviceCount).toBe(1)
      const dev = Array.from(bleStore.devices.values())[0]
      expect(dev.name).toBe('AirPods')
    })
  })

  describe('parseBLEMeta', () => {
    it('parses Meta/Ray-Ban device', () => {
      parseLine('Meta Device: -55 Ray-Ban Stories')
      expect(bleStore.deviceCount).toBe(1)
      const dev = Array.from(bleStore.devices.values())[0]
      expect(dev.name).toBe('Meta: Ray-Ban Stories')
      expect(dev.manufacturer).toBe('Meta/Ray-Ban')
    })
  })

  describe('parseSignalMonitor', () => {
    it('updates RSSI of existing AP', () => {
      parseLine('-65 Ch: 6 AA:BB:CC:11:22:33 ESSID: HomeNet')
      parseLine('HomeNet RSSI: -75')
      const ap = apStore.accessPoints.get('AA:BB:CC:11:22:33')
      expect(ap.rssi).toBe(-75)
    })

    it('ignores unknown SSID', () => {
      parseLine('UnknownNet RSSI: -80')
      expect(dashStore.events.filter(e => e.type === 'signal').length).toBe(0)
    })
  })

  describe('parsePacketCount', () => {
    it('parses individual packet type counts', () => {
      parseLine('beacon: 100')
      parseLine('probe: 50')
      parseLine('deauth: 10')
      expect(dashStore.packetCounts.beacon).toBe(100)
      expect(dashStore.packetCounts.probe).toBe(50)
      expect(dashStore.packetCounts.deauth).toBe(10)
    })

    it('resets counts on header line', () => {
      parseLine('beacon: 100')
      parseLine('Packet Statistics')
      expect(dashStore.packetCounts.beacon).toBe(0)
    })

    it('handles case-insensitive type names', () => {
      parseLine('Beacon: 200')
      expect(dashStore.packetCounts.beacon).toBe(200)
    })
  })

  describe('parseChannelAnalyzer', () => {
    it('parses channel utilization', () => {
      parseLine('Ch 1: 50')
      parseLine('Ch 6: 100')
      parseLine('Ch 11: 75')
      expect(dashStore.channelUtilization[1]).toBe(50)
      expect(dashStore.channelUtilization[6]).toBe(100)
      expect(dashStore.channelUtilization[11]).toBe(75)
    })

    it('resets on header', () => {
      parseLine('Ch 1: 50')
      parseLine('Channel Analyzer')
      expect(dashStore.channelUtilization[1]).toBeUndefined()
    })
  })

  describe('parseAPInfo', () => {
    beforeEach(() => {
      apStore.updateOrAddAP({
        index: 1,
        essid: 'TestNet',
        bssid: 'AA:BB:CC:11:22:33',
        channel: 1,
        rssi: -50
      })
      apStore.updateOrAddAP({
        index: 5,
        essid: 'TestNet5',
        bssid: '',
        channel: 1,
        rssi: -50
      })
    })

    it('parses Index line and starts collecting', () => {
      parseLine('Index: 5')
      parseLine('BSSID: AA:BB:CC:11:22:33')
      const ap = apStore.accessPoints.get('AA:BB:CC:11:22:33')
      expect(ap).toBeDefined()
    })

    it('parses Security field', () => {
      parseLine('Index: 1')
      parseLine('Security: WPA2-PSK')
      const ap = Array.from(apStore.accessPoints.values()).find(a => a.encryption === 'WPA2-PSK')
      expect(ap).toBeDefined()
    })

    it('parses multiple info fields for one AP', () => {
      parseLine('Index: 1')
      parseLine('BSSID: AA:BB:CC:11:22:33')
      parseLine('Security: WPA3')
      parseLine('Vendor: TestVendor')
      parseLine('Channel: 6')
      parseLine('RSSI: -65')
      const ap = apStore.accessPoints.get('AA:BB:CC:11:22:33')
      expect(ap.vendor).toBe('TestVendor')
      expect(ap.channel).toBe(6)
      expect(ap.rssi).toBe(-65)
    })

    it('parses ESSID field in info', () => {
      apStore.updateOrAddAP({
        index: 2,
        bssid: 'AA:BB:CC:11:22:44',
        essid: 'OldName',
        channel: 1,
        rssi: -50
      })
      parseLine('Index: 2')
      parseLine('BSSID: AA:BB:CC:11:22:44')
      parseLine('ESSID: NewNetwork')
      const ap = apStore.accessPoints.get('AA:BB:CC:11:22:44')
      expect(ap.essid).toBe('NewNetwork')
    })

    it('handles Last seen / Stations fields without error', () => {
      apStore.updateOrAddAP({
        index: 3,
        bssid: 'AA:BB:CC:11:22:55',
        essid: 'Test',
        channel: 1,
        rssi: -50
      })
      parseLine('Index: 3')
      parseLine('BSSID: AA:BB:CC:11:22:55')
      parseLine('Last seen: 5s')
      parseLine('Stations: 3')
      const ap = apStore.accessPoints.get('AA:BB:CC:11:22:55')
      expect(ap).toBeDefined()
    })
  })

  describe('parseIPList', () => {
    it('parses IP list entry', () => {
      parseLine('IP List')
      parseLine('[0] 192.168.1.1 AA:BB:CC:11:22:33')
      expect(dashStore.ipList.length).toBe(1)
      expect(dashStore.ipList[0].ip).toBe('192.168.1.1')
      expect(dashStore.ipList[0].mac).toBe('AA:BB:CC:11:22:33')
    })

    it('handles entries without MAC', () => {
      parseLine('IP List')
      parseLine('[0] 192.168.1.1')
      expect(dashStore.ipList[0].mac).toBe('')
    })
  })

  describe('parseSystemMsg', () => {
    it('parses [INFO] message', () => {
      parseLine('[INFO] System initialized')
      const ev = dashStore.events
      expect(ev[ev.length - 1].type).toBe('system')
    })

    it('parses [WARN] message', () => {
      parseLine('[WARN] Low battery')
      const ev = dashStore.events
      expect(ev[ev.length - 1].type).toBe('system')
    })

    it('parses [ERROR] message', () => {
      parseLine('[ERROR] Failed to connect')
      const ev = dashStore.events
      expect(ev[ev.length - 1].type).toBe('system')
    })

    it('parses action messages', () => {
      parseLine('Starting scan...')
      parseLine('Sniffing BLE...')
      expect(dashStore.events.filter(e => e.type === 'system').length).toBe(2)
    })
  })

  describe('Line filtering', () => {
    it('skips empty lines', () => {
      parseLine('')
      parseLine('   ')
      expect(dashStore.events.length).toBe(0)
    })

    it('skips prompt lines (>)', () => {
      parseLine('> ')
      parseLine('> scanall')
      expect(dashStore.events.length).toBe(0)
    })

    it('skips comment lines (#)', () => {
      parseLine('# This is a comment')
      expect(dashStore.events.length).toBe(0)
    })
  })

  describe('NaN safety (corrupted ESP32 output)', () => {
    it('parseAPBeacon never stores NaN rssi', () => {
      parseLine('-65 Ch: 6 AA:BB:CC:11:22:33 ESSID: Good')
      parseLine('   Ch: 6 AA:BB:CC:11:22:44 ESSID: NaNRssi')
      const ap2 = apStore.accessPoints.get('AA:BB:CC:11:22:44')
      if (ap2) {
        expect(Number.isNaN(ap2.rssi)).toBe(false)
      }
    })

    it('parseAPList handles malformed rssi without NaN', () => {
      parseLine('[0][CH:6] MyNetwork -65')
      parseLine('[1][CH:11] OfficeWiFi (selected) -72')
      for (const ap of apStore.accessPoints.values()) {
        if (ap.rssi !== null) {
          expect(Number.isNaN(ap.rssi)).toBe(false)
        }
      }
    })

    it('parseChannelAnalyzer never stores NaN key/value', () => {
      parseLine('Ch 1: 50')
      parseLine('Ch 6: 100')
      parseLine('Ch 11: 75')
      for (const [ch, count] of Object.entries(dashStore.channelUtilization)) {
        expect(Number.isNaN(parseInt(ch))).toBe(false)
        expect(Number.isNaN(count)).toBe(false)
      }
    })

    it('parsePacketCount never stores NaN count', () => {
      parseLine('beacon: 100')
      parseLine('probe: 50')
      parseLine('deauth: 10')
      for (const [key, val] of Object.entries(dashStore.packetCounts)) {
        expect(Number.isNaN(val)).toBe(false)
      }
    })

    it('parseAPInfo never stores NaN channel or rssi', () => {
      apStore.updateOrAddAP({
        index: 1,
        essid: 'TestNet',
        bssid: 'AA:BB:CC:11:22:33',
        channel: 1,
        rssi: -50
      })
      parseLine('Index: 1')
      parseLine('BSSID: AA:BB:CC:11:22:33')
      parseLine('Channel: 6')
      parseLine('RSSI: -65')
      const ap = apStore.accessPoints.get('AA:BB:CC:11:22:33')
      expect(Number.isNaN(ap.channel)).toBe(false)
      expect(Number.isNaN(ap.rssi)).toBe(false)
    })
  })

  describe('resetParserState', () => {
    it('resets parser globals on disconnect', async () => {
      const { resetParserState } = await import('../parserEngine.ts')
      parseLine('Index: 5')
      parseLine('BSSID: AA:BB:CC:11:22:33')
      expect(() => resetParserState()).not.toThrow()
    })
  })
})

describe('Demo generators', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetCtxCache()
  })

  describe('parseDemoAP', () => {
    it('generates 10-24 APs', () => {
      parseDemoAP()
      const aps = useApStore().accessPoints
      expect(aps.size).toBeGreaterThanOrEqual(10)
      expect(aps.size).toBeLessThanOrEqual(25)
    })

    it('each AP has required fields', () => {
      parseDemoAP()
      for (const ap of useApStore().accessPoints.values()) {
        expect(ap.bssid).toMatch(/^[0-9A-F:]{17}$/)
        expect(ap.essid).toBeTruthy()
        expect(ap.rssi).toBeGreaterThanOrEqual(-100)
        expect(ap.rssi).toBeLessThanOrEqual(0)
        expect(ap.channel).toBeGreaterThanOrEqual(1)
        expect(ap.channel).toBeLessThanOrEqual(13)
      }
    })
  })

  describe('parseDemoBLE', () => {
    it('generates 5-12 BLE devices', () => {
      parseDemoBLE()
      const devs = useBleStore().devices
      expect(devs.size).toBeGreaterThanOrEqual(5)
      expect(devs.size).toBeLessThanOrEqual(13)
    })
  })

  describe('parseDemoPacketCounts', () => {
    it('generates packet counts', () => {
      parseDemoPacketCounts()
      const counts = useDashboardStore().packetCounts
      expect(counts.beacon).toBeGreaterThan(0)
      expect(counts.probe).toBeGreaterThan(0)
      expect(counts.deauth).toBeGreaterThan(0)
      expect(counts.eapol).toBeGreaterThan(0)
      expect(counts.data).toBeGreaterThan(0)
      expect(counts.management).toBeGreaterThan(0)
    })
  })

  describe('parseDemoChannelUtil', () => {
    it('generates channel utilization for channels 1-13', () => {
      parseDemoChannelUtil()
      const util = useDashboardStore().channelUtilization
      for (let ch = 1; ch <= 13; ch++) {
        expect(util[ch]).toBeGreaterThanOrEqual(0)
        expect(util[ch]).toBeLessThan(200)
      }
    })
  })
})

describe('startParser / stopParser', () => {
  it('startParser runs without error', () => {
    expect(() => startParser()).not.toThrow()
  })

  it('stopParser cleans up interval', () => {
    startParser()
    expect(() => stopParser()).not.toThrow()
  })

  it('stopParser without start is safe', () => {
    expect(() => stopParser()).not.toThrow()
  })
})
