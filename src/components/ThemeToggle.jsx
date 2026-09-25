import { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'

const STORAGE_KEY = 'lanila-color-mode'

function applyMode(mode) {
  document.documentElement.setAttribute('data-color-mode', mode)
  document.documentElement.style.colorScheme = mode
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch (_) {}
}

/**
 * Ikon MODE SAAT INI:
 * - Mode siang (light) → matahari
 * - Mode malam (dark)  → bulan
 * Sama di client, register, login, admin, super admin.
 */
export default function ThemeToggle({ className = '', label = false }) {
  const theme = useTheme()
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    if (theme?.mode) setMode(theme.mode)
  }, [theme?.mode])

  useEffect(() => {
    applyMode(mode)
  }, [mode])

  function handleClick() {
    const next = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    applyMode(next)
    theme?.setMode?.(next)
  }

  const isDark = mode === 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={handleClick}
      title={isDark ? 'Mode malam · klik untuk siang' : 'Mode siang · klik untuk malam'}
      aria-label={isDark ? 'Ganti ke mode siang' : 'Ganti ke mode malam'}
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
      {label && (
        <span style={{ fontSize: 12, fontWeight: 600 }}>
          {isDark ? 'Malam' : 'Siang'}
        </span>
      )}
    </button>
  )
}
