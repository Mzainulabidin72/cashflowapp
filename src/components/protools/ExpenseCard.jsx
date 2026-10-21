import { useMemo, useState } from 'react'
import { ChartPie } from 'lucide-react'
import { Card, EmptyState, Delta, Tag, money, pctText } from './ui'
import { expenseAnalysis } from '../../lib/proToolsCalc'
import { formatDate } from '../../lib/prefs'

const PERIODS = [
  { n: 1, label: 'Periode ini' },
  { n: 3, label: '3 periode terakhir' },
  { n: 6, label: '6 periode terakhir' },
  { n: 12, label: '12 periode terakhir' },
]
const TOP = 8

export default function ExpenseCard({ txs, today, startDay }) {
  const [n, setN] = useState(1)
  const a = useMemo(() => expenseAnalysis(txs, today, startDay, n), [txs, today, startDay, n])
  const shown = a.rows.slice(0, TOP)
  const rest = a.rows.slice(TOP)
  const restAmount = rest.reduce((s, r) => s + r.amount, 0)
  return (
    <Card id="pt-expense" title="Analisis pengeluaran" icon={ChartPie}
      desc={`${formatDate(a.from)} s/d ${formatDate(a.to)}${a.hasPrev ? ` · pembanding ${formatDate(a.prevFrom)} s/d ${formatDate(a.prevTo)}` : ''}`}
      actions={
        <select className="pt-select" style={{ minHeight: 40, width: 'auto', maxWidth: 220 }} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Periode analisis">
          {PERIODS.map((p) => <option key={p.n} value={p.n}>{p.label}</option>)}
        </select>
      }>
      {a.total <= 0 ? (
        <EmptyState icon={ChartPie} title="Belum ada pengeluaran" text="Tidak ada pengeluaran tercatat pada periode yang dipilih." />
      ) : (
        <>
          <div className="pt-comp-head" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
            <span><span className="pt-muted">Total pengeluaran</span> <strong className="pt-num">{money(a.total)}</strong></span>
            <Delta invert pct={a.totalChange} suffix=" vs pembanding" />
          </div>
          <ul className="pt-list" aria-label="Pengeluaran per kategori">
            {shown.map((r) => (
              <li className="pt-row" key={r.key} style={{ alignItems: 'flex-start' }}>
                <div className="pt-row-main">
                  <div className="pt-comp-head" style={{ marginBottom: 6 }}>
                    <span className="pt-row-title">{r.name}</span>
                    <span className="pt-num" style={{ fontWeight: 600 }}>{money(r.amount)}</span>
                  </div>
                  <div className="pt-bar" role="progressbar" aria-label={`${r.name}: ${pctText(r.pct, 1)} dari total`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r.pct)}><span style={{ width: `${r.pct}%` }} /></div>
                  <div className="pt-row-meta" style={{ justifyContent: 'space-between' }}>
                    <span>{r.pct < 0.1 ? '< 0,1%' : pctText(r.pct, 1)} dari total · {r.count} transaksi</span>
                    {a.hasPrev && (r.isNew ? <Tag tone="warn">Baru</Tag> : <Delta invert pct={r.change} />)}
                  </div>
                </div>
              </li>
            ))}
            {rest.length > 0 && (
              <li className="pt-row">
                <div className="pt-row-main">
                  <div className="pt-comp-head" style={{ marginBottom: 0 }}>
                    <span className="pt-row-title">{rest.length} kategori lainnya</span>
                    <span className="pt-num" style={{ fontWeight: 600 }}>{money(restAmount)}</span>
                  </div>
                  <div className="pt-hint">{pctText((restAmount / a.total) * 100, 1)} dari total</div>
                </div>
              </li>
            )}
          </ul>
        </>
      )}
    </Card>
  )
}
