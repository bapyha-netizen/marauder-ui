export interface SerialPortInfo {
  usbVendorId?: number
  usbProductId?: number
}

export interface SerialConnectionOptions {
  baudRate?: number
  filters?: { usbVendorId: number; usbProductId: number }[]
}

export interface CommandStep {
  command?: string
  delay?: number
}

export type TerminalLineType = 'normal' | 'success' | 'error' | 'command' | 'warning' | 'data' | 'system'

export const TERMINAL_CLASSES: Record<TerminalLineType, string> = {
  normal: 'text-green-400',
  success: 'text-blue-400',
  error: 'text-red-500',
  command: 'text-yellow-400',
  warning: 'text-orange-400',
  data: 'text-purple-400',
  system: 'text-cyan-400'
}
