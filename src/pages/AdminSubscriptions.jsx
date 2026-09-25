import { useEffect, useMemo, useState } from 'react'
import AdminShell from '../components/admin/AdminShell'
import {
  listAllSubscriptions,
  cancelSubscription,
  activateSubscription,
} from '../lib/adminSubscriptionService'
import { getAdminBadges } from '../lib/adminStatsService'
import { runExpiryJobs } from '../lib/expiryService'

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

function statusLabel(s) {
  const v = String(s || '').toLowerCase()
  if (v === 'active') return { text: 'Aktif', cls: 'ok' }
  if (v === 'pending') return { text: 'Pending', cls: 'wait' }
  if (v === 'cancelled' || v === 'canceled') return { text: 'Dibatalkan', cls: 'muted' }
  if (v === 'expired') return { text: 'Kedaluwarsa', cls: 'muted' }
  return { text: s || '—', cls: 'muted' }
}

export default function AdminSubscriptions() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [badges, setBadges] = useState({})
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      await runExpiryJobs().catch(() => {})
      const data = await listAllSubscriptions()
      setRows(data)
      setBadges(await getAdminBadges())
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal memuat langganan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const st = String(r.status || '').toLowerCase()
      if (filter !== 'all' && st !== filter) return false
      if (!q.trim()) return true
      const s = q.toLowerCase()
      const name = (r.profile?.full_name || '').toLowerCase()
      const email = (r.profile?.email || '').toLowerCase()
      const plan = (r.plan?.name || '').toLowerCase()
      return name.includes(s) || email.includes(s) || plan.includes(s)
    })
  }, [rows, filter, q])

  async function onCancel(row) {
    if (!confirm(`Batalkan langganan ${row.plan?.name || ''} untuk ${row.profile?.email || 'user'}?`))
      return
    try {
      await cancelSubscription(row.id)
      setMsg('Langganan dibatalkan.')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function onActivate(row) {
    if (!confirm('Aktifkan langganan ini?')) return
    try {
      const days = row.plan?.duration_days || 30
      await activateSubscription(row.id, days)
      setMsg('Langganan diaktifkan.')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <AdminShell title="Langganan" badges={badges}>
      <p className="ad-muted" style={{ marginBottom: 12 }}>
        Kelola status langganan client. Pending pembayaran &gt;24 jam otomatis
        dibatalkan lewat sistem expiry.
      </p>

      {msg && (
        <p style={{ color: 'var(--ad-ok)', fontSize: 13, marginBottom: 8 }}>{msg}</p>
      )}
      {error && <p className="ad-err">{error}</p>}

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 12,
          alignItems: 'center',
        }}
      >
        {['all', 'active', 'pending', 'cancelled', 'expired'].map((f) => (
          <button
            key={f}
            type="button"
            className={'ad-btn ' + (filter === f ? 'ad-btn-primary' : 'ad-btn-ghost')}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Semua' : f}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama / email / paket..."
          style={{
            marginLeft: 'auto',
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

      {loading && <p className="ad-muted">Memuat...</p>}

      <div className="ad-card">
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Paket</th>
                <th>Harga</th>
                <th>Status</th>
                <th>Periode</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="ad-muted">
                    Tidak ada langganan.
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const st = statusLabel(r.status)
                const client =
                  r.profile?.full_name || r.profile?.email || r.user_id?.slice(0, 8) || '—'
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{client}</div>
                      {r.profile?.email && r.profile?.full_name && (
                        <div className="ad-muted" style={{ fontSize: 11 }}>
                          {r.profile.email}
                        </div>
                      )}
                    </td>
                    <td>{r.plan?.name || '—'}</td>
                    <td>{rupiah(r.plan?.price)}</td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background:
                            st.cls === 'ok'
                              ? 'rgba(91,189,154,0.2)'
                              : st.cls === 'wait'
                                ? 'rgba(224,179,90,0.2)'
                                : 'rgba(139,149,165,0.2)',
                          color:
                            st.cls === 'ok'
                              ? 'var(--ad-ok)'
                              : st.cls === 'wait'
                                ? 'var(--ad-warn)'
                                : 'var(--ad-muted)',
                        }}
                      >
                        {st.text}
                      </span>
                    </td>
                    <td className="ad-muted" style={{ fontSize: 12 }}>
                      {r.starts_at
                        ? new Date(r.starts_at).toLocaleDateString('id-ID')
                        : '—'}
                      {' → '}
                      {r.ends_at
                        ? new Date(r.ends_at).toLocaleDateString('id-ID')
                        : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {String(r.status).toLowerCase() === 'active' && (
                          <button
                            type="button"
                            className="ad-btn ad-btn-danger"
                            onClick={() => onCancel(r)}
                          >
                            Batalkan
                          </button>
                        )}
                        {String(r.status).toLowerCase() === 'pending' && (
                          <>
                            <button
                              type="button"
                              className="ad-btn ad-btn-primary"
                              onClick={() => onActivate(r)}
                            >
                              Aktifkan
                            </button>
                            <button
                              type="button"
                              className="ad-btn ad-btn-danger"
                              onClick={() => onCancel(r)}
                            >
                              Batalkan
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  )
}
