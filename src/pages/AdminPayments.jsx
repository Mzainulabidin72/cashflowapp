import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import AdminShell from '../components/admin/AdminShell'
import { useAuth } from '../context/AuthContext'
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

function proofHref(payment) {
  const proof = payment.proof_url || payment.payment_proof || payment.proof
  if (typeof proof !== 'string') return ''
  try {
    const url = new URL(proof)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

export default function AdminPayments() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [badges, setBadges] = useState({})
  const [filter, setFilter] = useState('pending')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20
  const displayStatus = (value) => String(value || '').toLowerCase() === 'paid' ? 'Verified' : value

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

  const filtered = useMemo(() => rows.filter((r) => {
    if (filter !== 'all' && String(r.status || '').toLowerCase() !== filter) return false
    const term = query.trim().toLocaleLowerCase()
    return !term || `${r.profile?.full_name || ''} ${r.profile?.email || ''} ${r.subscription?.plan?.name || ''} ${r.note || ''} ${r.payment_reference || ''}`.toLocaleLowerCase().includes(term)
  }), [rows, filter, query])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [filter, query])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

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
    if (!window.confirm('Tolak pembayaran ini? Langganan tidak akan diaktifkan.')) return
    const reason = window.prompt('Alasan penolakan (opsional)')
    if (reason === null) return
    try {
      await rejectPayment(p.id, reason)
      setMsg('Pembayaran ditolak.')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <AdminShell title={profile?.role === 'super_admin' ? 'Payment Verification' : 'Pembayaran'} badges={badges}>
      <p className="ad-muted" style={{ marginBottom: 12 }}>
        Pending tanpa konfirmasi admin dalam <b>24 jam</b> otomatis status{' '}
        <b>expired</b> dan langganan pending dibatalkan.
      </p>
      {msg && <p style={{ color: 'var(--ad-ok)', fontSize: 13 }}>{msg}</p>}
      {error && <p className="ad-err" role="alert">{error} <button type="button" className="ad-btn ad-btn-ghost" onClick={load}>Coba lagi</button></p>}

      <div className="sa-payment-filters">
        {['pending', 'paid', 'rejected', 'expired', 'failed', 'all'].map((f) => (
          <button
            key={f}
            type="button"
            className={'ad-btn ' + (filter === f ? 'ad-btn-primary' : 'ad-btn-ghost')}
            onClick={() => setFilter(f)}
          >
            {f === 'paid' ? 'verified' : f}
          </button>
        ))}
        <label className="sa-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, paket, referensi…" /></label>
      </div>

      {loading && <div className="sa-skeleton-stack"><span /><span /><span /></div>}

      <div className="ad-card">
        <div className="ad-table-wrap sa-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Pelanggan</th>
                <th>Paket / nominal</th>
                <th>Tanggal & metode</th>
                <th>Referensi / bukti</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="ad-muted">
                    Tidak ada pembayaran yang cocok.
                  </td>
                </tr>
              )}
              {visible.map((p) => {
                const proof = proofHref(p)
                return (
                  <tr key={p.id}>
                  <td>
                    <strong>{p.profile?.full_name || p.profile?.email || p.user_id?.slice(0, 8) || '—'}</strong>
                    {p.profile?.full_name && <small className="sa-subtext">{p.profile?.email}</small>}
                  </td>
                  <td><strong>{p.subscription?.plan?.name || 'Langganan'}</strong><small className="sa-subtext">{rupiah(p.amount)}</small></td>
                  <td>{p.created_at ? new Date(p.created_at).toLocaleString('id-ID') : '—'}<small className="sa-subtext">{p.payment_method || p.method || 'Transfer'}</small></td>
                  <td>
                    <span>{p.payment_reference || p.reference || p.note || '—'}</span>
                    {proof && <a className="sa-proof-link" href={proof} target="_blank" rel="noreferrer">Lihat bukti</a>}
                  </td>
                  <td><span className={`sa-status is-${String(p.status || '').toLowerCase()}`}>{displayStatus(p.status) || '—'}</span></td>
                  <td>
                    {String(p.status).toLowerCase() === 'pending' && (
                      <span className="sa-row-actions">
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
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {!loading && filtered.length > 0 && <div className="sa-pagination"><span>{filtered.length} pembayaran</span><div><button type="button" className="ad-btn ad-btn-ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</button><span>Halaman {page} / {pageCount}</span><button type="button" className="ad-btn ad-btn-ghost" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Berikutnya</button></div></div>}
    </AdminShell>
  )
}
