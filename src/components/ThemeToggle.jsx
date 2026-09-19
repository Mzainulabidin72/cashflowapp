import { useEffect, useState } from 'react'

const STORAGE_KEY = 'lanila-color-mode'

function applyMode(mode) {
  document.documentElement.setAttribute('data-color-mode', mode)
  document.documentElement.setAttribute('data-product', 'buku-kas')
  document.documentElement.style.colorScheme = mode
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch (_) {}
  // force style recalc for pages that cache
  document.body && document.body.offsetHeight
}

export default function ThemeToggle({ className = '', label = false }) {
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    applyMode(mode)
  }, [mode])

  function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()
    setMode((m) => (m === 'dark' ? 'light' : 'dark'))
  }

  const isDark = mode === 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={handleClick}
      title={isDark ? 'Mode malam' : 'Mode siang'}
      aria-label={isDark ? 'Aktifkan mode malam' : 'Aktifkan mode siang'}
    >
      {isDark ? (
  /* BULAN = sedang mode malam */
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
  </svg>
) : (
  /* MATAHARI = sedang mode siang */
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
)}
      {label && <span style={{ fontSize: 12, fontWeight: 600 }}>{isDark ? 'Siang' : 'Malam'}</span>}
    </button>
  )
}
