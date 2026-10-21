import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, RefreshCw, Loader2, CalendarRange, FileDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getUserPlanInfo } from '../lib/planAccess'
import { listWallets, createWallet, updateWallet, deleteWallet, walletBalance } from '../lib/walletService'
import { listDebts, createDebt, updateDebt, deleteDebt } from '../lib/debtService'
import { loadTransactions } from '../lib/dataService'
import { loadGoals, saveGoals, newGoalId } from '../lib/goalService'
import { buildReportHtml, printHtml } from '../lib/reportPdf'
import { formatDate, formatMoney, usePrefs } from '../lib/prefs'
import {
  history, baseline, periodToDate, recentAvgExpense, walletTotals, walletShares, debtSummary,
  cashRunway, financialHealth, healthAdvice, forecast, buildInsights, goalProgress,
  expenseAnalysis, remainingOf, isSettled, dueInfo, applyPayment, isoOf, periodLabel,
  runwayLabel, timeLeftLabel, fillMoney,
} from '../lib/proToolsCalc'

import OverviewCards from '../components/protools/OverviewCards'
import HealthCard from '../components/protools/HealthCard'
import InsightsCard from '../components/protools/InsightsCard'
import GoalsSection from '../components/protools/GoalsSection'
import WalletsCard from '../components/protools/WalletsCard'
import DebtsCard from '../components/protools/DebtsCard'
import ForecastCard from '../components/protools/ForecastCard'
import RunwayCard from '../components/protools/RunwayCard'
import ExpenseCard from '../components/protools/ExpenseCard'
import SimulationCard from '../components/protools/SimulationCard'
import ReportCard from '../components/protools/ReportCard'
import '../styles/protools.css'

const money = (n) => formatMoney(n)
const signed = (n) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${money(Math.abs(n))}`

export default function ProTools() {
  const prefs = usePrefs()
  const { user, profile } = useAuth()
  const startDay = prefs.monthStartDay

  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadErrors, setLoadErrors] = useState({}) // { txs, wallets, debts }
  const [txs, setTxs] = useState([])
  const [wallets, setWallets] = useState([])
  const [debts, setDebts] = useState([])
  const [goals, setGoals] = useState([])
  const [today, setToday] = useState(() => new Date())
  const [toast, setToast] = useState('')
  const [report, setReport] = useState({ state: 'idle' })
  const toastTimer = useRef(null)

  const flash = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3200)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  /* ---------- Muat data ---------- */
  const reloadAll = useCallback(async () => {
    const [t, w, d] = await Promise.allSettled([loadTransactions(user.id), listWallets(user.id), listDebts(user.id)])
    const errs = {}
    if (t.status === 'fulfilled') setTxs(t.value || [])
    else errs.txs = t.reason?.message || 'Gagal memuat transaksi'
    if (w.status === 'fulfilled') setWallets(w.value || [])
    else errs.wallets = w.reason?.message || 'Gagal memuat dompet'
    if (d.status === 'fulfilled') setDebts(d.value || [])
    else errs.debts = d.reason?.message || 'Gagal memuat utang'
    setLoadErrors(errs)
    setToday(new Date())
    setGoals(loadGoals(user.id))
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const p = await getUserPlanInfo(user.id)
        if (cancelled) return
        setPlan(p)
        if (p?.canUseProTools === true) await reloadAll()
      } catch (e) {
        if (!cancelled) setLoadErrors({ txs: e.message || 'Gagal memuat' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, reloadAll])

  async function refresh() {
    setRefreshing(true)
    try {
      await reloadAll()
    } finally {
      setRefreshing(false)
    }
  }
  const reloadWallets = async () => setWallets(await listWallets(user.id))
  const reloadDebts = async () => setDebts(await listDebts(user.id))

  /* ---------- Perhitungan (semua dari data nyata) ---------- */
  const calc = useMemo(() => {
    const h = history(txs, today, startDay, 6)
    const base = baseline(h)
    const ptd = periodToDate(txs, today, startDay)
    const balances = wallets.map((w) => ({ id: w.id, type: w.type, balance: walletBalance(w, txs) }))
    const wt = walletTotals(balances)
    const shares = walletShares(balances)
    const debtSum = debtSummary(debts, 'debt', today)
    const recvSum = debtSummary(debts, 'receivable', today)
    const exp3 = recentAvgExpense(h, 3)
    const runway = cashRunway(wt.liquid, exp3)
    const health = financialHealth({ h, liquid: wt.liquid, totalDebt: debtSum.outstanding, avgExpense: exp3.avg })
    const advice = healthAdvice(health, { baseline: base, liquid: wt.liquid, debts, today })
    const fc = forecast(h, startDay, debts, 3)
    const insights = buildInsights({ txs, today, startDay, debts, goals, runway })
    return { h, base, ptd, balances, wt, shares, debtSum, recvSum, exp3, runway, health, advice, fc, insights }
  }, [txs, wallets, debts, goals, today, startDay])

  /* ---------- Mutasi (melempar error agar dialog menampilkannya) ---------- */
  async function saveWallet(form, id) {
    if (id) await updateWallet(user.id, id, form)
    else await createWallet(user.id, form)
    await reloadWallets()
    flash(id ? 'Dompet diperbarui.' : 'Dompet ditambahkan.')
  }
  async function removeWallet(id) {
    await deleteWallet(user.id, id)
    await reloadWallets()
    flash('Dompet dihapus.')
  }

  async function saveDebt(value, kind, existing) {
    if (existing) {
      const paid = Number(existing.paid) || 0
      await updateDebt(user.id, existing.id, {
        person: value.person,
        amount: value.amount,
        due_date: value.due_date,
        note: value.note,
        status: paid >= value.amount ? 'paid' : 'open',
      })
    } else {
      await createDebt(user.id, { kind, ...value, paid: 0, status: 'open' })
    }
    await reloadDebts()
    flash(existing ? 'Perubahan disimpan.' : kind === 'debt' ? 'Utang ditambahkan.' : 'Piutang ditambahkan.')
  }
  async function payDebt(debt, amount) {
    const r = applyPayment(debt, amount)
    if (r.error) throw new Error(fillMoney(r.error, formatMoney))
    await updateDebt(user.id, debt.id, { paid: r.paid, status: r.status })
    await reloadDebts()
    flash(r.status === 'paid' ? 'Lunas.' : 'Pembayaran dicatat.')
  }
  async function removeDebt(id) {
    await deleteDebt(user.id, id)
    await reloadDebts()
    flash('Catatan dihapus.')
  }

  function persistGoals(next) {
    const r = saveGoals(user.id, next)
    if (!r.ok) throw new Error(r.error)
    setGoals(next)
  }
  function saveGoal(g) {
    const exists = goals.some((x) => x.id === g.id)
    persistGoals(exists ? goals.map((x) => (x.id === g.id ? { ...x, ...g } : x)) : [...goals, { status: 'active', ...g, id: newGoalId() }])
    flash(exists ? 'Goal diperbarui.' : 'Goal ditambahkan.')
  }
  function removeGoal(id) {
    persistGoals(goals.filter((g) => g.id !== id))
    flash('Goal dihapus.')
  }
  function depositGoal(id, amount) {
    persistGoals(goals.map((g) => (g.id === id ? { ...g, current: (Number(g.current) || 0) + amount } : g)))
    flash('Setoran dicatat.')
  }

  /* ---------- Laporan PDF ---------- */
  function buildReport() {
    const { ptd, wt, debtSum, recvSum, health, fc, runway, h } = calc
    const ea = expenseAnalysis(txs, today, startDay, 1)
    const openDebts = (kind) => debts.filter((d) => d.kind === kind && !isSettled(d)).sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
    const debtRows = (kind) => openDebts(kind).map((d) => [d.person, money(remainingOf(d)), d.due_date ? formatDate(d.due_date) : '—', dueInfo(d.due_date, today).label])
    const sections = [
      {
        heading: 'Ringkasan keuangan',
        kv: [
          ['Saldo dompet (dicatat manual)', money(wt.total)],
          ['Pemasukan periode ini', money(ptd.cur.income)],
          ['Pengeluaran periode ini', money(ptd.cur.expense)],
          ['Arus kas bersih periode ini', signed(ptd.cur.net)],
          ['Total utang', money(debtSum.outstanding)],
          ['Total piutang', money(recvSum.outstanding)],
        ],
        note: `Periode ${formatDate(ptd.from)} s/d ${formatDate(ptd.to)}. Saldo dompet dicatat manual dan tidak sama dengan arus kas dari transaksi.`,
      },
      {
        heading: 'Kesehatan keuangan',
        kv: [
          ['Skor', health.score == null ? 'Data belum cukup' : `${health.score}/100 (${health.label})`],
          ['Cash runway', runway.status === 'ok' ? runwayLabel(runway.months) : runway.status === 'empty' ? '0 bulan' : 'Belum dapat dihitung'],
        ],
        table: {
          head: ['Komponen', 'Kondisi', 'Skor'],
          rows: health.components.map((c) => [c.label, c.available ? c.display : 'Belum tersedia', c.available ? `${Math.round(c.value)}/100` : '—']),
          align: ['', '', 'r'],
        },
        note: 'Indikator perkiraan dari data yang dicatat, bukan penilaian keuangan resmi.',
      },
      {
        heading: 'Prakiraan arus kas',
        intro: fc.status === 'none' ? 'Belum ada riwayat periode selesai untuk diprakirakan.' : `Estimasi berdasarkan rata-rata ${fc.baseline.n} periode selesai. Angka bertanda "Estimasi" adalah perkiraan, bukan jaminan.`,
        table: fc.status === 'none' ? undefined : {
          head: ['Periode', 'Jenis', 'Pemasukan', 'Pengeluaran', 'Arus kas bersih'],
          rows: [
            ...h.periods.map((p) => [p.label, 'Aktual', money(p.income), money(p.expense), signed(p.net)]),
            ...fc.months.map((m) => [m.label, 'Estimasi', money(m.income), money(m.expense), signed(m.net)]),
          ],
          align: ['', '', 'r', 'r', 'r'],
        },
      },
      {
        heading: 'Financial goals',
        intro: goals.length ? undefined : 'Belum ada goal.',
        table: goals.length ? {
          head: ['Goal', 'Terkumpul / target', 'Progres', 'Target tanggal', 'Estimasi selesai'],
          rows: goals.map((g) => {
            const p = goalProgress(g, today)
            return [g.name, `${money(g.current)} / ${money(g.target)}`, `${Math.floor(p.pct)}%`, g.targetDate ? `${formatDate(g.targetDate)} (${timeLeftLabel(p)})` : '—', p.done ? 'Tercapai' : p.eta ? periodLabel(p.eta, 1) : '—']
          }),
          align: ['', 'r', 'r', '', ''],
        } : undefined,
        note: goals.length ? 'Nominal terkumpul dicatat manual; rencana setoran tidak otomatis memotong dompet.' : undefined,
      },
      {
        heading: 'Utang',
        intro: openDebts('debt').length ? undefined : 'Tidak ada utang aktif.',
        table: openDebts('debt').length ? { head: ['Kepada', 'Sisa', 'Jatuh tempo', 'Status'], rows: debtRows('debt'), align: ['', 'r', '', ''] } : undefined,
      },
      {
        heading: 'Piutang',
        intro: openDebts('receivable').length ? undefined : 'Tidak ada piutang aktif.',
        table: openDebts('receivable').length ? { head: ['Dari', 'Sisa', 'Jatuh tempo', 'Status'], rows: debtRows('receivable'), align: ['', 'r', '', ''] } : undefined,
      },
      {
        heading: 'Analisis pengeluaran (periode ini)',
        intro: ea.total > 0 ? `Total ${money(ea.total)}, ${formatDate(ea.from)} s/d ${formatDate(ea.to)}.` : 'Belum ada pengeluaran pada periode ini.',
        table: ea.total > 0 ? {
          head: ['Kategori', 'Jumlah', '% dari total'],
          rows: ea.rows.map((r) => [r.name, money(r.amount), `${r.pct.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`]),
          align: ['', 'r', 'r'],
        } : undefined,
      },
    ]
    return {
      title: 'Laporan Tools Pro',
      subtitle: 'Lanila Buku Kas',
      meta: [
        ['Pengguna', profile?.full_name || user?.email || '—'],
        ['Dibuat', formatDate(isoOf(today))],
        ['Periode berjalan', `${formatDate(ptd.from)} s/d ${formatDate(ptd.to)}`],
      ],
      sections,
      footnote: 'Laporan ini disusun otomatis dari data yang kamu catat di Lanila Buku Kas. Estimasi dan indikator bersifat perkiraan dan bukan nasihat keuangan.',
    }
  }

  async function exportReport() {
    setReport({ state: 'loading' })
    await new Promise((r) => setTimeout(r, 30)) // beri kesempatan UI menampilkan status memuat
    try {
      await printHtml(buildReportHtml(buildReport()))
      setReport({ state: 'success', message: 'Laporan siap dan dialog cetak dibuka. Pilih “Simpan sebagai PDF” untuk menyimpannya.' })
    } catch (e) {
      console.error(e)
      setReport({ state: 'error', message: e?.message || 'Gagal membuat laporan. Coba lagi.' })
    }
  }

  /* ---------- Tampilan ---------- */
  if (loading) {
    return (
      <div className="pt-page">
        <div className="pt-card" role="status" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Loader2 size={18} className="pt-spin" aria-hidden="true" /> Memuat Tools Pro…
        </div>
      </div>
    )
  }

  const allowed = plan?.canUseProTools === true
  if (!allowed) {
    return (
      <div className="pt-page">
        <header className="pt-header">
          <div>
            <h1 className="pt-title bk-serif">Tools Pro</h1>
            <p className="pt-subtitle">Analisis keuangan, target, dan simulasi untuk membantu pengambilan keputusan.</p>
          </div>
        </header>
        <div className="pt-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
          <span className="pt-tag is-warn"><Lock size={12} aria-hidden="true" /> Khusus Pro</span>
          <p style={{ margin: 0, lineHeight: 1.6 }}>Fitur ini khusus paket <b>Pro / Tahunan</b>. Upgrade untuk membuka perencanaan keuangan lengkap.</p>
          <Link to="/subscription" className="pt-btn pt-btn-primary">Upgrade langganan →</Link>
        </div>
      </div>
    )
  }

  const { h, ptd } = calc
  const histText = h.periods.length
    ? `Riwayat: ${h.periods[0].label}${h.periods.length > 1 ? ` – ${h.periods[h.periods.length - 1].label}` : ''} (${h.periods.length} periode selesai)`
    : 'Belum ada riwayat periode selesai'
  const periodText = `${formatDate(ptd.from)} s/d ${formatDate(ptd.to)}`

  return (
    <div className="pt-page">
      <header className="pt-header">
        <div style={{ minWidth: 0 }}>
          <h1 className="pt-title bk-serif">Tools Pro</h1>
          <p className="pt-subtitle">Analisis keuangan, target, dan simulasi untuk membantu pengambilan keputusan.</p>
          <div className="pt-period">
            <CalendarRange size={14} aria-hidden="true" />
            <span>Periode berjalan: {periodText} · {histText}</span>
          </div>
        </div>
        <div className="pt-header-actions">
          <button type="button" className="pt-btn" onClick={refresh} disabled={refreshing}>
            {refreshing ? <Loader2 size={15} className="pt-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />} Muat ulang
          </button>
          <button type="button" className="pt-btn pt-btn-primary" onClick={exportReport} disabled={report.state === 'loading'}>
            <FileDown size={15} aria-hidden="true" /> Export PDF
          </button>
        </div>
      </header>

      {loadErrors.txs && (
        <div className="pt-notice is-danger" role="alert">
          <div>Transaksi belum bisa dimuat ({loadErrors.txs}). Angka di halaman ini mungkin belum lengkap.{' '}
            <button type="button" className="pt-btn pt-btn-sm" onClick={refresh}>Coba lagi</button></div>
        </div>
      )}

      <OverviewCards ptd={ptd} wallets={calc.wt} debtSum={calc.debtSum} recvSum={calc.recvSum} periodText={periodText} />

      <div className="pt-grid pt-cols-2">
        <HealthCard health={calc.health} advice={calc.advice} periodsUsed={calc.health.score != null ? `${Math.min(3, h.periods.length)} periode selesai terakhir` : ''} />
        <InsightsCard insights={calc.insights} />
      </div>

      <div className="pt-grid">
        <GoalsSection goals={goals} today={today} onSave={saveGoal} onDelete={removeGoal} onDeposit={depositGoal} />
      </div>

      <div className="pt-grid pt-cols-2">
        <WalletsCard wallets={wallets} balances={calc.balances} shares={calc.shares} totals={calc.wt} onSave={saveWallet} onDelete={removeWallet} loadError={loadErrors.wallets} />
        <DebtsCard debts={debts} today={today} onSave={saveDebt} onPay={payDebt} onDelete={removeDebt} loadError={loadErrors.debts} />
      </div>

      <div className="pt-grid pt-cols-2-1">
        <ForecastCard h={h} fc={calc.fc} startDay={startDay} />
        <RunwayCard runway={calc.runway} wallets={wallets} balances={calc.balances} />
      </div>

      <div className="pt-grid pt-cols-2">
        <ExpenseCard txs={txs} today={today} startDay={startDay} />
        <SimulationCard startCash={calc.wt.liquid} base={calc.base} />
      </div>

      <div className="pt-grid">
        <ReportCard onExport={exportReport} status={report} />
      </div>

      {toast && <div className="bk-toast" role="status">{toast}</div>}
    </div>
  )
}
