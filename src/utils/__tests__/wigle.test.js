import { describe, it, expect } from 'vitest'
import { apsToWigle, bleToWigle, probesToWigle } from '../wigle'

describe('wigle CSV export', () => {
  describe('apsToWigle', () => {
    it('produces Wigle header', () => {
      const csv = apsToWigle([])
      const header = csv.split('\n')[0]
      expect(header).toBe('MAC,SSID,AuthMode,FirstSeen,Channel,RSSI,CurrentLatitude,CurrentLongitude,AltitudeMeters,AccuracyMeters,Type')
    })

    it('formats a single AP row with uppercase MAC', () => {
      const csv = apsToWigle([{
        bssid: 'aa:bb:cc:11:22:33',
        essid: 'Home',
        encryption: 'WPA2',
        channel: 6,
        rssi: -65,
        lastSeen: new Date('2026-01-15T10:30:45Z')
      }])
      const lines = csv.split('\n')
      expect(lines).toHaveLength(2)
      const cells = lines[1].split(',')
      expect(cells[0]).toBe('AA:BB:CC:11:22:33')
      expect(cells[1]).toBe('Home')
      expect(cells[2]).toBe('WPA2')
      expect(cells[4]).toBe('6')
      expect(cells[5]).toBe('-65')
      expect(cells[10]).toBe('WIFI')
    })

    it('skips APs without a valid MAC', () => {
      const csv = apsToWigle([
        { bssid: 'invalid', essid: 'Bad' },
        { bssid: 'AA:BB:CC:11:22:33', essid: 'Good' }
      ])
      const lines = csv.split('\n')
      expect(lines).toHaveLength(2)
      expect(lines[1].split(',')[0]).toBe('AA:BB:CC:11:22:33')
    })

    it('quotes SSIDs containing commas or quotes', () => {
      const csv = apsToWigle([{
        bssid: 'AA:BB:CC:11:22:33',
        essid: 'My,Net"ork',
        lastSeen: new Date('2026-01-15T10:30:00Z')
      }])
      const lines = csv.split('\n')
      expect(lines[1]).toContain('"My,Net""ork"')
    })

    it('handles null/undefined rssi', () => {
      const csv = apsToWigle([{
        bssid: 'AA:BB:CC:11:22:33',
        essid: 'NoRssi',
        lastSeen: new Date('2026-01-15T10:30:00Z')
      }])
      const lines = csv.split('\n')
      const cells = lines[1].split(',')
      expect(cells[5]).toBe('')
    })

    it('leaves GPS columns empty (user adds manually in Wigle UI)', () => {
      const csv = apsToWigle([{
        bssid: 'AA:BB:CC:11:22:33',
        essid: 'A',
        lastSeen: new Date()
      }])
      const cells = csv.split('\n')[1].split(',')
      expect(cells[6]).toBe('')
      expect(cells[7]).toBe('')
      expect(cells[8]).toBe('')
      expect(cells[9]).toBe('')
    })
  })

  describe('bleToWigle', () => {
    it('produces BLE header', () => {
      const csv = bleToWigle([])
      expect(csv.split('\n')[0]).toBe('MAC,Name,FirstSeen,RSSI,Type')
    })

    it('formats a single BLE device', () => {
      const csv = bleToWigle([{
        mac: 'aa:bb:cc:11:22:33',
        name: 'iPhone 15',
        rssi: -55,
        lastSeen: new Date('2026-01-15T10:30:00Z')
      }])
      const lines = csv.split('\n')
      const cells = lines[1].split(',')
      expect(cells[0]).toBe('AA:BB:CC:11:22:33')
      expect(cells[1]).toBe('iPhone 15')
      expect(cells[3]).toBe('-55')
      expect(cells[4]).toBe('BLE')
    })
  })

  describe('probesToWigle', () => {
    it('produces probe header', () => {
      const csv = probesToWigle([])
      expect(csv.split('\n')[0]).toBe('ClientMAC,SSID,RSSI,Channel,FirstSeen,Type')
    })

    it('formats probe with client MAC uppercase', () => {
      const csv = probesToWigle([{
        clientMac: 'aa:bb:cc:11:22:33',
        ssid: 'CoffeeShop',
        rssi: -60,
        ch: 6,
        time: new Date('2026-01-15T10:30:00Z')
      }])
      const lines = csv.split('\n')
      const cells = lines[1].split(',')
      expect(cells[0]).toBe('AA:BB:CC:11:22:33')
      expect(cells[1]).toBe('CoffeeShop')
      expect(cells[2]).toBe('-60')
      expect(cells[3]).toBe('6')
      expect(cells[5]).toBe('WIFI')
    })
  })
})
