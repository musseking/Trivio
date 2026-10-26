export const SESSION_STORAGE_KEY = 'trivio.session'

/** Persist only the bearer credential and its original deadline, never identity or permissions. */
export interface StoredSession {
  accessToken: string
  expiresAt: number
}

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function browserStorage(): SessionStorage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.sessionStorage }
  catch { return undefined }
}

export function clearStoredSession(storage = browserStorage()) {
  try { storage?.removeItem(SESSION_STORAGE_KEY) } catch { /* Memory-only login still works when storage is blocked. */ }
}

export function readStoredSession(storage = browserStorage(), now = Date.now()): StoredSession | null {
  try {
    const raw = storage?.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const saved: unknown = JSON.parse(raw)
    if (typeof saved !== 'object' || saved === null) throw new Error('Invalid session')
    const value = saved as Partial<StoredSession>
    if (typeof value.accessToken !== 'string' || !value.accessToken || value.accessToken.length > 16384
      || /\s/.test(value.accessToken) || typeof value.expiresAt !== 'number'
      || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now) throw new Error('Invalid session')
    return { accessToken: value.accessToken, expiresAt: value.expiresAt }
  } catch {
    clearStoredSession(storage)
    return null
  }
}

export function saveStoredSession(session: StoredSession, storage = browserStorage()) {
  try {
    storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify({ accessToken: session.accessToken, expiresAt: session.expiresAt }))
  } catch { /* Do not prevent sign-in when the browser denies storage. */ }
}
