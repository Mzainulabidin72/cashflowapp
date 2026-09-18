import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'lanila-color-mode'

function getInitialMode() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch (_) {}
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

function applyMode(mode) {
  document.documentElement.setAttribute('data-color-mode', mode)
  document.documentElement.setAttribute('data-product', 'buku-kas')
  document.documentElement.style.colorScheme = mode
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch (_) {}
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(getInitialMode)
  useEffect(() => { applyMode(mode) }, [mode])
  const value = useMemo(() => ({
    mode,
    isDark: mode === 'dark',
    isLight: mode === 'light',
    setMode: (m) => { if (m === 'light' || m === 'dark') setModeState(m) },
    toggle: () => setModeState((m) => (m === 'dark' ? 'light' : 'dark')),
  }), [mode])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return {
      mode: 'dark',
      toggle: () => {
        const cur = document.documentElement.getAttribute('data-color-mode') || 'dark'
        applyMode(cur === 'dark' ? 'light' : 'dark')
      },
      setMode: applyMode,
    }
  }
  return ctx
}
