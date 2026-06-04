import type { AccessPoint, BLEDevice, DashboardEvent, PacketCounts, ChannelUtilization, IPListEntry } from './index'

export interface ParserContext {
  apStore: ApStoreLike
  bleStore: BleStoreLike
  dashStore: DashStoreLike
  infoAPIndex: number
  // Q-15: re-use the canonical IPListEntry shape from types/index.ts
  // instead of redefining an inline anonymous type. Keeping a single
  // source of truth prevents the two from drifting apart.
  ipListBuffer: IPListEntry[]
}

export interface ApStoreLike {
  accessPoints: Map<string, AccessPoint>
  updateOrAddAP(ap: Partial<AccessPoint>): void
  updateAP(index: number, fields: Partial<AccessPoint>): void
  findAPByBSSID(bssid: string): { key: string; ap: AccessPoint } | null
  findAPByIndex(index: number): { key: string; ap: AccessPoint } | null
  addStation(apKey: string, station: { id: number; mac: string; isSelected?: boolean }): void
  removeOldAPs(maxAge: number): void
}

export interface BleStoreLike {
  updateOrAddDevice(device: Partial<BLEDevice>): void
}

export interface DashStoreLike {
  events: DashboardEvent[]
  packetCounts: PacketCounts
  channelUtilization: ChannelUtilization
  lastStationAPIndex: number | null
  ipList: IPListEntry[]
  addEvent(type: string, data: string): void
  incrementPackets(n?: number): void
  setPacketCounts(counts: Partial<PacketCounts>): void
  setChannelUtilization(util: ChannelUtilization): void
  setLastStationAP(index: number, name: string): void
  setIPList(list: IPListEntry[]): void
  setSelectedAPInfo?(info: string): void
  addIP?(ip: string): void
}

export type ParserFn = (line: string, ctx: ParserContext) => boolean

export interface FirmwareProfile {
  name: string
  id: string
  description: string
  version: number
  DISPATCH: Record<number, ParserFn[]>
  FALLBACK_PARSERS: ParserFn[]
  resetState(): void
}
