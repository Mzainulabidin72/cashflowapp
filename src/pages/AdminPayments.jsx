import { useEffect, useState } from 'react'
import AdminShell from '../components/admin/AdminShell'
import {
  listAllPayments,
  approvePayment,
  rejectPayment,
} from '../lib/adminPaymentService'
import { getAdminBadges } from '../lib/adminStatsService'
import { runExpiryJobs } from '../lib/expiryService'

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

export default function AdminPayments() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [badges, setBadges] = useState({})
  const [filter, setFilter] = useState('pending')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const exp = await runExpiryJobs()
      if (exp.payments?.expiredPayments > 0) {
        setMsg(
          `${exp.payments.expiredPayments} pembayaran otomatis dibatalkan (melewati 24 jam).`
        )
      }
      const data = await listAllPayments()
      setRows(data)
      setBadges(await getAdminBadges())
    } catch (e) {
      setError(e.message || 'Gagal memuat')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = rows.filter((r) => {
    if (filter === 'all') return true
    return String(r.status || '').toLowerCase() === filter
  })

  async function onApprove(p) {
    if (!confirm('Setujui pembayaran ini dan aktifkan langganan?')) return
    try {
      await approvePayment(p.id, p.subscription_id)
      setMsg('Pembayaran disetujui.')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function onReject(p) {
    const reason = prompt('Alasan penolakan (opsional)') || ''
    try {
      await rejectPayment(p.id, reason)
      setMsg('Pembayaran ditolak.')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <AdminShell title="Pembayaran" badges={badges}>
      <p className="ad-muted" style={{ marginBottom: 12 }}>
        Pending tanpa konfirmasi admin dalam <b>24 jam</b> otomatis status{' '}
        <b>expired</b> dan langganan pending dibatalkan.
      </p>
      {msg && <p style={{ color: 'var(--ad-ok)', fontSize: 13 }}>{msg}</p>}
      {error && <p className="ad-err">{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {['pending', 'paid', 'rejected', 'expired', 'all'].map((f) => (
          <button
            key={f}
            type="button"
            className={'ad-btn ' + (filter === f ? 'ad-btn-primary' : 'ad-btn-ghost')}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="ad-muted">Memuat...</p>}

      <div className="ad-card">
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>User</th>
                <th>Nominal</th>
                <th>Metode</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="ad-muted">
                    Tidak ada data.
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.created_at
                      ? new Date(p.created_at).toLocaleString('id-ID')
                      : '—'}
                  </td>
                  <td>
                    {p.profile?.full_name || p.profile?.email || p.user_id?.slice(0, 8)}
                  </td>
                  <td>{rupiah(p.amount)}</td>
                  <td>{p.payment_method || p.method || '—'}</td>
                  <td>{p.status}</td>
                  <td>
                    {String(p.status).toLowerCase() === 'pending' && (
                      <span style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="ad-btn ad-btn-primary"
                          onClick={() => onApprove(p)}
                        >
                          Setujui
                        </button>
                        <button
                          type="button"
                          className="ad-btn ad-btn-danger"
                          onClick={() => onReject(p)}
                        >
                          Tolak
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  )
}
