export interface AccessPoint {
  index?: number
  bssid?: string
  essid: string
  channel: number
  rssi: number | null
  vendor?: string
  isHidden?: boolean
  isSelected?: boolean
  encryption?: string
  lastSeen: Date
  stations?: Station[]
}

export interface Station {
  id: number
  mac: string
  isSelected?: boolean
}

export interface BLEDevice {
  mac: string
  name: string
  rssi: number
  isAirtag?: boolean
  manufacturer?: string
  lastSeen: Date
}

export interface DashboardEvent {
  type: string
  data: string
  time: Date
}

export interface PacketCounts {
  beacon: number
  probe: number
  deauth: number
  eapol: number
  data: number
  management: number
}

export interface ChannelUtilization {
  [channel: number]: number
}

export interface IPListEntry {
  index: number
  ip: string
  mac: string
}

export interface TerminalLine {
  text: string
  cls: string
}
