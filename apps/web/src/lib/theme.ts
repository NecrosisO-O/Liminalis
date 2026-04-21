export type ThemeMode = 'light' | 'dark'

export function getInitialTheme(): ThemeMode {
  const stored = window.localStorage.getItem('liminalis_theme')
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
