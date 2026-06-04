/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '../utils/oui' {
  export function lookupVendor(mac: string): string
}

declare module '../utils/ouiData' {
  export const OUI_DATA: Record<string, string>
}

declare module '../utils/ouiData.js' {
  export const OUI_DATA: Record<string, string>
}

declare module './utils/ouiData' {
  export const OUI_DATA: Record<string, string>
}

declare module './utils/ouiData.js' {
  export const OUI_DATA: Record<string, string>
}

declare module '../../utils/oui' {
  export function lookupVendor(mac: string): string
}

declare module '../stores/probeStore' {
  export function useProbeStore(): {
    addProbe(rssi: number, ch: number, mac: string, ssid: string): void
  }
}

declare module '../../stores/probeStore' {
  export function useProbeStore(): {
    addProbe(rssi: number, ch: number, mac: string, ssid: string): void
  }
}

declare module '../utils/idb' {
  export function putAll(storeName: string, items: any[]): Promise<void>
  export function clearStore(storeName: string): Promise<void>
  export function getAll(storeName: string): Promise<any[]>
  export function putItem(storeName: string, item: any): Promise<void>
  export function getItem(storeName: string, key: string): Promise<any>
}

declare module './idb' {
  export function putAll(storeName: string, items: any[]): Promise<void>
  export function clearStore(storeName: string): Promise<void>
  export function getAll(storeName: string): Promise<any[]>
  export function putItem(storeName: string, item: any): Promise<void>
  export function getItem(storeName: string, key: string): Promise<any>
}

declare module '../stores/apStore' {
  export function useApStore(): any
}

declare module '../stores/bleStore' {
  export function useBleStore(): any
}

declare module '../stores/dashboardStore' {
  export function useDashboardStore(): any
}

interface SerialPort {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  getInfo?(): { usbVendorId?: number; usbProductId?: number }
}

interface Serial {
  requestPort(options?: { filters?: { usbVendorId: number; usbProductId: number }[] }): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void
}

interface Navigator {
  serial?: Serial
}
