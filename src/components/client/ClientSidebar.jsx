import { Lock, LogOut } from 'lucide-react'
import LanilaLogo from '../brand/LanilaLogo'
import ThemeToggle from '../ThemeToggle'
import { CLIENT_NAV, canAccess } from '../../lib/clientNav'
import '../../styles/client-sidebar.css'

/**
 * Sidebar desktop klien. Murni presentasi: state dan navigasi dipegang App.jsx.
 *
 * Props:
 * - activeKey  : key menu aktif (state `tab` di App)
 * - onSelect(item)   : dipanggil saat menu yang boleh diakses diklik
 * - onLocked(item)   : dipanggil saat menu terkunci paket diklik (mis. tampilkan toast)
 * - planInfo   : hasil getUserPlanInfo (dipakai untuk flag item.access)
 * - user, profile, onLogout
 */
export default function ClientSidebar({ activeKey, onSelect, onLocked, planInfo, user, profile, onLogout }) {
  const name = profile?.full_name || profile?.email || user?.email || 'User'
  const role = profile?.role || 'user'

  return (
    <aside className="lsb" aria-label="Sidebar">
      <div className="lsb-brand">
        <LanilaLogo size={34} productName="Buku Kas" />
      </div>

      <nav className="lsb-nav" aria-label="Navigasi utama">
        {CLIENT_NAV.map((group) => (
          <div key={group.id} className="lsb-group" role="group" aria-labelledby={`lsb-g-${group.id}`}>
            <div id={`lsb-g-${group.id}`} className="lsb-group-label">
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon
              const allowed = canAccess(item, planInfo)
              const active = allowed && activeKey === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  className={'lsb-item' + (active ? ' is-active' : '') + (allowed ? '' : ' is-locked')}
                  aria-current={active ? 'page' : undefined}
                  aria-label={allowed ? undefined : `${item.label} (khusus paket Pro)`}
                  onClick={() => (allowed ? onSelect?.(item) : onLocked?.(item))}
                >
                  <Icon className="lsb-icon" size={18} strokeWidth={1.75} aria-hidden="true" />
                  <span className="lsb-label">{item.label}</span>
                  {!allowed && <Lock className="lsb-lock" size={13} strokeWidth={2} aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="lsb-footer">
        <div className="lanila-powered lsb-powered">
          Powered by <strong>Lanila</strong>
        </div>

        <div className="lsb-account">
          <div className="lsb-account-name" title={name}>
            {name}
          </div>
          <div className="lsb-account-role">{role}</div>
        </div>

        <div className="lsb-actions">
          <ThemeToggle />
          <button type="button" className="lsb-logout" onClick={onLogout}>
            <LogOut size={15} strokeWidth={1.75} aria-hidden="true" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  )
}
