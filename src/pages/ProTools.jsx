import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserPlanInfo } from '../lib/planAccess'
import {
  listWallets,
  createWallet,
  deleteWallet,
  walletBalance,
} from '../lib/walletService'
import {
  listDebts,
  createDebt,
  updateDebt,
  deleteDebt,
  remaining,
} from '../lib/debtService'
import { simpleForecast, monthlyTotals } from '../lib/predictionService'
import { exportSummaryPdf } from '../lib/exportPdf'
import { loadTransactions } from '../lib/dataService'

function rupiah(n) {
  return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID')
}

function goalsKey(userId) {
  return `lanila-goals-${userId}`
}

function loadGoals(userId) {
  try {
    const raw = localStorage.getItem(goalsKey(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveGoals(userId, goals) {
  localStorage.setItem(goalsKey(userId), JSON.stringify(goals))
}

function monthsBetween(from, to) {
  const a = new Date(from)
  const b = new Date(to)
  return Math.max(
    0,
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  )
}

function dueStatus(due) {
  if (!due) return { label: 'Tanpa jatuh tempo', cls: 'neutral' }
  const d = new Date(due)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = (d - now) / 86400000
  if (diff < 0) return { label: 'Terlambat', cls: 'bad' }
  if (diff <= 14) return { label: 'Segera', cls: 'warn' }
  return { label: 'Aman', cls: 'ok' }
}

export default function ProTools() {
  const { user } = useAuth()
  const [plan, setPlan] = useState(null)
  const [wallets, setWallets] = useState([])
  const [debts, setDebts] = useState([])
  const [txs, setTxs] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [showHealthInfo, setShowHealthInfo] = useState(false)

  // forms
  const [wName, setWName] = useState('')
  const [wType, setWType] = useState('cash')
  const [wStart, setWStart] = useState('0')
  const [dKind, setDKind] = useState('debt')
  const [dPerson, setDPerson] = useState('')
  const [dAmount, setDAmount] = useState('')
  const [dDue, setDDue] = useState('')
  const [gName, setGName] = useState('')
  const [gTarget, setGTarget] = useState('')
  const [gCurrent, setGCurrent] = useState('0')
  const [gDate, setGDate] = useState('')
  const [gMonthly, setGMonthly] = useState('')
  const [simIncome, setSimIncome] = useState('')
  const [simExpense, setSimExpense] = useState('')
  const [simSave, setSimSave] = useState('')
  const [simExtra, setSimExtra] = useState('0')
  const [spendRange, setSpendRange] = useState(1) // months

  const allowed = plan?.canUseProTools === true

  const reload = useCallback(async () => {
    if (!user) return
    const [p, w, d, t] = await Promise.all([
      getUserPlanInfo(user.id),
      listWallets(user.id),
      listDebts(user.id),
      loadTransactions(user.id),
    ])
    setPlan(p)
    setWallets(w)
    setDebts(d)
    setTxs(t)
    setGoals(loadGoals(user.id))
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await reload()
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e.message || 'Gagal memuat')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, reload])

  function flash(m) {
    setToast(m)
    setTimeout(() => setToast(''), 2500)
  }

  // ---- derived metrics ----
  const walletTotal = useMemo(() => {
    if (!wallets.length) return 0
    return wallets.reduce((s, w) => s + walletBalance(w, txs), 0)
  }, [wallets, txs])

  const totalDebt = useMemo(
    () =>
      debts
        .filter((d) => d.kind === 'debt' && d.status !== 'paid')
        .reduce((s, d) => s + remaining(d), 0),
    [debts]
  )
  const totalRecv = useMemo(
    () =>
      debts
        .filter((d) => d.kind === 'receivable' && d.status !== 'paid')
        .reduce((s, d) => s + remaining(d), 0),
    [debts]
  )

  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthTx = useMemo(
    () => txs.filter((t) => String(t.date || '').startsWith(thisMonth)),
    [txs, thisMonth]
  )
  const monthIncome = monthTx
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount || 0), 0)
  const monthExpense = monthTx
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount || 0), 0)
  const monthNet = monthIncome - monthExpense

  const forecast = useMemo(() => simpleForecast(txs, 3), [txs])
  const monthsHist = useMemo(() => monthlyTotals(txs), [txs])

  const avgExpense3 = useMemo(() => {
    const last = monthsHist.slice(-3)
    if (!last.length) return 0
    return last.reduce((s, r) => s + r.expense, 0) / last.length
  }, [monthsHist])

  const cashRunway =
    avgExpense3 > 0 ? walletTotal / avgExpense3 : null

  const dueSoon = useMemo(() => {
    return debts.filter((d) => {
      if (d.status === 'paid' || !d.due_date) return false
      const st = dueStatus(d.due_date)
      return st.cls === 'warn' || st.cls === 'bad'
    })
  }, [debts])

  const spendCats = useMemo(() => {
    const from = new Date()
    from.setMonth(from.getMonth() - (spendRange - 1))
    const keyFrom = from.toISOString().slice(0, 7)
    const map = {}
    txs
      .filter(
        (t) =>
          t.type === 'expense' && String(t.date || '').slice(0, 7) >= keyFrom
      )
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + Number(t.amount || 0)
      })
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, val]) => ({
        name,
        val,
        pct: Math.round((val / total) * 100),
      }))
  }, [txs, spendRange])

  // Health score (transparent, data-driven)
  const health = useMemo(() => {
    const savingsRate =
      monthIncome > 0
        ? Math.min(100, Math.max(0, ((monthIncome - monthExpense) / monthIncome) * 100))
        : monthsHist.length
          ? 50
          : 0
    const debtScore =
      walletTotal + totalDebt > 0
        ? Math.min(100, Math.max(0, 100 - (totalDebt / (walletTotal + totalDebt)) * 100))
        : totalDebt === 0
          ? 100
          : 30
    const emergencyTarget = avgExpense3 * 3
    const emergency =
      emergencyTarget > 0
        ? Math.min(100, (walletTotal / emergencyTarget) * 100)
        : walletTotal > 0
          ? 60
          : 0
    const cf =
      monthsHist.length >= 2
        ? monthsHist.slice(-3).filter((m) => m.net >= 0).length *
          (100 / Math.min(3, monthsHist.slice(-3).length))
        : monthNet >= 0
          ? 70
          : 40
    const score = Math.round(
      savingsRate * 0.25 + debtScore * 0.25 + emergency * 0.25 + cf * 0.25
    )
    return {
      score: Number.isFinite(score) ? score : 0,
      savingsRate: Math.round(savingsRate),
      debtScore: Math.round(debtScore),
      emergency: Math.round(emergency),
      cf: Math.round(cf),
    }
  }, [
    monthIncome,
    monthExpense,
    monthNet,
    walletTotal,
    totalDebt,
    avgExpense3,
    monthsHist,
  ])

  const insights = useMemo(() => {
    const list = []
    if (dueSoon.length) {
      list.push({
        level: 'warn',
        title: `${dueSoon.length} utang/piutang perlu perhatian`,
        body: 'Ada jatuh tempo dalam 14 hari atau sudah lewat.',
        action: null,
      })
    }
    if (avgExpense3 > 0 && monthExpense > avgExpense3 * 1.15) {
      const pct = Math.round(((monthExpense - avgExpense3) / avgExpense3) * 100)
      list.push({
        level: 'warn',
        title: `Pengeluaran bulan ini +${pct}%`,
        body: 'Lebih tinggi dari rata-rata 3 bulan terakhir.',
      })
    }
    if (avgExpense3 > 0 && monthExpense > 0 && monthExpense < avgExpense3 * 0.92) {
      const pct = Math.round(((avgExpense3 - monthExpense) / avgExpense3) * 100)
      list.push({
        level: 'ok',
        title: `Pengeluaran turun ~${pct}%`,
        body: 'Dibanding rata-rata 3 bulan terakhir.',
      })
    }
    if (cashRunway != null && cashRunway < 2 && walletTotal > 0) {
      list.push({
        level: 'warn',
        title: `Cash runway ~${cashRunway.toFixed(1)} bulan`,
        body: 'Saldo relatif tipis terhadap rata-rata pengeluaran.',
      })
    }
    const emergencyGoal = goals.find((g) =>
      /darurat|emergency/i.test(g.name || '')
    )
    if (emergencyGoal) {
      const pct = Math.min(
        100,
        Math.round(
          ((Number(emergencyGoal.current) || 0) /
            (Number(emergencyGoal.target) || 1)) *
            100
        )
      )
      list.push({
        level: 'info',
        title: `Dana darurat ${pct}%`,
        body: `${rupiah(emergencyGoal.current)} dari ${rupiah(emergencyGoal.target)}`,
      })
    }
    if (!list.length && txs.length) {
      list.push({
        level: 'info',
        title: 'Kondisi relatif stabil',
        body: 'Belum ada sinyal mendesak dari data saat ini.',
      })
    }
    if (!txs.length) {
      list.push({
        level: 'info',
        title: 'Belum cukup data',
        body: 'Catat transaksi untuk insight yang lebih akurat.',
      })
    }
    return list
  }, [dueSoon, avgExpense3, monthExpense, cashRunway, walletTotal, goals, txs.length])

  // ---- actions ----
  async function addWallet(e) {
    e.preventDefault()
    if (!allowed) return
    try {
      await createWallet(user.id, {
        name: wName,
        type: wType,
        balance_start: wStart,
      })
      setWName('')
      setWStart('0')
      flash('Dompet ditambah')
      await reload()
    } catch (e) {
      setError(e.message)
    }
  }

  async function addDebt(e) {
    e.preventDefault()
    if (!allowed) return
    try {
      await createDebt(user.id, {
        kind: dKind,
        person: dPerson,
        amount: dAmount,
        due_date: dDue || null,
      })
      setDPerson('')
      setDAmount('')
      setDDue('')
      flash('Utang/piutang ditambah')
      await reload()
    } catch (e) {
      setError(e.message)
    }
  }

  function persistGoals(next) {
    setGoals(next)
    saveGoals(user.id, next)
  }

  function addGoal(e) {
    e.preventDefault()
    if (!allowed || !gName.trim() || !gTarget) return
    const g = {
      id: crypto.randomUUID?.() || String(Date.now()),
      name: gName.trim(),
      target: Number(gTarget) || 0,
      current: Number(gCurrent) || 0,
      targetDate: gDate || null,
      monthly: Number(gMonthly) || 0,
      priority: 'medium',
      status: 'active',
    }
    persistGoals([g, ...goals])
    setGName('')
    setGTarget('')
    setGCurrent('0')
    setGDate('')
    setGMonthly('')
    flash('Goal dibuat')
  }

  function addToGoal(id, amount) {
    const next = goals.map((g) =>
      g.id === id
        ? { ...g, current: Math.max(0, Number(g.current) + Number(amount || 0)) }
        : g
    )
    persistGoals(next)
  }

  function removeGoal(id) {
    if (!confirm('Hapus goal ini?')) return
    persistGoals(goals.filter((g) => g.id !== id))
  }

  function doPdf() {
    if (!allowed) return
    const lines = [
      { label: 'Total saldo dompet', value: rupiah(walletTotal) },
      { label: 'Pemasukan bulan ini', value: rupiah(monthIncome) },
      { label: 'Pengeluaran bulan ini', value: rupiah(monthExpense) },
      { label: 'Neto bulan ini', value: rupiah(monthNet) },
      { label: 'Total utang', value: rupiah(totalDebt) },
      { label: 'Total piutang', value: rupiah(totalRecv) },
      { label: 'Financial health', value: `${health.score}/100` },
      ...forecast.months.map((m) => ({
        label: `Prediksi ${m.month}`,
        value: `Net ${rupiah(m.net)}`,
      })),
      ...goals.map((g) => ({
        label: `Goal ${g.name}`,
        value: `${rupiah(g.current)} / ${rupiah(g.target)}`,
      })),
    ]
    exportSummaryPdf({ title: 'Laporan Tools Pro — Buku Kas', lines })
  }

  const simResult = useMemo(() => {
    const inc = Number(simIncome) || 0
    const exp = Number(simExpense) || 0
    const save = Number(simSave) || 0
    const extra = Number(simExtra) || 0
    if (!inc && !exp) return null
    const monthlyNet = inc - exp - save
    return {
      monthlyNet,
      afterExtra: walletTotal + monthlyNet - extra,
      monthsToZero:
        monthlyNet < 0 && walletTotal > 0
          ? (walletTotal / Math.abs(monthlyNet)).toFixed(1)
          : null,
    }
  }, [simIncome, simExpense, simSave, simExtra, walletTotal])

  if (loading) {
    return (
      <div className="ft-page">
        <p className="ft-muted">Memuat Tools Pro...</p>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="ft-page">
        <Link to="/dashboard" className="ft-back">
          ← Dashboard
        </Link>
        <h1 className="ft-h1">Tools Pro</h1>
        <p className="ft-lead">
          Financial Intelligence — wallet, utang, prediksi, goal, dan laporan.
        </p>
        <div className="ft-card ft-lock">
          <div className="ft-lock-badge">🔒 Pro</div>
          <p>
            Fitur ini khusus paket <b>Pro / Tahunan</b>. Upgrade untuk membuka
            perencanaan keuangan lengkap.
          </p>
          <Link to="/subscription" className="ft-btn">
            Upgrade langganan →
          </Link>
        </div>
        <style>{ftCss}</style>
      </div>
    )
  }

  return (
    <div className="ft-page">
      <div className="ft-top">
        <div>
          <Link to="/dashboard" className="ft-back">
            ← Dashboard
          </Link>
          <h1 className="ft-h1">Tools Pro</h1>
          <p className="ft-lead">
            Financial Intelligence — pantau kondisi, target, dan apa yang perlu
            diperhatikan.
          </p>
        </div>
      </div>

      {toast && <div className="ft-toast">{toast}</div>}
      {error && <div className="ft-err">{error}</div>}

      {/* OVERVIEW */}
      <section className="ft-section">
        <h2 className="ft-h2">Ringkasan keuangan</h2>
        <div className="ft-metrics">
          <div className="ft-metric">
            <span>Saldo dompet</span>
            <b>{rupiah(walletTotal)}</b>
          </div>
          <div className="ft-metric">
            <span>Pemasukan bulan ini</span>
            <b className="up">{rupiah(monthIncome)}</b>
          </div>
          <div className="ft-metric">
            <span>Pengeluaran bulan ini</span>
            <b className="down">{rupiah(monthExpense)}</b>
          </div>
          <div className="ft-metric">
            <span>Neto bulan ini</span>
            <b className={monthNet >= 0 ? 'up' : 'down'}>{rupiah(monthNet)}</b>
          </div>
          <div className="ft-metric">
            <span>Total utang</span>
            <b className="down">{rupiah(totalDebt)}</b>
          </div>
          <div className="ft-metric">
            <span>Piutang</span>
            <b>{rupiah(totalRecv)}</b>
          </div>
        </div>
      </section>

      <div className="ft-grid-2">
        {/* HEALTH */}
        <section className="ft-card">
          <div className="ft-card-head">
            <h2 className="ft-h2">Financial health</h2>
            <button
              type="button"
              className="ft-linkish"
              onClick={() => setShowHealthInfo(true)}
            >
              Cara hitung
            </button>
          </div>
          <div className="ft-score">{health.score}<small>/100</small></div>
          {[
            ['Tabungan (bulan ini)', health.savingsRate],
            ['Beban utang', health.debtScore],
            ['Dana darurat (≈3 bln)', health.emergency],
            ['Cash flow', health.cf],
          ].map(([label, v]) => (
            <div key={label} className="ft-bar-row">
              <div className="ft-bar-label">
                <span>{label}</span>
                <span>{v}%</span>
              </div>
              <div className="ft-bar">
                <span style={{ width: `${Math.min(100, v)}%` }} />
              </div>
            </div>
          ))}
        </section>

        {/* INSIGHTS */}
        <section className="ft-card">
          <h2 className="ft-h2">Insight & rekomendasi</h2>
          <div className="ft-insights">
            {insights.map((ins, i) => (
              <div key={i} className={'ft-insight ' + ins.level}>
                <div className="ft-insight-title">{ins.title}</div>
                <div className="ft-muted">{ins.body}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* GOALS */}
      <section className="ft-section">
        <h2 className="ft-h2">Financial goals</h2>
        <form className="ft-form-row" onSubmit={addGoal}>
          <input
            className="ft-input"
            placeholder="Nama goal"
            value={gName}
            onChange={(e) => setGName(e.target.value)}
            required
          />
          <input
            className="ft-input"
            type="number"
            placeholder="Target Rp"
            value={gTarget}
            onChange={(e) => setGTarget(e.target.value)}
            required
          />
          <input
            className="ft-input"
            type="number"
            placeholder="Terkumpul"
            value={gCurrent}
            onChange={(e) => setGCurrent(e.target.value)}
          />
          <input
            className="ft-input"
            type="date"
            value={gDate}
            onChange={(e) => setGDate(e.target.value)}
          />
          <input
            className="ft-input"
            type="number"
            placeholder="Setoran / bln"
            value={gMonthly}
            onChange={(e) => setGMonthly(e.target.value)}
          />
          <button className="ft-btn" type="submit">
            + Goal
          </button>
        </form>
        {!goals.length && (
          <p className="ft-muted">Belum ada goal. Mulai dengan target pertama.</p>
        )}
        <div className="ft-goals">
          {goals.map((g) => {
            const pct = Math.min(
              100,
              Math.round(
                ((Number(g.current) || 0) / (Number(g.target) || 1)) * 100
              )
            )
            const left = Math.max(0, Number(g.target) - Number(g.current))
            const needMonthly =
              g.targetDate && left > 0
                ? Math.ceil(
                    left /
                      Math.max(1, monthsBetween(new Date(), g.targetDate) || 1)
                  )
                : null
            return (
              <div key={g.id} className="ft-card ft-goal">
                <div className="ft-goal-top">
                  <b>{g.name}</b>
                  <button
                    type="button"
                    className="ft-linkish"
                    onClick={() => removeGoal(g.id)}
                  >
                    Hapus
                  </button>
                </div>
                <div className="ft-goal-amt">
                  {rupiah(g.current)}{' '}
                  <span className="ft-muted">/ {rupiah(g.target)}</span>
                </div>
                <div className="ft-bar">
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div className="ft-muted">
                  {pct}% · sisa {rupiah(left)}
                  {g.targetDate ? ` · target ${g.targetDate}` : ''}
                  {needMonthly != null
                    ? ` · butuh ~${rupiah(needMonthly)}/bln`
                    : ''}
                </div>
                <div className="ft-goal-actions">
                  <button
                    type="button"
                    className="ft-btn ghost"
                    onClick={() => {
                      const v = prompt('Tambah setoran (Rp)', g.monthly || '100000')
                      if (v) addToGoal(g.id, v)
                    }}
                  >
                    + Setor
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="ft-grid-2">
        {/* WALLETS */}
        <section className="ft-card">
          <h2 className="ft-h2">Multi-wallet</h2>
          <div className="ft-metric-inline">
            Total <b>{rupiah(walletTotal)}</b>
          </div>
          <form className="ft-form-col" onSubmit={addWallet}>
            <input
              className="ft-input"
              placeholder="Nama"
              value={wName}
              onChange={(e) => setWName(e.target.value)}
              required
            />
            <select
              className="ft-input"
              value={wType}
              onChange={(e) => setWType(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="ewallet">E-Wallet</option>
              <option value="investment">Investasi</option>
              <option value="other">Lainnya</option>
            </select>
            <input
              className="ft-input"
              type="number"
              placeholder="Saldo awal"
              value={wStart}
              onChange={(e) => setWStart(e.target.value)}
            />
            <button className="ft-btn" type="submit">
              Tambah
            </button>
          </form>
          {!wallets.length && (
            <p className="ft-muted">Belum ada dompet/rekening.</p>
          )}
          {wallets.map((w) => (
            <div key={w.id} className="ft-row">
              <div>
                <b>{w.name}</b>
                <span className="ft-muted"> · {w.type}</span>
                <div>{rupiah(walletBalance(w, txs))}</div>
              </div>
              <button
                type="button"
                className="ft-linkish"
                onClick={async () => {
                  if (confirm('Hapus dompet?')) {
                    await deleteWallet(user.id, w.id)
                    await reload()
                  }
                }}
              >
                Hapus
              </button>
            </div>
          ))}
        </section>

        {/* DEBTS */}
        <section className="ft-card">
          <h2 className="ft-h2">Utang & piutang</h2>
          <div className="ft-metrics mini">
            <div>
              <span className="ft-muted">Utang</span>
              <b className="down">{rupiah(totalDebt)}</b>
            </div>
            <div>
              <span className="ft-muted">Piutang</span>
              <b>{rupiah(totalRecv)}</b>
            </div>
          </div>
          <form className="ft-form-col" onSubmit={addDebt}>
            <select
              className="ft-input"
              value={dKind}
              onChange={(e) => setDKind(e.target.value)}
            >
              <option value="debt">Utang saya</option>
              <option value="receivable">Piutang</option>
            </select>
            <input
              className="ft-input"
              placeholder="Nama orang"
              value={dPerson}
              onChange={(e) => setDPerson(e.target.value)}
              required
            />
            <input
              className="ft-input"
              type="number"
              placeholder="Jumlah"
              value={dAmount}
              onChange={(e) => setDAmount(e.target.value)}
              required
            />
            <input
              className="ft-input"
              type="date"
              value={dDue}
              onChange={(e) => setDDue(e.target.value)}
            />
            <button className="ft-btn" type="submit">
              Tambah
            </button>
          </form>
          {debts.map((d) => {
            const st = dueStatus(d.due_date)
            return (
              <div key={d.id} className="ft-row">
                <div>
                  <b>
                    {d.kind === 'debt' ? 'Utang' : 'Piutang'} · {d.person}
                  </b>
                  <div>
                    {rupiah(remaining(d))}
                    {d.status === 'paid' ? ' · lunas' : ''}
                  </div>
                  {d.due_date && (
                    <span className={'ft-tag ' + st.cls}>
                      {st.label} · {d.due_date}
                    </span>
                  )}
                </div>
                <div className="ft-row-actions">
                  {d.status !== 'paid' && (
                    <button
                      type="button"
                      className="ft-linkish"
                      onClick={async () => {
                        await updateDebt(user.id, d.id, {
                          paid: d.amount,
                          status: 'paid',
                        })
                        await reload()
                      }}
                    >
                      Lunas
                    </button>
                  )}
                  <button
                    type="button"
                    className="ft-linkish"
                    onClick={async () => {
                      await deleteDebt(user.id, d.id)
                      await reload()
                    }}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            )
          })}
        </section>
      </div>

      {/* FORECAST + RUNWAY */}
      <div className="ft-grid-2">
        <section className="ft-card">
          <h2 className="ft-h2">Prediksi cash flow</h2>
          {forecast.message ? (
            <p className="ft-muted">{forecast.message}</p>
          ) : (
            <>
              <p className="ft-muted">
                Rata-rata {forecast.basedOn} bulan terakhir → proyeksi 3 bulan
              </p>
              <div className="ft-metrics mini">
                <div>
                  <span className="ft-muted">Avg in</span>
                  <b>{rupiah(forecast.avgIncome)}</b>
                </div>
                <div>
                  <span className="ft-muted">Avg out</span>
                  <b>{rupiah(forecast.avgExpense)}</b>
                </div>
                <div>
                  <span className="ft-muted">Avg net</span>
                  <b>{rupiah(forecast.avgNet)}</b>
                </div>
              </div>
              <ul className="ft-list">
                {forecast.months.map((m) => (
                  <li key={m.month}>
                    {m.month}: neto prediksi <b>{rupiah(m.net)}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="ft-card">
          <h2 className="ft-h2">Cash runway</h2>
          {cashRunway == null ? (
            <p className="ft-muted">Belum cukup data pengeluaran.</p>
          ) : (
            <>
              <div className="ft-score sm">{cashRunway.toFixed(1)}<small> bln</small></div>
              <p className="ft-muted">
                Saldo dompet {rupiah(walletTotal)} ÷ rata-rata pengeluaran{' '}
                {rupiah(avgExpense3)}/bulan (3 bulan terakhir).
              </p>
            </>
          )}
        </section>
      </div>

      {/* SPENDING */}
      <section className="ft-card">
        <div className="ft-card-head">
          <h2 className="ft-h2">Analisis pengeluaran</h2>
          <select
            className="ft-input sm"
            value={spendRange}
            onChange={(e) => setSpendRange(Number(e.target.value))}
          >
            <option value={1}>Bulan ini</option>
            <option value={3}>3 bulan</option>
            <option value={6}>6 bulan</option>
            <option value={12}>12 bulan</option>
          </select>
        </div>
        {!spendCats.length && (
          <p className="ft-muted">Belum ada pengeluaran di periode ini.</p>
        )}
        {spendCats.map((c) => (
          <div key={c.name} className="ft-bar-row">
            <div className="ft-bar-label">
              <span>
                {c.name} · {c.pct}%
              </span>
              <span>{rupiah(c.val)}</span>
            </div>
            <div className="ft-bar">
              <span style={{ width: `${c.pct}%` }} />
            </div>
          </div>
        ))}
      </section>

      {/* SIMULATOR */}
      <section className="ft-card">
        <h2 className="ft-h2">Simulasi keuangan</h2>
        <p className="ft-muted">
          Sketsa skenario — tidak mengubah data transaksi.
        </p>
        <div className="ft-form-row">
          <input
            className="ft-input"
            type="number"
            placeholder="Pemasukan / bln"
            value={simIncome}
            onChange={(e) => setSimIncome(e.target.value)}
          />
          <input
            className="ft-input"
            type="number"
            placeholder="Pengeluaran / bln"
            value={simExpense}
            onChange={(e) => setSimExpense(e.target.value)}
          />
          <input
            className="ft-input"
            type="number"
            placeholder="Tabungan / bln"
            value={simSave}
            onChange={(e) => setSimSave(e.target.value)}
          />
          <input
            className="ft-input"
            type="number"
            placeholder="Pengeluaran sekali"
            value={simExtra}
            onChange={(e) => setSimExtra(e.target.value)}
          />
        </div>
        {simResult && (
          <div className="ft-sim-out">
            <div>
              Neto bulanan (setelah tabungan):{' '}
              <b className={simResult.monthlyNet >= 0 ? 'up' : 'down'}>
                {rupiah(simResult.monthlyNet)}
              </b>
            </div>
            <div>
              Saldo setelah extra: <b>{rupiah(simResult.afterExtra)}</b>
            </div>
            {simResult.monthsToZero && (
              <div className="ft-muted">
                Jika neto negatif, saldo habis ~{simResult.monthsToZero} bulan.
              </div>
            )}
          </div>
        )}
      </section>

      {/* REPORTS */}
      <section className="ft-card">
        <h2 className="ft-h2">Laporan & export</h2>
        <p className="ft-muted">
          Ringkasan health, prediksi, utang, dan goal (print → PDF).
        </p>
        <button type="button" className="ft-btn" onClick={doPdf}>
          Export PDF laporan Pro
        </button>
      </section>

      {showHealthInfo && (
        <div className="ft-modal-bg" onClick={() => setShowHealthInfo(false)}>
          <div className="ft-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Cara hitung Financial Health</h3>
            <ul className="ft-list">
              <li>25% tabungan = (pemasukan − pengeluaran) / pemasukan bulan ini</li>
              <li>25% utang = semakin kecil utang vs (saldo+utang), skor makin tinggi</li>
              <li>25% darurat = saldo / (3 × rata-rata pengeluaran 3 bln)</li>
              <li>25% cash flow = proporsi bulan neto positif di 3 bulan terakhir</li>
            </ul>
            <button type="button" className="ft-btn" onClick={() => setShowHealthInfo(false)}>
              Tutup
            </button>
          </div>
        </div>
      )}

      <style>{ftCss}</style>
    </div>
  )
}

const ftCss = `
.ft-page {
  min-height: 100vh;
  background: var(--paper, #16231f);
  color: var(--ink, #edeae0);
  padding: 20px 16px 48px;
  max-width: 1200px;
  margin: 0 auto;
  box-sizing: border-box;
}
.ft-back { color: var(--brass, #c9a24b); text-decoration: none; font-size: 13px; font-weight: 600; }
.ft-h1 { margin: 8px 0 4px; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.ft-h2 { margin: 0 0 12px; font-size: 15px; font-weight: 700; }
.ft-lead, .ft-muted { color: var(--ink-dim, #a9b0a8); font-size: 13px; line-height: 1.45; }
.ft-lead { margin: 0 0 16px; }
.ft-section { margin-bottom: 18px; }
.ft-card {
  background: var(--paper-raised, #1d2e28);
  border: 1px solid var(--paper-line, #2b3e37);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 14px;
}
.ft-card-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.ft-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
.ft-metrics.mini { grid-template-columns: repeat(3, 1fr); margin-bottom: 12px; }
.ft-metric, .ft-metrics.mini > div {
  background: var(--paper, #16231f);
  border: 1px solid var(--paper-line);
  border-radius: 12px;
  padding: 12px;
}
.ft-metric span, .ft-metrics.mini span { display: block; font-size: 11px; color: var(--ink-dim); margin-bottom: 6px; }
.ft-metric b, .ft-metrics.mini b { font-size: 16px; font-variant-numeric: tabular-nums; }
.ft-metric b.up, .up { color: var(--brass, #c9a24b); }
.ft-metric b.down, .down { color: var(--clay, #c4735a); }
.ft-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.ft-score { font-size: 40px; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 12px; }
.ft-score.sm { font-size: 32px; }
.ft-score small { font-size: 16px; color: var(--ink-dim); font-weight: 600; }
.ft-bar-row { margin-bottom: 10px; }
.ft-bar-label { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; color: var(--ink-dim); }
.ft-bar {
  height: 8px; background: var(--paper); border-radius: 999px; overflow: hidden;
}
.ft-bar > span {
  display: block; height: 100%; background: var(--brass, #c9a24b); border-radius: 999px;
}
.ft-insights { display: flex; flex-direction: column; gap: 8px; }
.ft-insight {
  padding: 10px 12px; border-radius: 10px; border: 1px solid var(--paper-line);
  background: var(--paper);
}
.ft-insight.warn { border-color: rgba(201,162,75,0.4); }
.ft-insight.ok { border-color: rgba(127,175,159,0.4); }
.ft-insight-title { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
.ft-form-row, .ft-form-col { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.ft-form-col { flex-direction: column; }
.ft-input {
  flex: 1 1 120px; padding: 9px 11px; border-radius: 8px;
  border: 1px solid var(--paper-line); background: var(--paper); color: var(--ink); font-size: 13px;
}
.ft-input.sm { flex: 0 0 auto; width: auto; }
.ft-btn {
  background: var(--brass); color: var(--btn-primary-text, #1b160a);
  border: none; border-radius: 10px; padding: 10px 14px; font-weight: 700; font-size: 13px; cursor: pointer;
}
.ft-btn.ghost {
  background: transparent; border: 1px solid var(--paper-line); color: var(--ink);
}
.ft-linkish {
  background: none; border: none; color: var(--brass); font-size: 12px; font-weight: 600; cursor: pointer;
}
.ft-goals { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.ft-goal-top { display: flex; justify-content: space-between; margin-bottom: 6px; }
.ft-goal-amt { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
.ft-goal-actions { margin-top: 10px; }
.ft-row {
  display: flex; justify-content: space-between; gap: 10px; align-items: flex-start;
  padding: 10px 0; border-top: 1px solid var(--paper-line); font-size: 13px;
}
.ft-row-actions { display: flex; gap: 8px; }
.ft-tag {
  display: inline-block; margin-top: 4px; font-size: 11px; font-weight: 700;
  padding: 2px 8px; border-radius: 999px;
}
.ft-tag.ok { background: rgba(127,175,159,0.2); color: var(--sage, #7faf9f); }
.ft-tag.warn { background: var(--brass-soft); color: var(--brass); }
.ft-tag.bad { background: var(--clay-soft); color: var(--clay); }
.ft-tag.neutral { background: var(--paper); color: var(--ink-dim); }
.ft-list { margin: 8px 0 0; padding-left: 18px; font-size: 13px; }
.ft-metric-inline { margin-bottom: 10px; font-size: 13px; }
.ft-sim-out { margin-top: 10px; font-size: 14px; line-height: 1.6; }
.ft-toast, .ft-err {
  padding: 10px 12px; border-radius: 10px; font-size: 13px; margin-bottom: 12px;
}
.ft-toast { background: var(--brass-soft); color: var(--brass); }
.ft-err { background: var(--clay-soft); color: var(--clay); }
.ft-lock { text-align: center; padding: 28px 20px; }
.ft-lock-badge {
  display: inline-block; margin-bottom: 12px; padding: 4px 10px; border-radius: 999px;
  background: var(--brass-soft); color: var(--brass); font-weight: 700; font-size: 12px;
}
.ft-lock a.ft-btn { display: inline-block; text-decoration: none; margin-top: 12px; }
.ft-modal-bg {
  position: fixed; inset: 0; background: rgba(8,12,10,0.55);
  display: flex; align-items: center; justify-content: center; z-index: 80; padding: 16px;
}
.ft-modal {
  background: var(--paper-raised); border: 1px solid var(--paper-line);
  border-radius: 14px; padding: 20px; max-width: 420px; width: 100%;
}
@media (max-width: 800px) {
  .ft-grid-2 { grid-template-columns: 1fr; }
  .ft-metrics.mini { grid-template-columns: 1fr 1fr; }
}
`
