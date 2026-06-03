export const SEVERITY = {
  INFO: 'info',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const

export type SeverityValue = (typeof SEVERITY)[keyof typeof SEVERITY]

export const SEVERITY_META: Record<SeverityValue, { label: string; color: string; icon: string; weight: number }> = {
  [SEVERITY.INFO]: { label: 'Info', color: 'slate', icon: 'ℹ', weight: 0 },
  [SEVERITY.LOW]: { label: 'Low', color: 'blue', icon: '◌', weight: 1 },
  [SEVERITY.MEDIUM]: { label: 'Medium', color: 'yellow', icon: '◍', weight: 2 },
  [SEVERITY.HIGH]: { label: 'High', color: 'orange', icon: '●', weight: 3 },
  [SEVERITY.CRITICAL]: { label: 'Critical', color: 'red', icon: '◉', weight: 4 }
}

interface CommandMetaEntry {
  severity: SeverityValue
  category: string
  target?: string
  resultHint?: string
  needsTarget?: boolean
  destructive?: boolean
  needsConfirm?: boolean
}

export const COMMAND_META: Record<string, CommandMetaEntry> = {
  'scanall':            { severity: SEVERITY.INFO,     category: 'scan',     target: 'wifi',     resultHint: 'APs added to list' },
  'sniffbeacon':        { severity: SEVERITY.INFO,     category: 'sniff',    target: 'wifi',     resultHint: 'Beacons captured' },
  'sniffprobe':         { severity: SEVERITY.INFO,     category: 'sniff',    target: 'wifi',     resultHint: 'Probes captured' },
  'sniffdeauth':        { severity: SEVERITY.INFO,     category: 'sniff',    target: 'wifi',     resultHint: 'Deauths captured' },
  'sniffpmkid':         { severity: SEVERITY.MEDIUM,   category: 'sniff',    target: 'wifi',     resultHint: 'PMKID captured' },
  'sniffraw':           { severity: SEVERITY.INFO,     category: 'sniff',    target: 'wifi',     resultHint: 'Raw frames' },
  'sniffsae':           { severity: SEVERITY.MEDIUM,   category: 'sniff',    target: 'wifi',     resultHint: 'SAE commits' },
  'sniffpwn':           { severity: SEVERITY.INFO,     category: 'sniff',    target: 'wifi',     resultHint: 'Pwnagotchi detected' },
  'sniffpinescan':      { severity: SEVERITY.INFO,     category: 'sniff',    target: 'wifi',     resultHint: 'Pineapple scan' },
  'sniffmultissid':     { severity: SEVERITY.INFO,     category: 'sniff',    target: 'wifi',     resultHint: 'Multi-SSID APs' },
  'stopscan':           { severity: SEVERITY.INFO,     category: 'control',  target: 'device',   resultHint: 'Scan stopped' },
  'attack -t deauth':   { severity: SEVERITY.CRITICAL, category: 'attack',   target: 'wifi',     resultHint: 'Deauth flood', needsTarget: true, destructive: true },
  'attack -t deauth -c':{ severity: SEVERITY.CRITICAL, category: 'attack',   target: 'wifi',     resultHint: 'Deauth targeted', needsTarget: true, destructive: true },
  'attack -t beacon -r':{ severity: SEVERITY.HIGH,     category: 'attack',   target: 'wifi',     resultHint: 'Random beacon spam', destructive: true },
  'attack -t beacon -l':{ severity: SEVERITY.HIGH,     category: 'attack',   target: 'wifi',     resultHint: 'SSID list spam', destructive: true },
  'attack -t beacon -a':{ severity: SEVERITY.HIGH,     category: 'attack',   target: 'wifi',     resultHint: 'AP clone broadcast', needsTarget: true, destructive: true },
  'attack -t funny':    { severity: SEVERITY.HIGH,     category: 'attack',   target: 'wifi',     resultHint: 'Funny beacon spam', destructive: true },
  'attack -t probe':    { severity: SEVERITY.MEDIUM,   category: 'attack',   target: 'wifi',     resultHint: 'Probe spam', needsTarget: true, destructive: true },
  'attack -t rickroll': { severity: SEVERITY.HIGH,     category: 'attack',   target: 'wifi',     resultHint: 'Rick Roll beacon', destructive: true },
  'attack -t badmsg':   { severity: SEVERITY.CRITICAL, category: 'attack',   target: 'wifi',     resultHint: 'Bad EAPOL attack', needsTarget: true, destructive: true },
  'attack -t sleep':    { severity: SEVERITY.HIGH,     category: 'attack',   target: 'wifi',     resultHint: 'Sleep attack', needsTarget: true, destructive: true },
  'attack -t quiet':    { severity: SEVERITY.HIGH,     category: 'attack',   target: 'wifi',     resultHint: 'Quiet attack', needsTarget: true, destructive: true },
  'attack -t sae':      { severity: SEVERITY.HIGH,     category: 'attack',   target: 'wifi',     resultHint: 'SAE commit flood', needsTarget: true, destructive: true },
  'attack -t csa':      { severity: SEVERITY.HIGH,     category: 'attack',   target: 'wifi',     resultHint: 'CSA broadcast', needsTarget: true, destructive: true },
  'sniffbt':            { severity: SEVERITY.INFO,     category: 'scan',     target: 'ble',      resultHint: 'BLE devices discovered' },
  'sniffbt -t airtag':  { severity: SEVERITY.INFO,     category: 'sniff',    target: 'ble',      resultHint: 'AirTags detected' },
  'sniffbt -t flipper': { severity: SEVERITY.INFO,     category: 'sniff',    target: 'ble',      resultHint: 'Flippers detected' },
  'sniffbt -t flock':   { severity: SEVERITY.INFO,     category: 'sniff',    target: 'ble',      resultHint: 'Flock cameras' },
  'sniffbt -t meta':    { severity: SEVERITY.INFO,     category: 'sniff',    target: 'ble',      resultHint: 'Meta devices' },
  'sniffskim':          { severity: SEVERITY.INFO,     category: 'sniff',    target: 'ble',      resultHint: 'Slimmer scan' },
  'blespam -t all':     { severity: SEVERITY.HIGH,     category: 'attack',   target: 'ble',      resultHint: 'BLE spam all', needsTarget: true, destructive: true },
  'blespam -t sourapple':{ severity: SEVERITY.HIGH,    category: 'attack',   target: 'ble',      resultHint: 'Sour Apple', needsTarget: true, destructive: true },
  'blespam -t applejuice':{ severity: SEVERITY.HIGH,   category: 'attack',   target: 'ble',      resultHint: 'Apple Juice', needsTarget: true, destructive: true },
  'blespam -t google':  { severity: SEVERITY.HIGH,     category: 'attack',   target: 'ble',      resultHint: 'Google Fast Pair', needsTarget: true, destructive: true },
  'blespam -t samsung': { severity: SEVERITY.HIGH,     category: 'attack',   target: 'ble',      resultHint: 'Samsung spam', needsTarget: true, destructive: true },
  'blespam -t windows': { severity: SEVERITY.HIGH,     category: 'attack',   target: 'ble',      resultHint: 'Windows Swift Pair', needsTarget: true, destructive: true },
  'blespam -t speaker': { severity: SEVERITY.HIGH,     category: 'attack',   target: 'ble',      resultHint: 'Speaker BLE spam', needsTarget: true, destructive: true },
  'blespam -t jbl':     { severity: SEVERITY.HIGH,     category: 'attack',   target: 'ble',      resultHint: 'JBL speaker spam', needsTarget: true, destructive: true },
  'blespam -t bose':    { severity: SEVERITY.HIGH,     category: 'attack',   target: 'ble',      resultHint: 'Bose speaker spam', needsTarget: true, destructive: true },
  'blespam -t sony':    { severity: SEVERITY.HIGH,     category: 'attack',   target: 'ble',      resultHint: 'Sony speaker spam', needsTarget: true, destructive: true },
  'blespam -t marshall':{ severity: SEVERITY.HIGH,     category: 'attack',   target: 'ble',      resultHint: 'Marshall speaker spam', needsTarget: true, destructive: true },
  'sniffbt -t speaker': { severity: SEVERITY.INFO,     category: 'sniff',    target: 'ble',      resultHint: 'Speaker devices' },
  'sniffbt -t jbl':     { severity: SEVERITY.INFO,     category: 'sniff',    target: 'ble',      resultHint: 'JBL speakers' },
  'sniffbt -t bose':    { severity: SEVERITY.INFO,     category: 'sniff',    target: 'ble',      resultHint: 'Bose speakers' },
  'sniffbt -t sony':    { severity: SEVERITY.INFO,     category: 'sniff',    target: 'ble',      resultHint: 'Sony speakers' },
  'sniffbt -t marshall':{ severity: SEVERITY.INFO,     category: 'sniff',    target: 'ble',      resultHint: 'Marshall speakers' },
  'spoofat -t 0':       { severity: SEVERITY.MEDIUM,   category: 'attack',   target: 'ble',      resultHint: 'AirTag spoof', needsTarget: true, destructive: true },
  'select -a 0':        { severity: SEVERITY.INFO,     category: 'select',   target: 'wifi',     resultHint: 'AP selected' },
  'select -a all':      { severity: SEVERITY.INFO,     category: 'select',   target: 'wifi',     resultHint: 'All APs toggled' },
  'select -c all':      { severity: SEVERITY.INFO,     category: 'select',   target: 'wifi',     resultHint: 'All stations toggled' },
  'clearlist -a':       { severity: SEVERITY.LOW,      category: 'control',  target: 'wifi',     resultHint: 'APs cleared', destructive: true },
  'clearlist -c':       { severity: SEVERITY.LOW,      category: 'control',  target: 'wifi',     resultHint: 'Stations cleared', destructive: true },
  'clearlist -s':       { severity: SEVERITY.LOW,      category: 'control',  target: 'wifi',     resultHint: 'SSIDs cleared', destructive: true },
  'list -a':            { severity: SEVERITY.INFO,     category: 'list',     target: 'wifi',     resultHint: 'AP list' },
  'list -c':            { severity: SEVERITY.INFO,     category: 'list',     target: 'wifi',     resultHint: 'Stations list' },
  'list -s':            { severity: SEVERITY.INFO,     category: 'list',     target: 'wifi',     resultHint: 'SSID list' },
  'list -t':            { severity: SEVERITY.INFO,     category: 'list',     target: 'ble',      resultHint: 'AirTags list' },
  'list -p':            { severity: SEVERITY.INFO,     category: 'list',     target: 'wifi',     resultHint: 'Probes list' },
  'list -i':            { severity: SEVERITY.INFO,     category: 'list',     target: 'network',  resultHint: 'IP list' },
  'info':               { severity: SEVERITY.INFO,     category: 'list',     target: 'device',   resultHint: 'System info' },
  'info -a 0':          { severity: SEVERITY.INFO,     category: 'list',     target: 'wifi',     resultHint: 'AP info' },
  'settings':           { severity: SEVERITY.INFO,     category: 'list',     target: 'device',   resultHint: 'Settings' },
  'channel -s 1':       { severity: SEVERITY.INFO,     category: 'config',   target: 'wifi',     resultHint: 'Channel set' },
  'channel -s 6':       { severity: SEVERITY.INFO,     category: 'config',   target: 'wifi',     resultHint: 'Channel set' },
  'channel -s 11':      { severity: SEVERITY.INFO,     category: 'config',   target: 'wifi',     resultHint: 'Channel set' },
  'reboot':             { severity: SEVERITY.MEDIUM,   category: 'control',  target: 'device',   resultHint: 'Rebooting', destructive: true, needsConfirm: true },
  'led -s #FF0000':     { severity: SEVERITY.INFO,     category: 'config',   target: 'device',   resultHint: 'LED color set' },
  'led -p rainbow':     { severity: SEVERITY.INFO,     category: 'config',   target: 'device',   resultHint: 'LED rainbow' },
  'brightness -s 5':    { severity: SEVERITY.INFO,     category: 'config',   target: 'device',   resultHint: 'Brightness set' },
  'packetcount':        { severity: SEVERITY.INFO,     category: 'analysis', target: 'wifi',     resultHint: 'Packet stats' },
  'sigmon':             { severity: SEVERITY.INFO,     category: 'analysis', target: 'wifi',     resultHint: 'Signal monitor' },
  'channelanalyzer':    { severity: SEVERITY.INFO,     category: 'analysis', target: 'wifi',     resultHint: 'Channel stats' },
  'mactrack':           { severity: SEVERITY.INFO,     category: 'analysis', target: 'wifi',     resultHint: 'MAC track' },
  'gpsdata':            { severity: SEVERITY.INFO,     category: 'sniff',    target: 'gps',      resultHint: 'GPS stream' },
  'nmea':               { severity: SEVERITY.INFO,     category: 'sniff',    target: 'gps',      resultHint: 'NMEA stream' },
  'wardrive':           { severity: SEVERITY.MEDIUM,   category: 'attack',   target: 'wifi',     resultHint: 'Wardrive running', destructive: true },
  'wardrivepoi':        { severity: SEVERITY.LOW,      category: 'config',   target: 'gps',      resultHint: 'POI tagged' },
  'evilportal -c start':{ severity: SEVERITY.CRITICAL, category: 'attack',   target: 'wifi',     resultHint: 'Evil portal running', destructive: true, needsConfirm: true },
  'karma -p 0':         { severity: SEVERITY.CRITICAL, category: 'attack',   target: 'wifi',     resultHint: 'Karma running', destructive: true, needsConfirm: true },
  'ls /':               { severity: SEVERITY.INFO,     category: 'list',     target: 'device',   resultHint: 'SD listing' },
  'update -s':          { severity: SEVERITY.HIGH,     category: 'control',  target: 'device',   resultHint: 'Updating from SD', destructive: true, needsConfirm: true },
  'ssid -a -g 10':      { severity: SEVERITY.LOW,      category: 'config',   target: 'wifi',     resultHint: '10 SSIDs generated' },
  'ssid -a -g 50':      { severity: SEVERITY.LOW,      category: 'config',   target: 'wifi',     resultHint: '50 SSIDs generated' },
  'ssid -a -n':         { severity: SEVERITY.LOW,      category: 'config',   target: 'wifi',     resultHint: 'SSID added' },
  'ssid -r 0':          { severity: SEVERITY.LOW,      category: 'config',   target: 'wifi',     resultHint: 'SSID removed' },
  'save -s':            { severity: SEVERITY.INFO,     category: 'config',   target: 'device',   resultHint: 'SSIDs saved to SD' },
  'load -s':            { severity: SEVERITY.INFO,     category: 'config',   target: 'device',   resultHint: 'SSIDs loaded from SD' },
  'save -a':            { severity: SEVERITY.INFO,     category: 'config',   target: 'device',   resultHint: 'APs saved to SD' },
  'load -a':            { severity: SEVERITY.INFO,     category: 'config',   target: 'device',   resultHint: 'APs loaded from SD' },
  'randapmac':          { severity: SEVERITY.MEDIUM,   category: 'config',   target: 'wifi',     resultHint: 'AP MAC randomized' },
  'randstamac':         { severity: SEVERITY.MEDIUM,   category: 'config',   target: 'wifi',     resultHint: 'STA MAC randomized' },
  'cloneapmac -a 0':    { severity: SEVERITY.MEDIUM,   category: 'config',   target: 'wifi',     resultHint: 'AP MAC cloned' },
  'clonestamac -s 0':   { severity: SEVERITY.MEDIUM,   category: 'config',   target: 'wifi',     resultHint: 'STA MAC cloned' },
  'join -a 0 -p':       { severity: SEVERITY.MEDIUM,   category: 'network',  target: 'wifi',     resultHint: 'Joining AP' },
  'join -s':            { severity: SEVERITY.MEDIUM,   category: 'network',  target: 'wifi',     resultHint: 'Joining saved AP' },
  'pingscan':           { severity: SEVERITY.INFO,     category: 'scan',     target: 'network',  resultHint: 'Pinging hosts' },
  'arpscan':            { severity: SEVERITY.INFO,     category: 'scan',     target: 'network',  resultHint: 'ARP scan' },
  'portscan -a -t 0':   { severity: SEVERITY.INFO,     category: 'scan',     target: 'network',  resultHint: 'Port scan' },
  'portscan -s ssh':    { severity: SEVERITY.INFO,     category: 'scan',     target: 'network',  resultHint: 'SSH port scan' },
  'portscan -s http':   { severity: SEVERITY.INFO,     category: 'scan',     target: 'network',  resultHint: 'HTTP port scan' },
  'portscan -s https':  { severity: SEVERITY.INFO,     category: 'scan',     target: 'network',  resultHint: 'HTTPS port scan' }
}

export function getCommandMeta(cmd: string): CommandMetaEntry | null {
  if (!cmd) return null
  const trimmed = cmd.trim()
  if (COMMAND_META[trimmed]) return COMMAND_META[trimmed]
  for (const [key, meta] of Object.entries(COMMAND_META)) {
    if (trimmed.startsWith(key + ' ') || trimmed.startsWith(key + '\t')) {
      return meta
    }
  }
  if (trimmed.startsWith('select -a')) return { severity: SEVERITY.INFO, category: 'select', target: 'wifi', resultHint: 'AP selected' }
  if (trimmed.startsWith('attack'))   return { severity: SEVERITY.CRITICAL, category: 'attack', target: 'wifi', destructive: true }
  if (trimmed.startsWith('sniffbt'))  return { severity: SEVERITY.INFO, category: 'sniff', target: 'ble' }
  if (trimmed.startsWith('blespam'))  return { severity: SEVERITY.HIGH, category: 'attack', target: 'ble', destructive: true }
  if (trimmed.startsWith('ssid'))     return { severity: SEVERITY.LOW, category: 'config', target: 'wifi' }
  if (trimmed.startsWith('portscan')) return { severity: SEVERITY.INFO, category: 'scan', target: 'network' }
  if (trimmed.startsWith('join'))     return { severity: SEVERITY.MEDIUM, category: 'network', target: 'wifi' }
  if (trimmed.startsWith('info'))     return { severity: SEVERITY.INFO, category: 'list' }
  if (trimmed.startsWith('list'))     return { severity: SEVERITY.INFO, category: 'list' }
  if (trimmed.startsWith('channel'))  return { severity: SEVERITY.INFO, category: 'config', target: 'wifi' }
  if (trimmed.startsWith('led'))      return { severity: SEVERITY.INFO, category: 'config', target: 'device' }
  if (trimmed.startsWith('clone') || trimmed.startsWith('rand')) return { severity: SEVERITY.MEDIUM, category: 'config' }
  return { severity: SEVERITY.LOW, category: 'custom' }
}
