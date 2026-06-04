import { ref, computed } from 'vue'
import ru from '../i18n/ru'
import en from '../i18n/en'

export type Locale = 'ru' | 'en'

const messages: Record<Locale, Record<string, unknown>> = { ru, en }

function loadLocale(): Locale {
  try {
    const saved = localStorage.getItem('marauder-ui-locale')
    if (saved === 'en' || saved === 'ru') return saved
  } catch {}
  return 'ru'
}

function saveLocale(l: Locale) {
  try { localStorage.setItem('marauder-ui-locale', l) } catch {}
}

export const locale = ref<Locale>(loadLocale())

export function setLocale(l: Locale) {
  locale.value = l
  saveLocale(l)
}

export function toggleLocale() {
  setLocale(locale.value === 'ru' ? 'en' : 'ru')
}

export function useLocale() {
  return { locale, setLocale, toggleLocale }
}

function resolve(obj: unknown, key: string): unknown {
  const parts = key.split('.')
  let cur = obj
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in cur) {
      cur = (cur as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return cur
}

export function t(key: string, params?: Record<string, string | number>): string {
  const msg = resolve(messages[locale.value], key) ?? resolve(messages.en, key) ?? key
  let result: string
  if (Array.isArray(msg)) {
    result = msg.join('\n')
  } else {
    result = String(msg)
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.replaceAll(`{${k}}`, String(v))
    }
  }
  return result
}

export function tA(key: string, params?: Record<string, string | number>): string[] {
  const msg = resolve(messages[locale.value], key) ?? resolve(messages.en, key) ?? key
  if (Array.isArray(msg)) {
    return params
      ? msg.map(line => {
          let r = line
          for (const [k, v] of Object.entries(params)) {
            r = r.replaceAll(`{${k}}`, String(v))
          }
          return r
        })
      : [...msg]
  }
  const r = params
    ? String(msg).replaceAll(/{(\w+)}/g, (_, k) => String(params[k] ?? `{${k}}`))
    : String(msg)
  return [r]
}
