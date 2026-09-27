/** Құпия иелік кілті жоба файлына және тұрақты localStorage-ке кірмейді. */
export type ShareSession = { code: string; key: string; expiresAt: number }
const STORAGE_KEY = 'furniture-configurator:active-share'

export function parseShareSession(raw: string | null, now: number): ShareSession | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object') return null
  const session = value as Record<string, unknown>
  return typeof session.code === 'string' && /^\d{6}$/.test(session.code) &&
    typeof session.key === 'string' && session.key.length > 0 &&
    typeof session.expiresAt === 'number' && Number.isSafeInteger(session.expiresAt) && session.expiresAt > now
    ? { code: session.code, key: session.key, expiresAt: session.expiresAt } : null
}

export function readShareSession(): ShareSession | null {
  if (typeof window === 'undefined') return null
  try {
    return parseShareSession(window.sessionStorage.getItem(STORAGE_KEY), Date.now())
  } catch (cause) {
    console.warn('Клиент кодының сеансы оқылмады', cause)
    return null
  }
}

export function saveShareSession(session: ShareSession | null): void {
  if (typeof window === 'undefined') return
  try {
    if (session) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch (cause) {
    console.warn('Клиент кодының сеансы сақталмады', cause)
  }
}
