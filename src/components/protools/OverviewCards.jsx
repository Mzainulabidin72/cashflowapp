import { Wallet, ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown, Minus, HandCoins, Landmark } from 'lucide-react'
import { money, Delta } from './ui'

function Metric({ icon: Icon, tone, label, value, valueTone, foot, children }) {
  return (
    <div className="pt-metric">
      <div className="pt-metric-top">
        <span className={'pt-metric-icon' + (tone ? ` is-${tone}` : '')}>
          <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span>{label}</span>
      </div>
      <div className={'pt-metric-value' + (valueTone ? ` is-${valueTone}` : '')}>{value}</div>
      {children}
      {foot && <div className="pt-metric-foot">{foot}</div>}
    </div>
  )
}

/**
 * Enam kartu ringkasan. Saldo dompet (dicatat manual) dan arus kas (dari transaksi) sengaja
 * dipisah dan diberi keterangan agar tidak tertukar.
 */
export default function OverviewCards({ ptd, wallets, debtSum, recvSum, periodText }) {
  const net = ptd.cur.net
  const netTone = net > 0 ? 'pos' : net < 0 ? 'neg' : null
  const NetIcon = net > 0 ? TrendingUp : net < 0 ? TrendingDown : Minus
  const netWord = net > 0 ? 'Surplus' : net < 0 ? 'Defisit' : 'Impas'
  const cmp = `vs ${ptd.elapsed} hari pertama periode lalu`
  const dueNote = (s) => {
    const parts = []
    if (s.overdue) parts.push(`${s.overdue} terlambat`)
    if (s.soon) parts.push(`${s.soon} jatuh tempo ≤ 14 hari`)
    return parts.length ? parts.join(' · ') : 'Tidak ada yang mendesak'
  }
  const pct = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)

  return (
    <div className="pt-metrics" role="group" aria-label="Ringkasan keuangan">
      <Metric
        icon={Wallet}
        label="Saldo dompet"
        value={money(wallets.total)}
        foot={
          wallets.count
            ? `${wallets.count} dompet, dicatat manual${wallets.illiquid ? ` · likuid ${money(wallets.liquid)}` : ''}. Tidak berubah otomatis oleh transaksi.`
            : 'Belum ada dompet. Tambahkan di bagian Multi-wallet.'
        }
      />
      <Metric icon={ArrowDownToLine} tone="pos" label="Pemasukan bulan ini" value={money(ptd.cur.income)} foot={periodText}>
        <div>{ptd.hasPrev ? <Delta pct={pct(ptd.cur.income, ptd.prev.income)} suffix={` ${cmp}`} /> : <span className="pt-muted pt-small">Belum ada data periode lalu</span>}</div>
      </Metric>
      <Metric icon={ArrowUpFromLine} tone="neg" label="Pengeluaran bulan ini" value={money(ptd.cur.expense)} foot={periodText}>
        <div>{ptd.hasPrev ? <Delta invert pct={pct(ptd.cur.expense, ptd.prev.expense)} suffix={` ${cmp}`} /> : <span className="pt-muted pt-small">Belum ada data periode lalu</span>}</div>
      </Metric>
      <Metric
        icon={NetIcon}
        tone={netTone}
        label="Arus kas bersih bulan ini"
        value={`${net > 0 ? '+' : net < 0 ? '−' : ''}${money(Math.abs(net))}`}
        valueTone={netTone}
        foot="Pemasukan dikurangi pengeluaran dari transaksi, bukan saldo dompet."
      >
        <div className={'pt-delta ' + (net > 0 ? 'pt-pos' : net < 0 ? 'pt-neg' : 'pt-muted')}>
          <NetIcon size={13} strokeWidth={2.25} aria-hidden="true" /> {netWord}
        </div>
      </Metric>
      <Metric icon={Landmark} tone="neg" label="Total utang" value={money(debtSum.outstanding)} foot={`${debtSum.active} aktif · ${dueNote(debtSum)}`} />
      <Metric icon={HandCoins} tone="pos" label="Total piutang" value={money(recvSum.outstanding)} foot={`${recvSum.active} aktif · ${dueNote(recvSum)}`} />
    </div>
  )
}
