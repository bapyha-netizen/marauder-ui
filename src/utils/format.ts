// escHtml was removed: Vue's {{ }} interpolation auto-escapes, so the explicit
// escape helper was only used by demoData.ts (which now uses text + cls
// instead of HTML). If you ever need to inject untrusted HTML, prefer
// v-html with a sanitized payload or use a dedicated sanitizer.

export const signalClass = (rssi: number | null | undefined): string => {
  if (rssi === null || rssi === undefined) return 'text-slate-500'
  if (rssi > -70) return 'text-emerald-400'
  if (rssi > -85) return 'text-amber-400'
  return 'text-red-400'
}

export const dotClass = (rssi: number | null | undefined): string => {
  if (rssi === null || rssi === undefined) return 'bg-slate-500'
  if (rssi > -70) return 'bg-emerald-500'
  if (rssi > -85) return 'bg-amber-500'
  return 'bg-red-500'
}

export const fmtTimeRelative = (t: string | Date | number | null | undefined): string => {
  if (!t) return ''
  const diff = Math.floor((Date.now() - new Date(t).getTime()) / 1000)
  if (diff <= 0) return 'now'
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export const fmtTimeHM = (t: string | Date | number | null | undefined): string => {
  if (!t) return ''
  const d = new Date(t)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export const fmtTimeHMS = (t: string | Date | number | null | undefined): string => {
  if (!t) return ''
  const d = new Date(t)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}
