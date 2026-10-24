import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getMe, loginAccount, registerAccount, updateMyProfile } from '../api/auth'
import { ApiError, subscribeToUnauthorized } from '../api/client'
import type { LoginRequest, RegisterRequest, UpdateProfileRequest, User } from '../api/types'
import { uploadProfilePhoto, removeProfilePhoto } from '../api/profile-photo'

export interface AuthContextValue {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => void
  updateProfile: (data: UpdateProfileRequest, signal?: AbortSignal) => Promise<void>
  updatePhoto: (file: File | null, signal?: AbortSignal) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface Session {
  accessToken: string
  user: User
  expiresAt: number
}

/** No persistent session: tokens live only in React memory and disappear on reload. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const sessionRef = useRef<Session | null>(null)
  const operationRef = useRef(0)
  const requestRef = useRef<AbortController | null>(null)
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearExpiry = useCallback(() => {
    if (expiryRef.current !== null) clearTimeout(expiryRef.current)
    expiryRef.current = null
  }, [])

  const updateSession = useCallback((next: Session | null) => {
    clearExpiry()
    sessionRef.current = next
    setSession(next)
    if (next) {
      expiryRef.current = setTimeout(() => {
        if (sessionRef.current?.accessToken === next.accessToken) {
          sessionRef.current = null
          setSession(null)
          expiryRef.current = null
        }
      }, Math.max(0, next.expiresAt - Date.now()))
    }
  }, [clearExpiry])

  const logout = useCallback(() => {
    ++operationRef.current
    requestRef.current?.abort()
    requestRef.current = null
    updateSession(null)
    setIsLoading(false)
  }, [updateSession])

  useEffect(() => {
    const unsubscribe = subscribeToUnauthorized((rejectedToken) => {
      // A delayed request from an old session must never log out a newer one.
      if (sessionRef.current?.accessToken === rejectedToken) updateSession(null)
    })
    return () => {
      unsubscribe()
      ++operationRef.current
      requestRef.current?.abort()
      clearExpiry()
    }
  }, [clearExpiry, updateSession])

  const beginOperation = useCallback(() => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    const operation = ++operationRef.current
    setIsLoading(true)
    return { controller, operation }
  }, [])

  const finishOperation = useCallback((operation: number) => {
    if (operationRef.current === operation) {
      requestRef.current = null
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (data: LoginRequest) => {
    const { controller, operation } = beginOperation()
    try {
      const token = await loginAccount(data, controller.signal)
      const expiresAt = Date.now() + token.expiresIn * 1000
      // Identity and role come from the protected server endpoint, never JWT decoding.
      const user = await getMe(token.accessToken, controller.signal)
      if (operationRef.current !== operation || controller.signal.aborted) {
        throw new DOMException('Zahtev je otkazan.', 'AbortError')
      }
      if (expiresAt <= Date.now()) throw new ApiError(401, 'Sesija je istekla. Prijavi se ponovo.')
      updateSession({ accessToken: token.accessToken, user, expiresAt })
    } finally {
      finishOperation(operation)
    }
  }, [beginOperation, finishOperation, updateSession])

  const register = useCallback(async (data: RegisterRequest) => {
    const { controller, operation } = beginOperation()
    try {
      await registerAccount(data, controller.signal)
      if (operationRef.current !== operation || controller.signal.aborted) {
        throw new DOMException('Zahtev je otkazan.', 'AbortError')
      }
      // Registration returns an account, not a token. The user signs in afterwards.
    } finally {
      finishOperation(operation)
    }
  }, [beginOperation, finishOperation])

  const updateProfile = useCallback(async (data: UpdateProfileRequest, signal?: AbortSignal) => {
    const current = sessionRef.current
    if (!current) throw new ApiError(401, 'Prijavi se ponovo da izmeniš profil.')
    const user = await updateMyProfile(current.accessToken, data, signal)
    if (signal?.aborted || sessionRef.current?.accessToken !== current.accessToken) {
      throw new DOMException('Zahtev je otkazan.', 'AbortError')
    }
    updateSession({ ...current, user })
  }, [updateSession])

  const updatePhoto = useCallback(async (file: File | null, signal?: AbortSignal) => {
    const current = sessionRef.current
    if (!current) throw new ApiError(401, 'Prijavi se ponovo da izmeniš sliku.')
    const user = file ? await uploadProfilePhoto(current.accessToken, file, signal)
      : await removeProfilePhoto(current.accessToken, signal)
    if (signal?.aborted || sessionRef.current?.accessToken !== current.accessToken) {
      throw new DOMException('Zahtev je otkazan.', 'AbortError')
    }
    updateSession({ ...sessionRef.current, user })
  }, [updateSession])

  return (
    <AuthContext.Provider value={{
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      isAuthenticated: session !== null,
      isLoading,
      login,
      register,
      logout,
      updateProfile,
      updatePhoto,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
