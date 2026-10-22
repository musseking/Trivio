import { createContext, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export interface ThemeContextValue {
  preference: ThemePreference
  dark: boolean
  setPreference: (preference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)
const KEY = 'trivio-theme'

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* Continue with the operating-system preference. */ }
  return 'system'
}

function matchesDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference)
  const [systemDark, setSystemDark] = useState(matchesDark)
  const dark = preference === 'dark' || (preference === 'system' && systemDark)

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value)
    try {
      if (value === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, value)
    } catch { /* Theme works in memory when storage is unavailable. */ }
  }, [])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111d19' : '#f8f7f4')
  }, [dark])

  return <ThemeContext.Provider value={{ preference, dark, setPreference }}>{children}</ThemeContext.Provider>
}
