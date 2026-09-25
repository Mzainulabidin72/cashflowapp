import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from '../ThemeToggle'
import '../../styles/admin.css'

const NAV = [
  { group: 'Overview', items: [{ to: '/admin', label: 'Dashboard', end: true }] },
  {
    group: 'Management',
    items: [
      { to: '/admin/chat', label: 'Chat / Support' },
      { to: '/admin/complaints', label: 'Keluhan' },
      { to: '/admin/subscriptions', label: 'Langganan' },
      { to: '/admin/payments', label: 'Pembayaran' },
    ],
  },
]

function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <linearGradient id="adLanila" x1="8" y1="4" x2="40" y2="44">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#7C4DFF" />
        </linearGradient>
      </defs>
      <path
        d="M12 8c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v20c0 .4.2.7.5 1l7 7c.8.8.2 2.2-1 2.2H14c-1.1 0-2-.9-2-2V8z"
        fill="url(#adLanila)"
      />
      <path
        d="M26 28c4-1 9 .3 12 3.5 1 .9.2 2.5-1 2.3-4-.6-8-2.5-10.5-5.5-.5-.6-.3-1.2-.5-1.3z"
        fill="url(#adLanila)"
        opacity="0.95"
      />
    </svg>
  )
}

export default function AdminShell({ title, badges = {}, children }) {
  const { profile, signOut } = useAuth()
  const loc = useLocation()

  async function logout() {
    await signOut()
    window.location.href = '/login'
  }

  function active(to, end) {
    if (end) return loc.pathname === to
    return loc.pathname === to || loc.pathname.startsWith(to + '/')
  }

  return (
    <div className="ad-page">
      <div className="ad-shell">
        <aside className="ad-sidebar">
          <div className="ad-brand">
            <LogoMark size={34} />
            <div className="ad-brand-text">
              <strong>Lanila</strong>
              <span>Admin Panel</span>
            </div>
          </div>
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="ad-nav-group">{g.group}</div>
              {g.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    'ad-nav-link' + (active(item.to, item.end) ? ' is-active' : '')
                  }
                >
                  {item.label}
                  {item.to === '/admin/chat' && badges.conversations > 0 && (
                    <span className="badge">{badges.conversations}</span>
                  )}
                  {item.to === '/admin/complaints' && badges.openComplaints > 0 && (
                    <span className="badge">{badges.openComplaints}</span>
                  )}
                  {item.to === '/admin/payments' && badges.pendingPayments > 0 && (
                    <span className="badge">{badges.pendingPayments}</span>
                  )}
                  {item.to === '/admin/subscriptions' &&
                    badges.pendingSubscriptions > 0 && (
                      <span className="badge">{badges.pendingSubscriptions}</span>
                    )}
                </Link>
              ))}
            </div>
          ))}
          <div style={{ marginTop: 'auto', paddingTop: 16 }}>
            <button type="button" className="ad-nav-link" onClick={logout}>
              Logout
            </button>
          </div>
        </aside>

        <div className="ad-main">
          <header className="ad-topbar">
            <h1>{title}</h1>
            <div className="ad-topbar-right">
              <ThemeToggle label />
              <span className="ad-muted" style={{ fontSize: 12 }}>
                {profile?.full_name || profile?.email} · {profile?.role}
              </span>
              <button type="button" className="ad-btn ad-btn-ghost" onClick={logout}>
                Logout
              </button>
            </div>
          </header>
          <div className="ad-content">{children}</div>
          <div className="ad-footer">
            © {new Date().getFullYear()} Lanila · Better Tools · Brighter Days
          </div>
        </div>
      </div>

      <nav className="ad-mobile-nav" aria-label="Admin mobile">
        <Link to="/admin">Home</Link>
        <Link to="/admin/chat">Chat</Link>
        <Link to="/admin/complaints">Keluhan</Link>
        <Link to="/admin/payments">Bayar</Link>
        <Link to="/admin/subscriptions">Paket</Link>
      </nav>
    </div>
  )
}
