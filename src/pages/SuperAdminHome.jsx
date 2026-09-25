import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SuperAdminShell from '../components/super/SuperAdminShell'
import { getMaintenance, listAllProfiles } from '../lib/adminService'
import { getSuperAdminReport } from '../lib/reportService'

function greeting() {
  const h = new Date().getHours()
  if (h < 11) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

export default function SuperAdminHome() {
  const { profile } = useAuth()
  const [report, setReport] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [maint, setMaint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const [r, m, p] = await Promise.all([
          getSuperAdminReport().catch(() => null),
          getMaintenance().catch(() => null),
          listAllProfiles().catch(() => []),
        ])
        if (!c) {
          setReport(r)
          setMaint(m)
          setProfiles(p || [])
        }
      } catch (e) {
        if (!c) setError(e.message)
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [])

  // Satu sumber kebenaran: semua baris profiles
  const stats = useMemo(() => {
    const totalAccounts = profiles.length
    const usersOnly = profiles.filter((p) => p.role === 'user')
    const activeUsers = usersOnly.filter((p) => (p.status || 'active') === 'active')
    const admins = profiles.filter((p) => p.role === 'admin' || p.role === 'super_admin')
    return {
      totalAccounts,
      totalUsers: usersOnly.length,
      activeUsers: activeUsers.length,
      admins: admins.length,
      subsActive: report?.subsActive ?? 0,
      paymentsPending: report?.paymentsPending ?? 0,
      revenuePaid: report?.revenuePaid ?? 0,
    }
  }, [profiles, report])

  const name = (profile?.full_name || 'Admin').split(' ')[0]

  return (
    <SuperAdminShell title="Dashboard">
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>
          {greeting()}, {name}
        </h2>
        <p className="sa-muted" style={{ margin: 0 }}>
          Here&apos;s what&apos;s happening across Lanila today.
        </p>
      </div>

      <div style={{ marginBottom: 14 }}>
        {maint?.enabled ? (
          <span className="sa-badge warn">● Maintenance ON</span>
        ) : (
          <span className="sa-badge">● All systems operational</span>
        )}
      </div>

      {error && <p className="sa-err">{error}</p>}
      {loading && <p className="sa-muted">Loading...</p>}

      {!loading && (
        <div className="sa-kpi-grid">
          <div className="sa-kpi">
            <div className="label">Total accounts</div>
            <div className="value">{stats.totalAccounts}</div>
            <div className="hint">semua role</div>
          </div>
          <div className="sa-kpi">
            <div className="label">Client users</div>
            <div className="value">{stats.totalUsers}</div>
            <div className="hint">role = user</div>
          </div>
          <div className="sa-kpi">
            <div className="label">Active clients</div>
            <div className="value">{stats.activeUsers}</div>
            <div className="hint">status active</div>
          </div>
          <div className="sa-kpi">
            <div className="label">Active subs</div>
            <div className="value">{stats.subsActive}</div>
            <div className="hint">langganan aktif</div>
          </div>
          <div className="sa-kpi">
            <div className="label">Pending payments</div>
            <div className="value">{stats.paymentsPending}</div>
            <div className="hint">butuh verifikasi</div>
          </div>
          <div className="sa-kpi">
            <div className="label">Revenue paid</div>
            <div className="value" style={{ fontSize: 16 }}>
              {rupiah(stats.revenuePaid)}
            </div>
            <div className="hint">terverifikasi</div>
          </div>
          <div className="sa-kpi">
            <div className="label">Admins</div>
            <div className="value">{stats.admins}</div>
            <div className="hint">admin + super</div>
          </div>
        </div>
      )}

      <div className="sa-grid-2">
        <div className="sa-card">
          <h2>Quick actions</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Link className="sa-btn" to="/super-admin/maintenance">
              Maintenance
            </Link>
            <Link className="sa-btn" to="/super-admin/payment-settings">
              Payment settings
            </Link>
            <Link className="sa-btn" to="/super-admin/logs">
              Audit logs
            </Link>
            <Link className="sa-btn" to="/super-admin/reports">
              Reports
            </Link>
            <Link className="sa-btn" to="/admin">
              Buka panel Admin
            </Link>
          </div>
        </div>
        <div className="sa-card">
          <h2>Products</h2>
          {[
            ['CashFlow — Buku Kas', 'Live', true],
            ['Time & Habit', 'Coming soon', false],
            ['Productivity Tools', 'Coming soon', false],
          ].map(([n, s, live]) => (
            <div
              key={n}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
                opacity: live ? 1 : 0.7,
              }}
            >
              <div>
                <strong>{n}</strong>
                <div className="sa-muted">{s}</div>
              </div>
              <span className={live ? 'sa-badge' : 'sa-badge warn'}>
                {live ? 'Live' : 'Soon'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SuperAdminShell>
  )
}
