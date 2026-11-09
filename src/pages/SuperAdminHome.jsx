import { useEffect, useState } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, CreditCard, RefreshCw, ShieldCheck, Users, Wallet } from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import AdminShell from '../components/admin/AdminShell'
import { getSuperAdminReport } from '../lib/reportService'

const MONEY = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const COLORS = ['#5aa47a', '#c9a24b', '#7098a0', '#b88070']
const monthLabel = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'short' })
const timestamp = (value) => value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

function Metric({ label, value, note, Icon, tone }) {
  return <article className="ad-kpi sa-metric">
    <div className={`sa-metric-icon is-${tone}`}><Icon size={18} /></div>
    <label>{label}</label>
    <strong>{value}</strong>
    <small>{note}</small>
  </article>
}

function EmptyChart() {
  return <div className="sa-chart-empty">Belum ada data pada rentang ini.</div>
}

export default function SuperAdminHome() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setData(await getSuperAdminReport())
    } catch (e) {
      setError(e.message || 'Gagal memuat ringkasan dashboard.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const currencyTooltip = (value) => MONEY(value)
  const metrics = data ? [
    { label: 'Total Users', value: data.totalUsers, note: 'Semua akun pengguna', Icon: Users, tone: 'green' },
    { label: 'Active Users', value: data.usersActive, note: 'Status akun aktif', Icon: ShieldCheck, tone: 'green' },
    { label: 'Suspended Users', value: data.usersSuspended, note: 'Akun yang dibatasi', Icon: Users, tone: 'clay' },
    { label: 'Total Subscribers', value: data.totalSubscribers, note: 'Pelanggan aktif berbayar', Icon: CreditCard, tone: 'gold' },
    { label: 'Free Plan Users', value: data.freePlanUsers, note: 'Pengguna paket Gratis', Icon: Users, tone: 'neutral' },
    { label: 'Basic Plan Users', value: data.basicPlanUsers, note: 'Pengguna paket Basic', Icon: CreditCard, tone: 'green' },
    { label: 'Pro Plan Users', value: data.proPlanUsers, note: 'Pengguna paket Pro', Icon: CreditCard, tone: 'gold' },
    { label: 'Total Revenue', value: MONEY(data.revenuePaid), note: 'Pembayaran terverifikasi', Icon: Wallet, tone: 'green' },
    { label: 'Pending Payments', value: data.paymentsPending, note: MONEY(data.revenuePending), Icon: Activity, tone: 'clay' },
    { label: 'Active Subscriptions', value: data.subsActive, note: `${data.subsPending} menunggu pembayaran`, Icon: ArrowUpRight, tone: 'gold' },
  ] : []

  return (
    <AdminShell title="Dashboard">
      <div className="sa-dashboard-heading">
        <div><p className="sa-eyebrow">OVERVIEW</p><h2>Platform overview</h2><p>Ringkasan dari data akun, langganan, dan pembayaran di Supabase.</p></div>
        <button type="button" className="ad-btn ad-btn-ghost" onClick={load} disabled={loading}><RefreshCw size={15} />{loading ? 'Memuat…' : 'Refresh data'}</button>
      </div>
      {error && <div className="sa-alert is-error" role="alert">{error}<button type="button" onClick={load}>Coba lagi</button></div>}

      {loading && !data ? <div className="sa-metrics-grid">{Array.from({ length: 10 }, (_, index) => <div key={index} className="ad-kpi sa-skeleton-kpi" />)}</div> : data && <>
        <section className="sa-metrics-grid" aria-label="Statistik utama">
          {metrics.map((metric) => <Metric key={metric.label} {...metric} />)}
        </section>

        <section className="sa-chart-grid">
          <article className="ad-card sa-chart-card">
            <header><div><h3>User registration growth</h3><p>Registrasi selama 12 bulan terakhir</p></div><span className="sa-chart-key"><i className="is-green" /> Pengguna baru</span></header>
            {data.userGrowth.some((item) => item.users > 0) ? <ResponsiveContainer width="100%" height={245}>
              <AreaChart data={data.userGrowth} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
                <defs><linearGradient id="sa-users-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5aa47a" stopOpacity={0.32} /><stop offset="100%" stopColor="#5aa47a" stopOpacity={0.015} /></linearGradient></defs>
                <CartesianGrid stroke="var(--ad-border)" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} stroke="var(--ad-muted)" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} stroke="var(--ad-muted)" fontSize={11} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={monthLabel} contentStyle={{ background: 'var(--ad-surface)', border: '1px solid var(--ad-border)', borderRadius: 10, color: 'var(--ad-text)' }} />
                <Area type="monotone" dataKey="users" name="Pengguna baru" stroke="#5aa47a" strokeWidth={2.5} fill="url(#sa-users-fill)" />
              </AreaChart>
            </ResponsiveContainer> : <EmptyChart />}
          </article>
          <article className="ad-card sa-chart-card">
            <header><div><h3>Monthly revenue</h3><p>Pembayaran yang telah diverifikasi</p></div><span className="sa-chart-key"><i className="is-gold" /> Pendapatan</span></header>
            {data.monthlyRevenue.some((item) => item.revenue > 0) ? <ResponsiveContainer width="100%" height={245}>
              <BarChart data={data.monthlyRevenue} margin={{ top: 10, right: 6, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="var(--ad-border)" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} stroke="var(--ad-muted)" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)} jt` : `${Math.round(value / 1000)} rb`} stroke="var(--ad-muted)" fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={monthLabel} formatter={currencyTooltip} contentStyle={{ background: 'var(--ad-surface)', border: '1px solid var(--ad-border)', borderRadius: 10, color: 'var(--ad-text)' }} />
                <Bar dataKey="revenue" name="Pendapatan" fill="#c9a24b" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer> : <EmptyChart />}
          </article>
          <article className="ad-card sa-chart-card sa-chart-card-small">
            <header><div><h3>Subscription distribution</h3><p>Jumlah pengguna per paket</p></div></header>
            {Object.values(data.byPlan).some((value) => value > 0) ? <div className="sa-pie-layout">
              <ResponsiveContainer width="100%" height={210}><PieChart><Pie data={Object.entries(data.byPlan).map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={3}>{Object.keys(data.byPlan).map((name, index) => <Cell key={name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: 'var(--ad-surface)', border: '1px solid var(--ad-border)', borderRadius: 10, color: 'var(--ad-text)' }} /></PieChart></ResponsiveContainer>
              <div className="sa-legend-list">{Object.entries(data.byPlan).map(([name, value], index) => <div key={name}><span><i style={{ background: COLORS[index % COLORS.length] }} />{name}</span><strong>{value}</strong></div>)}</div>
            </div> : <EmptyChart />}
          </article>
          <article className="ad-card sa-chart-card sa-chart-card-small">
            <header><div><h3>Payment status</h3><p>Status pembayaran keseluruhan</p></div></header>
            {data.byPaymentStatus.some((item) => item.value > 0) ? <div className="sa-pie-layout">
              <ResponsiveContainer width="100%" height={210}><PieChart><Pie data={data.byPaymentStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={3}>{data.byPaymentStatus.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: 'var(--ad-surface)', border: '1px solid var(--ad-border)', borderRadius: 10, color: 'var(--ad-text)' }} /></PieChart></ResponsiveContainer>
              <div className="sa-legend-list">{data.byPaymentStatus.map((item, index) => <div key={item.name}><span><i style={{ background: COLORS[index % COLORS.length] }} />{item.name}</span><strong>{item.value}</strong></div>)}</div>
            </div> : <EmptyChart />}
          </article>
        </section>

        <section className="ad-card sa-recent-activity">
          <header><div><h3><Activity size={17} /> Recent administrative activities</h3><p>Aktivitas terbaru yang tercatat pada audit log.</p></div><a href="/super-admin/logs">Lihat semua <ArrowDownRight size={14} /></a></header>
          {data.recentActivity.length ? <div className="sa-activity-list">{data.recentActivity.map((item) => <div key={item.id}><span className="sa-activity-dot" /><div><strong>{item.action || 'Aktivitas'}</strong><span>{item.profile?.full_name || item.profile?.email || 'Administrator'}{item.target_id ? ` · Target ${String(item.target_id).slice(0, 8)}` : ''}</span></div><time>{timestamp(item.created_at)}</time></div>)}</div> : <div className="sa-empty-state"><Activity size={23} /><strong>Belum ada aktivitas tercatat</strong><span>Aktivitas admin akan muncul di sini.</span></div>}
        </section>
      </>}
    </AdminShell>
  )
}
