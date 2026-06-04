const MAX_CLIPBOARD_SIZE = 1_000_000

export async function copyToClipboard(text: string | null | undefined): Promise<boolean> {
  if (!text) return false
  if (text.length > MAX_CLIPBOARD_SIZE) return false
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (e) {
      // fall through to fallback
    }
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.readOnly = true
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    ta.style.pointerEvents = 'none'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch (e) {
    return false
  }
}

export async function readFromClipboard(): Promise<string | null> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      return await navigator.clipboard.readText()
    } catch (e) {
      return null
    }
  }
  return null
}
