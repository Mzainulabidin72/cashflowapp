import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminShell from '../components/admin/AdminShell'
import { getAdminBadges } from '../lib/adminStatsService'
import { supabase } from '../lib/supabase'

export default function AdminHome() {
  const [badges, setBadges] = useState({
    conversations: 0,
    openComplaints: 0,
    pendingPayments: 0,
    pendingSubscriptions: 0,
    totalUsers: 0,
  })
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [b, profilesRes, countRes] = await Promise.all([
          getAdminBadges(),
          supabase
            .from('profiles')
            .select('id, full_name, email, role, status, created_at')
            .eq('role', 'user')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'user'),
        ])
        if (cancelled) return
        setBadges({
          ...b,
          totalUsers: countRes.error ? 0 : countRes.count || 0,
        })
        if (profilesRes.error) throw profilesRes.error
        setClients(profilesRes.data || [])
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e.message || 'Gagal memuat')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = clients.filter((c) => {
    if (!q.trim()) return true
    const s = q.toLowerCase()
    return (
      (c.full_name || '').toLowerCase().includes(s) ||
      (c.email || '').toLowerCase().includes(s)
    )
  })

  return (
    <AdminShell title="Dashboard" badges={badges}>
      {error && <p className="ad-err">{error}</p>}
      {loading && <p className="ad-muted">Memuat...</p>}

      {!loading && (
        <>
          <div className="ad-kpi-grid">
            <div className="ad-kpi">
              <label>Total client</label>
              <strong>{badges.totalUsers}</strong>
            </div>
            <div className="ad-kpi">
              <label>Percakapan chat</label>
              <strong>{badges.conversations}</strong>
            </div>
            <div className="ad-kpi">
              <label>Keluhan terbuka</label>
              <strong>{badges.openComplaints}</strong>
            </div>
            <div className="ad-kpi">
              <label>Pembayaran pending</label>
              <strong>{badges.pendingPayments}</strong>
            </div>
            <div className="ad-kpi">
              <label>Langganan pending</label>
              <strong>{badges.pendingSubscriptions}</strong>
            </div>
          </div>

          <div className="ad-quick">
            <Link to="/admin/chat">
              <div className="t">Chat / Support</div>
              <div className="d">Balas pesan client</div>
            </Link>
            <Link to="/admin/complaints">
              <div className="t">Keluhan</div>
              <div className="d">Tiket & status</div>
            </Link>
            <Link to="/admin/payments">
              <div className="t">Pembayaran</div>
              <div className="d">Verifikasi transfer</div>
            </Link>
            <Link to="/admin/subscriptions">
              <div className="t">Langganan</div>
              <div className="d">Aktivasi paket</div>
            </Link>
          </div>

          <div className="ad-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <h2 style={{ margin: 0 }}>Client terbaru</h2>
              <input
                placeholder="Cari nama / email..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--ad-border)',
                  background: 'var(--ad-bg)',
                  color: 'var(--ad-text)',
                  fontSize: 13,
                  minWidth: 200,
                }}
              />
            </div>
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Daftar</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="ad-muted">
                        Tidak ada client.
                      </td>
                    </tr>
                  )}
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td>{c.full_name || '—'}</td>
                      <td>{c.email || '—'}</td>
                      <td>{c.status || 'active'}</td>
                      <td>
                        {c.created_at
                          ? new Date(c.created_at).toLocaleDateString('id-ID')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  )
}
