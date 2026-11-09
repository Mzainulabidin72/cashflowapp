import { useEffect, useMemo, useState } from 'react'
import AdminShell from '../components/admin/AdminShell'
import {
  listAllSubscriptions,
  cancelSubscription,
  activateSubscription,
  extendSubscription,
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
function subscriptionStatus(row) {
  if (String(row.status || '').toLowerCase() === 'active' && row.ends_at && new Date(row.ends_at) < new Date()) {
    return 'expired'
  }
  return String(row.status || '').toLowerCase()
}

export default function AdminSubscriptions() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [badges, setBadges] = useState({})
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)

  const PAGE_SIZE = 20

  async function load() {
    setLoading(true)
    setError('')
    try {
      await runExpiryJobs()
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
      const st = subscriptionStatus(r)
      if (filter !== 'all' && st !== filter) return false
      if (planFilter !== 'all' && (r.plan?.name || 'Gratis') !== planFilter) return false
      if (!q.trim()) return true
      const s = q.toLowerCase()
      const name = (r.profile?.full_name || '').toLowerCase()
      const email = (r.profile?.email || '').toLowerCase()
      const plan = (r.plan?.name || '').toLowerCase()
      return name.includes(s) || email.includes(s) || plan.includes(s)
    })
  }, [rows, filter, q, planFilter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [filter, q, planFilter])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

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

  async function onExtend(row) {
    const raw = window.prompt(`Tambahkan berapa hari untuk ${row.profile?.email || 'akun ini'}?`, '30')
    if (raw === null) return
    const days = Number(raw)
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      setError('Masukkan jumlah hari antara 1 dan 3650.')
      return
    }
    if (!window.confirm(`Perpanjang ${row.plan?.name || 'langganan'} selama ${days} hari?`)) return
    try {
      await extendSubscription(row.id, days)
      setMsg('Masa langganan berhasil diperpanjang.')
      await load()
    } catch (e) {
      setError(e.message || 'Gagal memperpanjang langganan.')
    }
  }

  const planOptions = [...new Set(rows.map((row) => row.plan?.name).filter(Boolean))].sort()

  return (
    <AdminShell title="Subscription Management" badges={badges}>
      <p className="ad-muted" style={{ marginBottom: 12 }}>
        Kelola status langganan client. Pending pembayaran &gt;24 jam otomatis
        dibatalkan lewat sistem expiry.
      </p>

      {msg && (
        <p style={{ color: 'var(--ad-ok)', fontSize: 13, marginBottom: 8 }}>{msg}</p>
      )}
      {error && <p className="ad-err" role="alert">{error} <button type="button" className="ad-btn ad-btn-ghost" onClick={load}>Coba lagi</button></p>}

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
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          aria-label="Filter paket"
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--ad-border)',
            background: 'var(--ad-bg)',
            color: 'var(--ad-text)',
            fontSize: 13,
          }}
        >
          <option value="all">Semua paket</option>
          {planOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      {loading && <div className="sa-skeleton-stack" aria-label="Memuat langganan"><span /><span /><span /></div>}

      <div className="ad-card">
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Paket</th>
                <th>Pembayaran</th>
                <th>Status</th>
                <th>Periode / kedaluwarsa</th>
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
              {visible.map((r) => {
                const st = statusLabel(subscriptionStatus(r))
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
                    <td>
                      <div>{r.payment ? rupiah(r.payment.amount) : rupiah(r.plan?.price)}</div>
                      <span className="ad-muted" style={{ fontSize: 11 }}>{r.payment?.status || 'Belum ada pembayaran'}</span>
                    </td>
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
                        : 'Belum dimulai'}
                      {r.plan?.duration_days ? <div>{r.plan.duration_days} hari</div> : null}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setSelected(r)}>Detail</button>
                        {String(r.status).toLowerCase() === 'active' && (
                          <>
                            <button type="button" className="ad-btn ad-btn-ghost" onClick={() => onExtend(r)}>Perpanjang</button>
                            <button type="button" className="ad-btn ad-btn-danger" onClick={() => onCancel(r)}>Batalkan</button>
                          </>
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
        {!loading && filtered.length > 0 && (
          <div className="sa-pagination">
            <span>{filtered.length} langganan</span>
            <div>
              <button type="button" className="ad-btn ad-btn-ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</button>
              <span>Halaman {page} / {pageCount}</span>
              <button type="button" className="ad-btn ad-btn-ghost" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Berikutnya</button>
            </div>
          </div>
        )}
      </div>
      {selected && <div className="sa-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null) }}>
        <section className="sa-maintenance-preview sa-subscription-detail" role="dialog" aria-modal="true" aria-labelledby="sa-subscription-detail-title">
          <button type="button" className="sa-icon-btn sa-detail-close" onClick={() => setSelected(null)} aria-label="Tutup detail">×</button>
          <p className="sa-eyebrow">SUBSCRIPTION DETAILS</p>
          <h2 id="sa-subscription-detail-title">{selected.profile?.full_name || selected.profile?.email || 'Langganan'}</h2>
          <div className="sa-detail-list sa-subscription-detail-list">
            <div><span>Paket<small>{rupiah(selected.plan?.price)} · {selected.plan?.duration_days || '—'} hari</small></span><strong>{selected.plan?.name || '—'}</strong></div>
            <div><span>Status pembayaran<small>{selected.payment?.created_at ? new Date(selected.payment.created_at).toLocaleString('id-ID') : 'Tidak ada pembayaran'}</small></span><strong>{selected.payment?.status || '—'}</strong></div>
            <div><span>Mulai<small>{selected.starts_at ? new Date(selected.starts_at).toLocaleString('id-ID') : 'Belum dimulai'}</small></span><strong>{selected.starts_at ? 'Aktif' : '—'}</strong></div>
            <div><span>Kedaluwarsa<small>{selected.ends_at ? new Date(selected.ends_at).toLocaleString('id-ID') : 'Tidak tersedia'}</small></span><strong>{subscriptionStatus(selected) === 'expired' ? 'Kedaluwarsa' : statusLabel(selected.status).text}</strong></div>
          </div>
          <h3>Riwayat paket</h3>
          {rows.filter((row) => row.user_id === selected.user_id).length ? (
            <div className="sa-detail-list sa-subscription-detail-list">
              {rows.filter((row) => row.user_id === selected.user_id).map((row) => (
                <div key={row.id}><span>{row.plan?.name || 'Paket'}<small>{row.starts_at ? new Date(row.starts_at).toLocaleDateString('id-ID') : 'Belum dimulai'} — {row.ends_at ? new Date(row.ends_at).toLocaleDateString('id-ID') : '—'} · Pembayaran {row.payment?.status || '—'}</small></span><strong>{statusLabel(subscriptionStatus(row)).text}</strong></div>
              ))}
            </div>
          ) : <p className="ad-muted">Belum ada riwayat lain.</p>}
          <button type="button" className="ad-btn ad-btn-primary" onClick={() => setSelected(null)}>Tutup</button>
        </section>
      </div>}
    </AdminShell>
  )
}
