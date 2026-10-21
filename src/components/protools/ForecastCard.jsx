import { TrendingUp, Info } from 'lucide-react'
import { Card, EmptyState, Notice, Tag, money } from './ui'
import { ForecastChart } from './Charts'
import { periodLabel } from '../../lib/proToolsCalc'

const signed = (n) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${money(Math.abs(n))}`

export default function ForecastCard({ h, fc, startDay }) {
  if (fc.status === 'none') {
    return (
      <Card id="pt-forecast" title="Prakiraan arus kas" icon={TrendingUp} desc="Estimasi 3 bulan ke depan dari rata-rata riwayatmu.">
        <EmptyState icon={TrendingUp} title="Belum ada riwayat untuk diprakirakan"
          text="Prakiraan butuh transaksi dari minimal satu periode (bulan) yang sudah selesai. Periode berjalan belum dihitung karena belum lengkap." />
      </Card>
    )
  }
  const b = fc.baseline
  const est = fc.months
  const actual = h.periods
  const range = b.n > 1 && b.minNet !== b.maxNet
  return (
    <Card id="pt-forecast" title="Prakiraan arus kas" icon={TrendingUp} desc="Estimasi 3 bulan ke depan. Semua angka masa depan adalah perkiraan, bukan jaminan.">
      {fc.status === 'limited' && (
        <Notice icon={Info}>Baru {b.n} periode selesai yang jadi dasar estimasi, jadi hasilnya kurang stabil. Makin lama kamu mencatat, makin masuk akal angkanya.</Notice>
      )}
      {fc.missing?.length > 0 && (
        <Notice tone="neutral" icon={Info}>Periode tanpa catatan dilewati dari rata-rata: {fc.missing.map((k) => periodLabel(k, startDay)).join(', ')}.</Notice>
      )}

      <dl className="pt-kv" style={{ marginBottom: 16, fontSize: 14 }}>
        <dt>Rata-rata pemasukan / bulan</dt><dd>{money(b.avgIncome)}</dd>
        <dt>Rata-rata pengeluaran / bulan</dt><dd>{money(b.avgExpense)}</dd>
        <dt>Estimasi arus kas bersih / bulan</dt><dd className={b.avgNet < 0 ? 'pt-neg' : b.avgNet > 0 ? 'pt-pos' : ''}><strong>{signed(b.avgNet)}</strong></dd>
        {range && <><dt>Kisaran historis arus kas bersih</dt><dd>{signed(b.minNet)} s/d {signed(b.maxNet)}</dd></>}
      </dl>

      <ForecastChart actual={actual} estimate={est}
        ariaLabel={`Grafik pemasukan dan pengeluaran: ${actual.length} periode aktual dan ${est.length} periode estimasi. Angka lengkap ada di tabel di bawah.`} />
      <ul className="pt-legend" aria-label="Keterangan grafik">
        <li><span className="pt-swatch" style={{ background: 'var(--sage)' }} /> Pemasukan</li>
        <li><span className="pt-swatch" style={{ background: 'var(--clay)' }} /> Pengeluaran</li>
        <li><span className="pt-swatch" style={{ border: '1.5px dashed var(--ink-dim)', opacity: 0.7 }} /> Estimasi (bar tembus pandang)</li>
      </ul>

      <div className="pt-table-wrap" style={{ marginTop: 16 }}>
        <table className="pt-table">
          <caption className="sr-only">Riwayat aktual dan estimasi per periode</caption>
          <thead>
            <tr><th scope="col">Periode</th><th scope="col">Pemasukan</th><th scope="col">Pengeluaran</th><th scope="col">Arus kas bersih</th></tr>
          </thead>
          <tbody>
            {actual.map((p) => (
              <tr key={p.key}>
                <td>{p.label} <Tag tone="neutral">Aktual</Tag></td>
                <td>{money(p.income)}</td><td>{money(p.expense)}</td>
                <td className={p.net < 0 ? 'pt-neg' : ''}>{signed(p.net)}</td>
              </tr>
            ))}
            {est.map((m) => (
              <tr key={m.key} className="is-est">
                <td>{m.label} <Tag tone="warn">Estimasi</Tag></td>
                <td>{money(m.income)}</td><td>{money(m.expense)}</td>
                <td className={m.net < 0 ? 'pt-neg' : ''}>{signed(m.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {est.some((m) => m.dueDebt > 0 || m.dueReceivable > 0) && (
        <>
          <h3 style={{ fontSize: 13.5, margin: '16px 0 4px' }}>Kewajiban yang sudah diketahui (di luar estimasi)</h3>
          <ul className="pt-list">
            {est.filter((m) => m.dueDebt > 0 || m.dueReceivable > 0).map((m) => (
              <li className="pt-row" key={m.key} style={{ padding: '8px 0' }}>
                <div className="pt-row-main">{m.label}</div>
                <div className="pt-small pt-num">
                  {m.dueDebt > 0 && <div className="pt-neg">Utang jatuh tempo −{money(m.dueDebt)}</div>}
                  {m.dueReceivable > 0 && <div className="pt-pos">Piutang jatuh tempo +{money(m.dueReceivable)}</div>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>Asumsi dan cara menghitung</summary>
        <ul className="pt-small pt-muted" style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Metode: rata-rata {b.n} periode yang sudah selesai ({fc.periodsUsed.join(', ')}). Periode berjalan tidak ikut karena belum lengkap.</li>
          <li>Setiap bulan prakiraan memakai rata-rata yang sama. Ini asumsi sederhana, bukan prediksi tren.</li>
          <li>Pemasukan tidak teratur, pengeluaran besar sekali waktu, dan kewajiban baru tidak diperkirakan. Utang dan piutang yang jatuh tempo ditampilkan terpisah.</li>
          <li>Kisaran historis adalah arus kas bersih terendah dan tertinggi pada periode yang dipakai.</li>
        </ul>
      </details>
    </Card>
  )
}
