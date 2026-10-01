import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from '../ThemeToggle'
import '../../styles/client-shell.css'

function LogoMark({ size = 30 }) {
  const gid = 'cshellGrad'
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="8" y1="4" x2="40" y2="44">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#7C4DFF" />
        </linearGradient>
      </defs>
      <path
        d="M12 8c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v20c0 .4.2.7.5 1l7 7c.8.8.2 2.2-1 2.2H14c-1.1 0-2-.9-2-2V8z"
        fill={`url(#${gid})`}
      />
      <path
        d="M26 28c4-1 9 .3 12 3.5 1 .9.2 2.5-1 2.3-4-.6-8-2.5-10.5-5.5-.5-.6-.3-1.2-.5-1.3z"
        fill={`url(#${gid})`}
        opacity="0.95"
      />
    </svg>
  )
}

const NAV = [
  {
    group: 'Aplikasi',
    items: [{ to: '/dashboard', label: 'Dashboard' }],
  },
  {
    group: 'Bantuan',
    items: [
      { to: '/chat', label: 'Chat Admin' },
      { to: '/complaints', label: 'Keluhan' },
    ],
  },
  {
    group: 'Akun',
    items: [
      { to: '/subscription', label: 'Langganan' },
      { to: '/pro-tools', label: 'Tools Pro', pro: true },
    ],
  },
]

export default function ClientShell({
  title,
  children,
  showPro = true,
  hideChrome = false,
}) {
  const loc = useLocation()
  const { profile, user } = useAuth() || {}

  function active(to) {
    return loc.pathname === to || loc.pathname.startsWith(to + '/')
  }

  if (hideChrome) {
    return <>{children}</>
  }

  return (
    <div className="cshell-page">
      <div className="cshell-layout">
        <aside className="cshell-sidebar">
          <Link to="/dashboard" className="cshell-brand">
            <LogoMark />
            <div>
              <strong>Lanila</strong>
              <span>Buku Kas</span>
            </div>
          </Link>

          {NAV.map((g) => (
            <div key={g.group}>
              <div className="cshell-nav-group">{g.group}</div>
              {g.items.map((item) => {
                if (item.pro && showPro === false) {
                  return (
                    <Link
                      key={item.to}
                      to="/subscription"
                      className="cshell-link"
                      title="Khusus Pro"
                    >
                      {item.label} 🔒
                    </Link>
                  )
                }
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={
                      'cshell-link' + (active(item.to) ? ' is-active' : '')
                    }
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </aside>

        <div className="cshell-main">
          <header className="cshell-topbar">
            <div>
              <Link to="/dashboard" className="cshell-back">
                ← Dashboard
              </Link>
              <h1>{title}</h1>
            </div>
            <div className="cshell-topbar-right">
              <ThemeToggle label />
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--ink-dim)',
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {profile?.full_name || user?.email || ''}
              </span>
            </div>
          </header>
          <div className="cshell-content">{children}</div>
        </div>
      </div>

      <nav className="cshell-mobile-nav" aria-label="Navigasi akun">
        <Link to="/dashboard" className={active('/dashboard') ? 'is-active' : ''}>
          Home
        </Link>
        <Link to="/chat" className={active('/chat') ? 'is-active' : ''}>
          Chat
        </Link>
        <Link to="/complaints" className={active('/complaints') ? 'is-active' : ''}>
          Keluhan
        </Link>
        <Link
          to="/subscription"
          className={active('/subscription') ? 'is-active' : ''}
        >
          Paket
        </Link>
        <Link
          to={showPro ? '/pro-tools' : '/subscription'}
          className={active('/pro-tools') ? 'is-active' : ''}
        >
          Tools
        </Link>
      </nav>
    </div>
  )
}
