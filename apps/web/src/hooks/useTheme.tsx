/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getInitialTheme, type ThemeMode } from '../lib/theme.ts'

type ThemeContextValue = {
  mode: ThemeMode
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = mode
    window.localStorage.setItem('liminalis_theme', mode)
  }, [mode])

  const value = useMemo(
    () => ({
      mode,
      toggle: () => setMode((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [mode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return context
}
