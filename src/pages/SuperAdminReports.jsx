import { useEffect, useMemo, useState } from 'react'
import { Download, Printer, RefreshCw } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import AdminShell from '../components/admin/AdminShell'
import { getSuperAdminReport } from '../lib/reportService'
import { useLocation } from 'react-router-dom'

const COLORS = ['#5aa47a', '#c9a24b', '#7098a0', '#b88070']
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const monthLabel = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
const csv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`

export default function SuperAdminReports() {
  const { pathname } = useLocation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try { setData(await getSuperAdminReport()) }
    catch (e) { setError(e.message || 'Gagal memuat laporan.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const revenuePage = pathname.endsWith('/revenue')
  const userGrowth = useMemo(() => (data?.userGrowth || []).filter((item) => (!from || item.month >= from) && (!to || item.month <= to)), [data, from, to])
  const monthlyRevenue = useMemo(() => (data?.monthlyRevenue || []).filter((item) => (!from || item.month >= from) && (!to || item.month <= to)), [data, from, to])
  const monthlyActivity = useMemo(() => (data?.monthlyActivity || []).filter((item) => (!from || item.month >= from) && (!to || item.month <= to)), [data, from, to])
  const paymentStatusReport = useMemo(() => {
    const months = (data?.monthlyPaymentStatuses || []).filter((item) => (!from || item.month >= from) && (!to || item.month <= to))
    return ['paid', 'pending', 'rejected', 'expired', 'failed'].map((status) => ({
      name: status === 'paid' ? 'Verified' : `${status[0].toUpperCase()}${status.slice(1)}`,
      value: months.reduce((total, item) => total + item[status], 0),
    }))
  }, [data, from, to])

  function exportCsv() {
    if (!data) return
    const lines = [
      ['Report', revenuePage ? 'Revenue' : 'Lanila platform'],
      ['Generated at', new Date().toISOString()],
      ['Date from', from || '12-month range'],
      ['Date to', to || 'current month'],
      [],
      ['Metric', 'Value'],
      ['Total users', data.totalUsers],
      ['Active users', data.usersActive],
      ['Suspended users', data.usersSuspended],
      ['Total subscribers', data.totalSubscribers],
      ['Paid revenue', data.revenuePaid],
      ['Pending revenue', data.revenuePending],
      ['Verified payments', data.paymentsPaid],
      ['Pending payments', data.paymentsPending],
      ['Rejected payments', data.paymentsRejected],
      ['Expired payments', data.paymentsExpired],
      ['Failed payments', data.paymentsFailed],
      [],
      ['Month', 'New users', 'Paid revenue'],
      ...userGrowth.map((item, index) => [item.month, item.users, monthlyRevenue[index]?.revenue || 0]),
      [],
      ['Payment status in selected period', 'Count'],
      ...paymentStatusReport.map((item) => [item.name, item.value]),
      [],
      ['Month', 'Account activity events'],
      ...monthlyActivity.map((item) => [item.month, item.activities]),
      [],
      ['Plan', 'Users'],
      ...Object.entries(data.byPlan),
    ].map((line) => line.map(csv).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${lines}`], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = revenuePage ? 'lanila-revenue-report.csv' : 'lanila-platform-report.csv'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <AdminShell title={revenuePage ? 'Revenue Reports' : 'Reports'}>
      <div className="sa-page-heading">
        <div><h2>{revenuePage ? 'Revenue report' : 'Reports & analytics'}</h2><p>Laporan dihitung dari transaksi dan akun aktual di database.</p></div>
        <div className="sa-heading-actions"><button type="button" className="ad-btn ad-btn-ghost" onClick={() => window.print()} disabled={!data}><Printer size={15} />Print / PDF</button><button type="button" className="ad-btn ad-btn-primary" onClick={exportCsv} disabled={!data}><Download size={15} />Export CSV</button><button type="button" className="ad-btn ad-btn-ghost" onClick={load} disabled={loading}><RefreshCw size={15} />Refresh</button></div>
      </div>
      {error && <div className="sa-alert is-error" role="alert">{error}<button type="button" onClick={load}>Coba lagi</button></div>}
      {loading && !data ? <div className="sa-skeleton-stack"><span /><span /><span /><span /></div> : data && <>
        <section className="ad-card sa-report-controls">
          <strong>Rentang laporan</strong>
          <label>Dari <input type="month" value={from} min={data.userGrowth[0]?.month} max={data.userGrowth.at(-1)?.month} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>Sampai <input type="month" value={to} min={data.userGrowth[0]?.month} max={data.userGrowth.at(-1)?.month} onChange={(e) => setTo(e.target.value)} /></label>
          <button type="button" className="ad-btn ad-btn-ghost" onClick={() => { setFrom(''); setTo('') }}>12 bulan</button>
        </section>
        <section className="sa-report-summary">
          <article className="ad-kpi"><label>Total pengguna</label><strong>{data.totalUsers.toLocaleString('id-ID')}</strong></article>
          <article className="ad-kpi"><label>Pengguna aktif</label><strong>{data.usersActive.toLocaleString('id-ID')}</strong></article>
          <article className="ad-kpi"><label>Subscriber</label><strong>{data.totalSubscribers.toLocaleString('id-ID')}</strong></article>
          <article className="ad-kpi"><label>Pendapatan terverifikasi</label><strong>{money(data.revenuePaid)}</strong></article>
          <article className="ad-kpi"><label>Pendapatan menunggu</label><strong>{money(data.revenuePending)}</strong></article>
          <article className="ad-kpi"><label>Akun suspend</label><strong>{data.usersSuspended.toLocaleString('id-ID')}</strong></article>
        </section>
        <section className="sa-chart-grid">
          <article className="ad-card sa-chart-card">
            <header><div><h3>User growth</h3><p>Registrasi baru per bulan</p></div></header>
            {userGrowth.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={userGrowth}><CartesianGrid stroke="var(--ad-border)" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="month" tickFormatter={monthLabel} stroke="var(--ad-muted)" fontSize={11} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} stroke="var(--ad-muted)" fontSize={11} axisLine={false} tickLine={false} /><Tooltip labelFormatter={monthLabel} contentStyle={{ background: 'var(--ad-surface)', border: '1px solid var(--ad-border)', color: 'var(--ad-text)' }} /><Bar dataKey="users" name="Pengguna baru" fill="#5aa47a" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="sa-chart-empty">Tidak ada data pada rentang ini.</div>}
          </article>
          <article className="ad-card sa-chart-card">
            <header><div><h3>Monthly revenue</h3><p>Pendapatan dari pembayaran berstatus paid</p></div></header>
            {monthlyRevenue.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={monthlyRevenue}><CartesianGrid stroke="var(--ad-border)" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="month" tickFormatter={monthLabel} stroke="var(--ad-muted)" fontSize={11} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)} jt` : `${Math.round(value / 1000)} rb`} stroke="var(--ad-muted)" fontSize={10} axisLine={false} tickLine={false} /><Tooltip labelFormatter={monthLabel} formatter={money} contentStyle={{ background: 'var(--ad-surface)', border: '1px solid var(--ad-border)', color: 'var(--ad-text)' }} /><Bar dataKey="revenue" name="Pendapatan" fill="#c9a24b" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="sa-chart-empty">Tidak ada data pada rentang ini.</div>}
          </article>
          <article className="ad-card sa-chart-card sa-chart-card-small">
            <header><div><h3>Subscriptions</h3><p>Distribusi paket aktif</p></div></header>
            {Object.values(data.byPlan).some((value) => value > 0) ? <div className="sa-pie-layout"><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={Object.entries(data.byPlan).map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={3}>{Object.entries(data.byPlan).map(([name], index) => <Cell key={name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="sa-legend-list">{Object.entries(data.byPlan).map(([name, value], index) => <div key={name}><span><i style={{ background: COLORS[index % COLORS.length] }} />{name}</span><strong>{value}</strong></div>)}</div></div> : <div className="sa-chart-empty">Belum ada data langganan.</div>}
          </article>
          <article className="ad-card sa-chart-card sa-chart-card-small">
            <header><div><h3>Payment verification</h3><p>Status verifikasi pembayaran</p></div></header>
            {paymentStatusReport.some((item) => item.value > 0) ? <div className="sa-pie-layout"><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={paymentStatusReport} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={3}>{paymentStatusReport.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="sa-legend-list">{paymentStatusReport.map((item, index) => <div key={item.name}><span><i style={{ background: COLORS[index % COLORS.length] }} />{item.name}</span><strong>{item.value}</strong></div>)}</div></div> : <div className="sa-chart-empty">Belum ada data pembayaran pada rentang ini.</div>}
          </article>
          <article className="ad-card sa-chart-card sa-chart-wide">
            <header><div><h3>Account activity</h3><p>Audit log events per bulan pada rentang terpilih</p></div></header>
            {monthlyActivity.length && monthlyActivity.some((item) => item.activities > 0) ? <ResponsiveContainer width="100%" height={245}><LineChart data={monthlyActivity}><CartesianGrid stroke="var(--ad-border)" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="month" tickFormatter={monthLabel} stroke="var(--ad-muted)" fontSize={11} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} stroke="var(--ad-muted)" fontSize={11} axisLine={false} tickLine={false} /><Tooltip labelFormatter={monthLabel} contentStyle={{ background: 'var(--ad-surface)', border: '1px solid var(--ad-border)', color: 'var(--ad-text)' }} /><Line type="monotone" dataKey="activities" name="Aktivitas" stroke="#7098a0" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer> : <div className="sa-chart-empty">Belum ada aktivitas pada rentang ini.</div>}
          </article>
        </section>
      </>}
    </AdminShell>
  )
}
