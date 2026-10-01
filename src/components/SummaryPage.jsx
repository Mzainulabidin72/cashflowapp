import { useMemo, useRef, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from 'recharts'
import { Lock, Download, Image as ImageIcon, TrendingUp, TrendingDown } from 'lucide-react'

/* Helpers — sesuaikan jika App sudah punya global rupiah/todayISO */
function rupiah(n) {
  return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID')
}
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function MONTH_LABEL(key) {
  const [y, m] = String(key).split('-')
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const mi = Number(m) - 1
  return `${names[mi] || m} ${String(y).slice(2)}`
}
function pctChange(curr, prev) {
  if (prev === 0) return curr === 0 ? 0 : 100
  return ((curr - prev) / Math.abs(prev)) * 100
}

function ProLock({ title, desc, onUpgrade }) {
  return (
    <div
      className="bk-card"
      style={{
        padding: 20,
        textAlign: 'center',
        borderStyle: 'dashed',
        opacity: 0.95,
      }}
    >
      <Lock size={20} style={{ color: 'var(--brass)', marginBottom: 8 }} />
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <p style={{ fontSize: 13, color: 'var(--ink-dim)', margin: '0 0 12px', lineHeight: 1.45 }}>
        {desc}
      </p>
      {onUpgrade && (
        <button type="button" className="bk-btn" onClick={onUpgrade}>
          Upgrade ke Pro
        </button>
      )}
    </div>
  )
}

/**
 * Ringkasan Keuangan — Basic vs Pro
 * Props:
 * - transactions, categories
 * - canExport (Basic+)
 * - canUseFullAnalytics (Pro) — dari planInfo.canUseFullAnalytics
 * - onExportBlocked, onUpgradePro
 * - exportSummaryCsv, exportElementAsPng (opsional inject)
 */
export default function SummaryPage({
  transactions = [],
  categories,
  canExport = false,
  canUseFullAnalytics = false,
  onExportBlocked,
  onUpgradePro,
  exportSummaryCsv,
  exportElementAsPng,
}) {
  const captureRef = useRef(null)
  const [exportingImg, setExportingImg] = useState(false)
  const [period, setPeriod] = useState(canUseFullAnalytics ? '6m' : '3m')
  // period: 3m | 6m | 12m

  const isPro = !!canUseFullAnalytics
  const maxMonths = isPro ? (period === '12m' ? 12 : period === '6m' ? 6 : 3) : 3
  const topCatLimit = isPro ? 8 : 3

  const byMonth = useMemo(() => {
    const map = {}
    transactions.forEach((t) => {
      const key = String(t.date || '').slice(0, 7)
      if (!key || key.length < 7) return
      if (!map[key]) map[key] = { key, income: 0, expense: 0, count: 0 }
      if (t.type === 'income') map[key].income += Number(t.amount) || 0
      else if (t.type === 'expense') map[key].expense += Number(t.amount) || 0
      map[key].count += 1
    })
    return Object.values(map).sort((a, b) => b.key.localeCompare(a.key))
  }, [transactions])

  const trend = useMemo(() => {
    return byMonth
      .slice(0, maxMonths)
      .reverse()
      .map((m) => ({
        ...m,
        label: MONTH_LABEL(m.key),
        net: m.income - m.expense,
      }))
  }, [byMonth, maxMonths])

  const currentMonthKey = todayISO().slice(0, 7)
  const prevMonthKey = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const cur = byMonth.find((m) => m.key === currentMonthKey) || {
    income: 0,
    expense: 0,
    count: 0,
  }
  const prev = byMonth.find((m) => m.key === prevMonthKey) || {
    income: 0,
    expense: 0,
    count: 0,
  }

  const totalIncomeAll = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount || 0), 0)
  const totalExpenseAll = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount || 0), 0)
  const netAll = totalIncomeAll - totalExpenseAll
  const expenseCount = transactions.filter((t) => t.type === 'expense').length
  const avgExpense = expenseCount ? totalExpenseAll / expenseCount : 0

  // Month metrics
  const monthIncome = cur.income
  const monthExpense = cur.expense
  const monthNet = monthIncome - monthExpense
  const savingsRate =
    monthIncome > 0
      ? Math.min(100, Math.max(0, (monthNet / monthIncome) * 100))
      : 0
  const expenseRatio =
    monthIncome > 0
      ? Math.min(100, (monthExpense / monthIncome) * 100)
      : monthExpense > 0
        ? 100
        : 0

  // Health score (transparent)
  const health = useMemo(() => {
    const sr = savingsRate
    const er = 100 - Math.min(100, expenseRatio)
    const trendNet =
      byMonth.slice(0, 3).filter((m) => m.income - m.expense >= 0).length *
      (100 / Math.min(3, Math.max(1, byMonth.slice(0, 3).length)))
    const score = Math.round(sr * 0.4 + er * 0.3 + trendNet * 0.3)
    return {
      score: Number.isFinite(score) ? score : 0,
      savingsRate: Math.round(sr),
      expenseRatio: Math.round(expenseRatio),
    }
  }, [savingsRate, expenseRatio, byMonth])

  // Spending by category (current month)
  const spendCats = useMemo(() => {
    const map = {}
    transactions
      .filter(
        (t) =>
          t.type === 'expense' && String(t.date || '').startsWith(currentMonthKey)
      )
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + Number(t.amount || 0)
      })
    const prevMap = {}
    transactions
      .filter(
        (t) =>
          t.type === 'expense' && String(t.date || '').startsWith(prevMonthKey)
      )
      .forEach((t) => {
        prevMap[t.category] = (prevMap[t.category] || 0) + Number(t.amount || 0)
      })
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topCatLimit)
      .map(([name, val]) => ({
        name,
        val,
        pct: Math.round((val / total) * 100),
        change: pctChange(val, prevMap[name] || 0),
      }))
  }, [transactions, currentMonthKey, prevMonthKey, topCatLimit])

  // Forecast from avg last months
  const forecast = useMemo(() => {
    const last = byMonth.slice(0, 6)
    if (last.length < 2) return null
    const avgIn = last.reduce((s, m) => s + m.income, 0) / last.length
    const avgOut = last.reduce((s, m) => s + m.expense, 0) / last.length
    const months = []
    const [y, m] = (last[0]?.key || currentMonthKey).split('-').map(Number)
    for (let i = 1; i <= 3; i++) {
      const d = new Date(y, m - 1 + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months.push({
        label: MONTH_LABEL(key),
        income: Math.round(avgIn),
        expense: Math.round(avgOut),
        net: Math.round(avgIn - avgOut),
      })
    }
    return { months, avgIn: Math.round(avgIn), avgOut: Math.round(avgOut) }
  }, [byMonth, currentMonthKey])

  // Insights
  const insights = useMemo(() => {
    const list = []
    if (spendCats[0]) {
      list.push({
        title: 'Pengeluaran terbesar',
        body: `${spendCats[0].name} · ${rupiah(spendCats[0].val)} (${spendCats[0].pct}%) bulan ini.`,
      })
    }
    const incCh = pctChange(monthIncome, prev.income)
    const expCh = pctChange(monthExpense, prev.expense)
    if (prev.income || prev.expense) {
      list.push({
        title: 'Vs bulan lalu',
        body: `Pemasukan ${incCh >= 0 ? '+' : ''}${incCh.toFixed(1)}% · Pengeluaran ${expCh >= 0 ? '+' : ''}${expCh.toFixed(1)}%.`,
      })
    }
    if (monthIncome > 0) {
      list.push({
        title: 'Savings rate',
        body: `${Math.round(savingsRate)}% dari pemasukan bulan ini tersisa sebagai neto.`,
      })
    }
    if (!list.length) {
      list.push({
        title: 'Belum cukup data',
        body: 'Catat transaksi untuk insight yang lebih akurat.',
      })
    }
    return list.slice(0, isPro ? 5 : 2)
  }, [spendCats, monthIncome, monthExpense, prev, savingsRate, isPro])

  // Savings analysis
  const savingsMonths = byMonth
    .slice(0, 12)
    .map((m) => ({ ...m, save: m.income - m.expense }))
  const bestSave = savingsMonths.reduce(
    (b, m) => (!b || m.save > b.save ? m : b),
    null
  )
  const avgSave = savingsMonths.length
    ? savingsMonths.reduce((s, m) => s + m.save, 0) / savingsMonths.length
    : 0

  function handleExportCsv() {
    if (!canExport) {
      onExportBlocked?.()
      return
    }
    if (typeof exportSummaryCsv === 'function') {
      exportSummaryCsv(transactions)
      return
    }
    // fallback minimal CSV
    const rows = [['date', 'type', 'category', 'amount', 'description']]
    transactions.forEach((t) => {
      rows.push([t.date, t.type, t.category, t.amount, t.description || ''])
    })
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], {
      type: 'text/csv',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bukukas-ringkasan-${todayISO()}.csv`
    a.click()
  }

  async function handleExportImage() {
    if (!isPro) {
      onUpgradePro?.()
      return
    }
    if (!canExport) {
      onExportBlocked?.()
      return
    }
    try {
      setExportingImg(true)
      if (typeof exportElementAsPng === 'function') {
        await exportElementAsPng(
          captureRef.current,
          `bukukas-ringkasan-${todayISO()}.png`
        )
      } else {
        window.print()
      }
    } finally {
      setExportingImg(false)
    }
  }

  const Delta = ({ value }) => {
    const up = value >= 0
    const Icon = up ? TrendingUp : TrendingDown
    return (
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: up ? 'var(--brass)' : 'var(--clay)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Icon size={14} />
        {up ? '+' : ''}
        {value.toFixed(1)}%
      </span>
    )
  }

  return (
    <div ref={captureRef}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div>
          <h2 className="bk-serif" style={{ margin: 0, fontSize: 22 }}>
            Ringkasan Keuangan
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-dim)' }}>
            {isPro
              ? 'Analisis lengkap Pro · data dari transaksi kamu'
              : 'Ringkasan Basic · upgrade Pro untuk prediksi & health score'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isPro && (
            <select
              className="bk-input"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{ minWidth: 120 }}
            >
              <option value="3m">3 bulan</option>
              <option value="6m">6 bulan</option>
              <option value="12m">12 bulan</option>
            </select>
          )}
          <button type="button" className="bk-btn bk-btn-ghost" onClick={handleExportCsv}>
            <Download size={14} /> CSV
          </button>
          <button
            type="button"
            className="bk-btn bk-btn-ghost"
            onClick={handleExportImage}
            disabled={exportingImg}
          >
            <ImageIcon size={14} /> {isPro ? (exportingImg ? '...' : 'Gambar') : 'Gambar 🔒'}
          </button>
        </div>
      </div>

      {/* Insight banner */}
      <div
        className="bk-card"
        style={{
          padding: 14,
          marginBottom: 14,
          borderLeft: '3px solid var(--brass)',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brass)', marginBottom: 4 }}>
          Insight
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.45 }}>
          {insights[0]?.body || '—'}
        </div>
      </div>

      {/* Core metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          ['Total pemasukan', totalIncomeAll, null],
          ['Total pengeluaran', totalExpenseAll, null],
          ['Selisih / neto', netAll, netAll >= 0],
          ['Rata-rata trx keluar', avgExpense, null],
        ].map(([label, val, pos]) => (
          <div key={label} className="bk-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginBottom: 6 }}>
              {label}
            </div>
            <div
              className="bk-mono"
              style={{
                fontSize: 18,
                fontWeight: 700,
                color:
                  pos === true
                    ? 'var(--brass)'
                    : pos === false
                      ? 'var(--clay)'
                      : 'inherit',
              }}
            >
              {rupiah(val)}
            </div>
          </div>
        ))}
      </div>

      {/* MoM — Pro detail, Basic simple */}
      <div className="bk-card" style={{ padding: 16, marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Bulan ini vs bulan lalu</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>Pemasukan</div>
            <div className="bk-mono" style={{ fontWeight: 700 }}>
              {rupiah(monthIncome)}
            </div>
            <Delta value={pctChange(monthIncome, prev.income)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>Pengeluaran</div>
            <div className="bk-mono" style={{ fontWeight: 700 }}>
              {rupiah(monthExpense)}
            </div>
            <Delta value={pctChange(monthExpense, prev.expense)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>Net cash flow</div>
            <div
              className="bk-mono"
              style={{
                fontWeight: 700,
                color: monthNet >= 0 ? 'var(--brass)' : 'var(--clay)',
              }}
            >
              {rupiah(monthNet)}
            </div>
            <Delta value={pctChange(monthNet, prev.income - prev.expense)} />
          </div>
        </div>
      </div>

      {/* Health — Pro */}
      {isPro ? (
        <div className="bk-card" style={{ padding: 16, marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Kesehatan keuangan</h3>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em' }}>
            {health.score}
            <span style={{ fontSize: 16, color: 'var(--ink-dim)' }}> / 100</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 10,
              marginTop: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-dim)' }}>Savings rate</div>
              <b>{health.savingsRate}%</b>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-dim)' }}>Expense ratio</div>
              <b>{health.expenseRatio}%</b>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-dim)' }}>Neto bulan ini</div>
              <b>{rupiah(monthNet)}</b>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 12, lineHeight: 1.4 }}>
            Skor ≈ 40% savings rate + 30% (rendahnya expense ratio) + 30% bulan neto
            positif di 3 bulan terakhir. Indikator analitik, bukan penilaian absolut.
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <ProLock
            title="Kesehatan keuangan"
            desc="Skor 0–100, savings rate, dan expense ratio tersedia di Pro."
            onUpgrade={onUpgradePro}
          />
        </div>
      )}

      {/* Trend chart */}
      <div className="bk-card" style={{ padding: 16, marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>
          Tren pemasukan vs pengeluaran ({maxMonths} bulan)
        </h3>
        {trend.length === 0 ? (
          <p style={{ color: 'var(--ink-dim)', fontSize: 13 }}>Belum ada data.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={48} />
              <Tooltip
                formatter={(v) => rupiah(v)}
                contentStyle={{
                  background: 'var(--paper-raised)',
                  border: '1px solid var(--paper-line)',
                  borderRadius: 8,
                }}
              />
              <Legend />
              <Bar dataKey="income" name="Pemasukan" fill="var(--brass)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Pengeluaran" fill="var(--clay)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {!isPro && (
          <p style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 8 }}>
            🔒 Tren 6–12 bulan tersedia di Pro.
          </p>
        )}
      </div>

      {/* Spending */}
      <div className="bk-card" style={{ padding: 16, marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>
          Pengeluaran per kategori (bulan ini)
        </h3>
        {spendCats.length === 0 && (
          <p style={{ color: 'var(--ink-dim)', fontSize: 13 }}>Belum ada pengeluaran.</p>
        )}
        {spendCats.map((c) => (
          <div key={c.name} style={{ marginBottom: 12 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              <span>
                <b>{c.name}</b> · {c.pct}%
                {isPro && (
                  <span style={{ marginLeft: 8, color: 'var(--ink-dim)', fontSize: 12 }}>
                    {c.change >= 0 ? '+' : ''}
                    {c.change.toFixed(0)}% vs bln lalu
                  </span>
                )}
              </span>
              <span className="bk-mono">{rupiah(c.val)}</span>
            </div>
            <div
              style={{
                height: 8,
                background: 'var(--paper)',
                borderRadius: 99,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${c.pct}%`,
                  height: '100%',
                  background: 'var(--clay)',
                  borderRadius: 99,
                }}
              />
            </div>
          </div>
        ))}
        {!isPro && (
          <p style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
            Basic: top 3 kategori · Pro: lebih banyak + perbandingan bulan lalu.
          </p>
        )}
      </div>

      {/* Insights list Pro */}
      {isPro && (
        <div className="bk-card" style={{ padding: 16, marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Insight & rekomendasi</h3>
          {insights.map((ins, i) => (
            <div
              key={i}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: 'var(--paper)',
                border: '1px solid var(--paper-line)',
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13 }}>{ins.title}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>{ins.body}</div>
            </div>
          ))}
        </div>
      )}

      {/* Savings Pro */}
      {isPro ? (
        <div className="bk-card" style={{ padding: 16, marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Analisis tabungan</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-dim)' }}>Savings rate</div>
              <b>{Math.round(savingsRate)}%</b>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-dim)' }}>Rata-rata neto / bln</div>
              <b className="bk-mono">{rupiah(avgSave)}</b>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-dim)' }}>Bulan terbaik</div>
              <b>
                {bestSave
                  ? `${MONTH_LABEL(bestSave.key)} · ${rupiah(bestSave.save)}`
                  : '—'}
              </b>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <ProLock
            title="Analisis tabungan"
            desc="Savings rate, rata-rata neto, dan bulan terbaik di Pro."
            onUpgrade={onUpgradePro}
          />
        </div>
      )}

      {/* Forecast Pro */}
      {isPro ? (
        <div className="bk-card" style={{ padding: 16, marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Prediksi cash flow</h3>
          <p style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 0 }}>
            Estimasi berdasarkan rata-rata historis — bukan jaminan.
          </p>
          {!forecast ? (
            <p style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
              Butuh minimal 2 bulan data.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={forecast.months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={48} />
                  <Tooltip formatter={(v) => rupiah(v)} />
                  <Line type="monotone" dataKey="net" name="Net prediksi" stroke="var(--brass)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              <ul style={{ fontSize: 13, margin: '8px 0 0', paddingLeft: 18 }}>
                {forecast.months.map((m) => (
                  <li key={m.label}>
                    {m.label}: neto ~ <b>{rupiah(m.net)}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <ProLock
            title="Prediksi cash flow"
            desc="Proyeksi 3 bulan ke depan berdasarkan pola transaksi."
            onUpgrade={onUpgradePro}
          />
        </div>
      )}

      {/* Budget / Goals / Net worth — Pro placeholders linked to Tools */}
      {isPro ? (
        <div className="bk-card" style={{ padding: 16, marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Budget, goal & net worth</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.45 }}>
            Kelola budget kategori, target keuangan, multi-wallet & utang di{' '}
            <b>Tools Pro</b> agar ringkasan ini bisa menampilkan budget vs aktual dan
            net worth secara otomatis.
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <ProLock
            title="Budget vs aktual · Goal · Net worth"
            desc="Modul perencanaan mendalam tersedia di Pro + Tools Pro."
            onUpgrade={onUpgradePro}
          />
        </div>
      )}

      {/* Monthly table */}
      <div className="bk-card bk-scroll" style={{ padding: 16, overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Ringkasan bulanan</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 480 }}>
          <thead>
            <tr>
              {['Bulan', 'Masuk', 'Keluar', 'Neto', 'Trx'].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: h === 'Bulan' ? 'left' : 'right',
                    padding: '8px 6px',
                    borderBottom: '1px solid var(--paper-line)',
                    color: 'var(--ink-dim)',
                    fontWeight: 600,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(isPro ? byMonth.slice(0, 12) : byMonth.slice(0, 6)).map((m) => (
              <tr key={m.key}>
                <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--paper-line)' }}>
                  {MONTH_LABEL(m.key)}
                </td>
                <td
                  className="bk-mono"
                  style={{
                    padding: '8px 6px',
                    borderBottom: '1px solid var(--paper-line)',
                    textAlign: 'right',
                  }}
                >
                  {rupiah(m.income)}
                </td>
                <td
                  className="bk-mono"
                  style={{
                    padding: '8px 6px',
                    borderBottom: '1px solid var(--paper-line)',
                    textAlign: 'right',
                  }}
                >
                  {rupiah(m.expense)}
                </td>
                <td
                  className="bk-mono"
                  style={{
                    padding: '8px 6px',
                    borderBottom: '1px solid var(--paper-line)',
                    textAlign: 'right',
                    color: m.income - m.expense >= 0 ? 'var(--brass)' : 'var(--clay)',
                  }}
                >
                  {rupiah(m.income - m.expense)}
                </td>
                <td
                  style={{
                    padding: '8px 6px',
                    borderBottom: '1px solid var(--paper-line)',
                    textAlign: 'right',
                  }}
                >
                  {m.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
