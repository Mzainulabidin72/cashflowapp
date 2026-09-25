import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from '../ThemeToggle'
import '../../styles/super-admin.css'

function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <linearGradient id="saLanilaG" x1="8" y1="4" x2="40" y2="44">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#7C4DFF" />
        </linearGradient>
      </defs>
      <path
        d="M12 8c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v20c0 .4.2.7.5 1l7 7c.8.8.2 2.2-1 2.2H14c-1.1 0-2-.9-2-2V8z"
        fill="url(#saLanilaG)"
      />
      <path
        d="M26 28c4-1 9 .3 12 3.5 1 .9.2 2.5-1 2.3-4-.6-8-2.5-10.5-5.5-.5-.6-.3-1.2-.5-1.3z"
        fill="url(#saLanilaG)"
        opacity="0.95"
      />
    </svg>
  )
}

const NAV = [
  {
    group: 'Overview',
    items: [{ to: '/super-admin', label: 'Dashboard', end: true }],
  },
  {
    group: 'System',
    items: [
      { to: '/super-admin/maintenance', label: 'Maintenance' },
      { to: '/super-admin/payment-settings', label: 'Payment Settings' },
      { to: '/super-admin/logs', label: 'Audit Logs' },
      { to: '/super-admin/reports', label: 'Reports' },
    ],
  },
]

export default function SuperAdminShell({ title, children }) {
  const loc = useLocation()
  const { profile, user, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  function isActive(to, end) {
    if (end) return loc.pathname === to || loc.pathname === '/super-admin/'
    return loc.pathname === to || loc.pathname.startsWith(to + '/')
  }

  async function logout() {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <div className="sa-root">
      <div className={'sa-overlay' + (open ? ' is-open' : '')} onClick={() => setOpen(false)} />
      <aside className={'sa-sidebar' + (open ? ' is-open' : '')}>
        <Link to="/super-admin" className="sa-brand" onClick={() => setOpen(false)}>
          <LogoMark />
          <div>
            <strong>Lanila</strong>
            <span>Super Admin</span>
          </div>
        </Link>
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="sa-nav-group">{g.group}</div>
            {g.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={'sa-link' + (isActive(item.to, item.end) ? ' is-active' : '')}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
        <div className="sa-sidebar-foot">
          <div style={{ padding: '0 10px 8px' }}>
            <div style={{ color: 'var(--sa-text)', fontWeight: 600, fontSize: 13 }}>
              {profile?.full_name || 'Super Admin'}
            </div>
            <div style={{ wordBreak: 'break-all' }}>{profile?.email || user?.email}</div>
            <div style={{ marginTop: 2 }}>super_admin</div>
          </div>
          <button type="button" className="sa-link" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <div className="sa-main">
        <div className="sa-mobile-bar">
          <button type="button" className="sa-btn" onClick={() => setOpen(true)}>
            Menu
          </button>
          <strong style={{ flex: 1 }}>{title}</strong>
          <ThemeToggle />
        </div>
        <header className="sa-topbar">
          <h1>{title}</h1>
          <ThemeToggle label />
        </header>
        <div className="sa-content">{children}</div>
      </div>
    </div>
  )
}
