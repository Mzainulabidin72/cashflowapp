import { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarDays, CreditCard, Mail, Search, ShieldCheck, UserRound, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AdminShell from '../components/admin/AdminShell'
import { getUserAdminDetails, listAllProfiles, updateProfileRole, updateProfileStatus } from '../lib/adminService'

const PAGE_SIZE = 15
const date = (value, withTime = false) => value
  ? new Date(value).toLocaleString('id-ID', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })
  : '—'
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

export default function SuperAdminUsers() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [plan, setPlan] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [details, setDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setRows(await listAllProfiles())
    } catch (e) {
      setError(e.message || 'Gagal memuat akun.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const planOptions = useMemo(() => [...new Set(rows.map((row) => row.subscription?.plan?.name).filter(Boolean))].sort(), [rows])
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return rows.filter((row) => {
      if (role !== 'all' && row.role !== role) return false
      if (status !== 'all' && (row.status || 'active') !== status) return false
      if (plan !== 'all' && (row.subscription?.plan?.name || 'Gratis') !== plan) return false
      return !term || `${row.full_name || ''} ${row.email || ''}`.toLocaleLowerCase().includes(term)
    }).sort((left, right) => {
      const direction = sortOrder === 'oldest' ? 1 : -1
      return direction * String(left.created_at || '').localeCompare(String(right.created_at || ''))
    })
  }, [rows, query, role, status, plan, sortOrder])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [query, role, status, plan, sortOrder])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  async function changeRole(row, nextRole) {
    if (row.id === user?.id || row.role === 'super_admin' || !['user', 'admin'].includes(nextRole)) return
    if (!window.confirm(`Ubah role ${row.full_name || row.email} menjadi ${nextRole}? Hak akses akan berubah segera.`)) return
    setBusyId(row.id)
    setError('')
    setMessage('')
    try {
      await updateProfileRole(row.id, nextRole, user?.id)
      setMessage('Role akun berhasil diperbarui.')
      await load()
    } catch (e) {
      setError(e.message || 'Gagal mengubah role.')
    } finally {
      setBusyId('')
    }
  }

  async function changeStatus(row, nextStatus) {
    if (row.id === user?.id || row.role === 'super_admin') return
    if (!window.confirm(`${nextStatus === 'suspended' ? 'Suspend' : 'Aktifkan'} akun ${row.full_name || row.email}?`)) return
    setBusyId(row.id)
    setError('')
    setMessage('')
    try {
      await updateProfileStatus(row.id, nextStatus, user?.id)
      setMessage('Status akun berhasil diperbarui.')
      await load()
    } catch (e) {
      setError(e.message || 'Gagal mengubah status akun.')
    } finally {
      setBusyId('')
    }
  }

  async function openDetails(row) {
    setSelected(row)
    setDetails(null)
    setDetailsError('')
    setDetailsLoading(true)
    try {
      setDetails(await getUserAdminDetails(row.id))
    } catch (e) {
      setDetailsError(e.message || 'Gagal memuat detail akun.')
    } finally {
      setDetailsLoading(false)
    }
  }

  return (
    <AdminShell title="All Users">
      <div className="sa-page-heading">
        <div><h2>User management</h2><p>Kelola akses dan pantau akun yang terdaftar.</p></div>
        <span className="sa-count-pill">{filtered.length.toLocaleString('id-ID')} akun</span>
      </div>
      {message && <div className="sa-alert is-success" role="status">{message}</div>}
      {error && <div className="sa-alert is-error" role="alert">{error}<button type="button" onClick={load}>Coba lagi</button></div>}

      <section className="ad-card sa-user-card">
        <div className="sa-user-filters">
          <label className="sa-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama atau email" /></label>
          <select aria-label="Filter role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">Semua role</option><option value="user">User</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option>
          </select>
          <select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option><option value="suspended">Suspend</option>
          </select>
          <select aria-label="Filter paket" value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="all">Semua paket</option><option value="Gratis">Gratis</option>{planOptions.filter((name) => name !== 'Gratis').map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <select aria-label="Urutkan berdasarkan tanggal pendaftaran" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="newest">Terbaru</option><option value="oldest">Terlama</option>
          </select>
        </div>
        {loading ? <div className="sa-skeleton-stack"><span /><span /><span /><span /></div> : filtered.length === 0 ? (
          <div className="sa-empty-state"><UserRound size={25} /><strong>Tidak ada akun yang cocok</strong><span>Ubah kata kunci atau filter untuk melihat hasil lain.</span></div>
        ) : (
          <div className="ad-table-wrap sa-table-wrap">
            <table className="ad-table sa-users-table">
              <thead><tr><th>Pengguna</th><th>Terdaftar</th><th>Langganan</th><th>Role</th><th>Status</th><th>Aktivitas terakhir</th><th /></tr></thead>
              <tbody>{visible.map((row) => {
                const protectedAccount = row.id === user?.id || row.role === 'super_admin'
                const accountStatus = row.status || 'active'
                return <tr key={row.id}>
                  <td><div className="sa-user-cell"><span className="sa-avatar">{(row.full_name || row.email || '?').slice(0, 1).toUpperCase()}</span><div><strong>{row.full_name || 'Tanpa nama'}{row.id === user?.id && <small>Anda</small>}</strong><span>{row.email || '—'}</span></div></div></td>
                  <td>{date(row.created_at)}</td>
                  <td><span className="sa-plan-pill">{row.subscription?.plan?.name || 'Gratis'}</span></td>
                  <td><select aria-label={`Role ${row.email || row.id}`} disabled={protectedAccount || busyId === row.id} value={row.role || 'user'} onChange={(e) => changeRole(row, e.target.value)}><option value="user">User</option><option value="admin">Admin</option>{row.role === 'super_admin' && <option value="super_admin">Super Admin</option>}</select></td>
                  <td><span className={`sa-status is-${accountStatus}`}>{accountStatus === 'suspended' ? 'Suspend' : accountStatus === 'inactive' ? 'Nonaktif' : 'Aktif'}</span></td>
                  <td>{date(row.last_activity, true)}</td>
                  <td><div className="sa-row-actions">
                    <button type="button" className="ad-btn ad-btn-ghost" onClick={() => openDetails(row)}>Detail</button>
                    <button type="button" className={accountStatus === 'suspended' ? 'ad-btn ad-btn-primary' : 'ad-btn ad-btn-danger'} disabled={protectedAccount || busyId === row.id} onClick={() => changeStatus(row, accountStatus === 'suspended' ? 'active' : 'suspended')}>{accountStatus === 'suspended' ? 'Aktifkan' : 'Suspend'}</button>
                  </div></td>
                </tr>
              })}</tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > 0 && <div className="sa-pagination"><span>Menampilkan {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} dari {filtered.length}</span><div><button type="button" className="ad-btn ad-btn-ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</button><span>Halaman {page} / {pageCount}</span><button type="button" className="ad-btn ad-btn-ghost" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Berikutnya</button></div></div>}
      </section>

      {selected && <div className="sa-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null) }}>
        <section className="sa-user-detail" role="dialog" aria-modal="true" aria-labelledby="sa-user-detail-title">
          <header><div><h2 id="sa-user-detail-title">{selected.full_name || 'Detail akun'}</h2><p>{selected.email || selected.id}</p></div><button type="button" className="sa-icon-btn" onClick={() => setSelected(null)} aria-label="Tutup detail"><X size={18} /></button></header>
          {detailsLoading ? <div className="sa-skeleton-stack"><span /><span /><span /></div> : detailsError ? <div className="sa-alert is-error">{detailsError}</div> : details && <>
            <div className="sa-detail-grid">
              <div><UserRound size={16} /><span>Profil</span><strong>{selected.full_name || '—'}</strong><small>{selected.phone || 'Nomor telepon tidak tersedia'}</small></div>
              <div><CalendarDays size={16} /><span>Terdaftar</span><strong>{date(selected.created_at)}</strong><small>{selected.role || 'user'} · {selected.status || 'active'}</small></div>
              <div><ShieldCheck size={16} /><span>Langganan saat ini</span><strong>{selected.subscription?.plan?.name || 'Gratis'}</strong><small>{selected.subscription?.status || 'Tidak ada langganan aktif'}</small></div>
              <div><Activity size={16} /><span>Aktivitas terakhir</span><strong>{date(selected.last_activity, true)}</strong><small>{details.activity.length} aktivitas dimuat</small></div>
            </div>
            <h3><CreditCard size={16} /> Riwayat pembayaran</h3>
            {details.payments.length ? <div className="sa-detail-list">{details.payments.slice(0, 8).map((payment) => <div key={payment.id}><span>{date(payment.created_at, true)}<small>{payment.payment_method || 'Transfer'} · {payment.status}</small></span><strong>{money(payment.amount)}</strong></div>)}</div> : <p className="ad-muted">Belum ada riwayat pembayaran.</p>}
            <h3><Activity size={16} /> Aktivitas akun</h3>
            {details.activity.length ? <div className="sa-detail-list">{details.activity.slice(0, 8).map((log) => <div key={log.id}><span>{log.action || 'Aktivitas'}<small>{date(log.created_at, true)}</small></span><strong>{log.role || '—'}</strong></div>)}</div> : <p className="ad-muted">Belum ada aktivitas tercatat.</p>}
            <h3><Mail size={16} /> Riwayat langganan</h3>
            {details.subscriptions.length ? <div className="sa-detail-list">{details.subscriptions.slice(0, 6).map((subscription) => <div key={subscription.id}><span>{subscription.plan?.name || 'Paket'}<small>{date(subscription.starts_at)} — {date(subscription.ends_at)}</small></span><strong>{subscription.status || '—'}</strong></div>)}</div> : <p className="ad-muted">Belum ada langganan.</p>}
          </>}
        </section>
      </div>}
    </AdminShell>
  )
}
