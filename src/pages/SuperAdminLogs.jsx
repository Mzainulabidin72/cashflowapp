import { useEffect, useMemo, useState } from 'react'
import { Activity, Download, RefreshCw } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import AdminShell from '../components/admin/AdminShell'
import { listActivityLogs } from '../lib/activityService'

const PAGE_SIZE = 25
const formatDate = (value) => value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`

export default function SuperAdminLogs() {
  const { pathname } = useLocation()
  const userActivityOnly = pathname.endsWith('/user-activity')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  async function load() {
    setLoading(true)
    setError('')
    try {
      setRows(await listActivityLogs(1000))
    } catch (e) {
      setError(e.message || 'Gagal memuat activity logs.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const actions = useMemo(() => [...new Set(rows.map((row) => row.action).filter(Boolean))].sort(), [rows])
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return rows.filter((row) => {
      if (userActivityOnly && row.role !== 'user' && !String(row.action).startsWith('account_')) return false
      if (action !== 'all' && row.action !== action) return false
      if (from && row.created_at < `${from}T00:00:00`) return false
      if (to && row.created_at > `${to}T23:59:59`) return false
      const target = row.targetProfile?.full_name || row.targetProfile?.email || row.target_id || ''
      const searchable = `${row.action || ''} ${row.role || ''} ${row.profile?.full_name || ''} ${row.profile?.email || ''} ${target} ${JSON.stringify(row.metadata || {})}`.toLocaleLowerCase()
      return !term || searchable.includes(term)
    })
  }, [rows, userActivityOnly, action, from, to, query])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [userActivityOnly, action, from, to, query])

  function exportCsv() {
    const contents = [
      ['Timestamp', 'Actor', 'Role', 'Action', 'Target user', 'Description', 'Metadata'],
      ...filtered.map((row) => [
        row.created_at,
        row.profile?.full_name || row.profile?.email || row.user_id,
        row.role,
        row.action,
        row.targetProfile?.full_name || row.targetProfile?.email || row.target_id,
        row.description,
        JSON.stringify(row.metadata || {}),
      ]),
    ].map((line) => line.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${contents}`], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'lanila-activity-logs.csv'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <AdminShell title={userActivityOnly ? 'User Activity' : 'Activity Logs'}>
      <div className="sa-page-heading">
        <div><h2>{userActivityOnly ? 'User activity' : 'Audit trail'}</h2><p>{userActivityOnly ? 'Login, registrasi, dan aktivitas akun pengguna.' : 'Jejak aktivitas penting platform. Log bersifat baca-saja dari panel ini.'}</p></div>
        <div className="sa-heading-actions"><button type="button" className="ad-btn ad-btn-ghost" onClick={load} disabled={loading}><RefreshCw size={15} />Refresh</button><button type="button" className="ad-btn ad-btn-primary" onClick={exportCsv} disabled={!filtered.length}><Download size={15} />Export CSV</button></div>
      </div>
      {error && <div className="sa-alert is-error" role="alert">{error}<button type="button" onClick={load}>Coba lagi</button></div>}
      <section className="ad-card sa-log-card">
        <div className="sa-log-filters">
          <label className="sa-search"><Activity size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari actor, aksi, target…" /></label>
          <select aria-label="Filter aksi" value={action} onChange={(e) => setAction(e.target.value)}><option value="all">Semua aksi</option>{actions.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <label>Dari <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>Sampai <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        {loading ? <div className="sa-skeleton-stack"><span /><span /><span /><span /></div> : visible.length === 0 ? (
          <div className="sa-empty-state"><Activity size={24} /><strong>Tidak ada log untuk filter ini</strong><span>Ubah filter atau muat ulang untuk mencoba kembali.</span></div>
        ) : <div className="ad-table-wrap sa-table-wrap"><table className="ad-table sa-logs-table">
          <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Target user</th><th>Description / metadata</th></tr></thead>
          <tbody>{visible.map((row) => <tr key={row.id}>
            <td>{formatDate(row.created_at)}</td>
            <td><strong>{row.profile?.full_name || row.profile?.email || 'System'}</strong><small className="sa-subtext">{row.role || '—'}</small></td>
            <td><span className="sa-action-pill">{String(row.action || 'event').replaceAll('_', ' ')}</span></td>
            <td>{row.targetProfile?.full_name || row.targetProfile?.email || row.target_id || '—'}</td>
            <td className="sa-metadata">{row.description || (row.metadata ? JSON.stringify(row.metadata) : '—')}</td>
          </tr>)}</tbody>
        </table></div>}
        {!loading && filtered.length > 0 && <div className="sa-pagination"><span>{filtered.length} aktivitas</span><div><button type="button" className="ad-btn ad-btn-ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</button><span>Halaman {page} / {pageCount}</span><button type="button" className="ad-btn ad-btn-ghost" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Berikutnya</button></div></div>}
      </section>
    </AdminShell>
  )
}
