import { useMemo, useState } from 'react'
import { FlaskConical, RotateCcw, Wand2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, EmptyState, Field, NumInput, Notice, money } from './ui'
import { LineChart } from './Charts'
import { validateSim, simulate, SIM_DURATIONS, runwayLabel } from '../../lib/proToolsCalc'

const EMPTY = { income: '', expense: '', savings: '', extra: '', months: '6' }
const signed = (n) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${money(Math.abs(n))}`

/**
 * Simulasi hipotetis. State-nya lokal: tidak ditulis ke transaksi, dompet, utang, maupun
 * penyimpanan mana pun, dan hilang saat halaman ditutup.
 */
export default function SimulationCard({ startCash, base }) {
  const [f, setF] = useState(EMPTY)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const dirty = f.income !== '' || f.expense !== '' || f.savings !== '' || f.extra !== ''
  const v = useMemo(() => validateSim(f), [f])
  const res = useMemo(() => (v.ok && f.income !== '' && f.expense !== '' ? simulate({ startCash, ...v.value }, base) : null), [v, f.income, f.expense, startCash, base])
  // "wajib diisi" hanya muncul setelah pengguna mulai mengisi; salah format langsung ditandai
  const err = (k) => (v.errors[k] && (f[k] !== '' || dirty) ? v.errors[k] : undefined)
  const months = v.value.months

  return (
    <Card id="pt-sim" title="Simulasi keuangan" icon={FlaskConical}
      desc="Coba skenario “bagaimana jika”. Hasilnya hanya perhitungan; transaksi, dompet, dan utangmu tidak berubah.">
      <div className="pt-form-grid">
        <Field label="Pemasukan per bulan" error={err('income')}><NumInput value={f.income} onChange={set('income')} placeholder="0" /></Field>
        <Field label="Pengeluaran per bulan" error={err('expense')}><NumInput value={f.expense} onChange={set('expense')} placeholder="0" /></Field>
        <Field label="Tabungan per bulan" error={err('savings')} hint="Opsional. Disisihkan dari sisa uang."><NumInput value={f.savings} onChange={set('savings')} placeholder="0" /></Field>
        <Field label="Pengeluaran sekali (opsional)" error={err('extra')} hint="Dipotong sekali di bulan pertama."><NumInput value={f.extra} onChange={set('extra')} placeholder="0" /></Field>
        <Field label="Durasi">
          <select className="pt-select" value={f.months} onChange={set('months')}>
            {SIM_DURATIONS.map((m) => <option key={m} value={m}>{m} bulan</option>)}
          </select>
        </Field>
        <div className="pt-field" style={{ justifyContent: 'flex-end' }}>
          <div className="pt-hint">Saldo awal simulasi: <strong>{money(startCash)}</strong> (dana likuid dompet)</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
        <button type="button" className="pt-btn" disabled={!base || base.n === 0} onClick={() => setF((s) => ({ ...s, income: String(Math.round(base.avgIncome)), expense: String(Math.round(base.avgExpense)) }))}
          title={base?.n ? 'Isi pemasukan dan pengeluaran dengan rata-rata riwayatmu' : 'Belum ada riwayat'}>
          <Wand2 size={15} aria-hidden="true" /> Pakai rata-rata riwayat
        </button>
        <button type="button" className="pt-btn" onClick={() => setF(EMPTY)} disabled={!dirty && f.months === EMPTY.months}>
          <RotateCcw size={15} aria-hidden="true" /> Reset simulasi
        </button>
      </div>

      {!res ? (
        <EmptyState icon={FlaskConical} title="Isi pemasukan dan pengeluaran" text="Hasil simulasi muncul otomatis begitu kedua angka itu terisi dengan benar." />
      ) : (
        <div aria-live="polite">
          <Notice tone="neutral" icon={FlaskConical}><strong>Hasil simulasi</strong> selama {months} bulan: angka hipotetis, bukan data sebenarnya.</Notice>
          <dl className="pt-kv" style={{ fontSize: 14, marginBottom: 12 }}>
            <dt>Arus kas bersih per bulan (sebelum tabungan)</dt><dd className={res.netBeforeSavings < 0 ? 'pt-neg' : 'pt-pos'}><strong>{signed(res.netBeforeSavings)}</strong></dd>
            <dt>Sisa per bulan setelah menabung</dt><dd className={res.afterSavings < 0 ? 'pt-neg' : ''}>{signed(res.afterSavings)}</dd>
            <dt>Total tabungan terencana</dt><dd>{money(res.totalSaved)}</dd>
            <dt>Estimasi kas akhir</dt><dd className={res.endingCash < 0 ? 'pt-neg' : ''}><strong>{signed(res.endingCash)}</strong></dd>
            <dt>Selisih dari baseline (kas + tabungan)</dt>
            <dd>{res.diff == null ? <span className="pt-muted">Belum ada riwayat</span> : (
              <span className={res.diff < 0 ? 'pt-neg' : res.diff > 0 ? 'pt-pos' : ''}>
                {res.diff > 0 ? <TrendingUp size={13} aria-hidden="true" /> : res.diff < 0 ? <TrendingDown size={13} aria-hidden="true" /> : <Minus size={13} aria-hidden="true" />} {signed(res.diff)}
              </span>)}</dd>
          </dl>
          {res.afterSavings < 0 && (
            <Notice tone="danger">Tabungan dan pengeluaran melebihi pemasukan: kas berkurang {money(-res.afterSavings)} per bulan{res.runsOut != null ? ` dan diperkirakan habis dalam ${runwayLabel(res.runsOut)}` : ''}.</Notice>
          )}
          <LineChart xMax={months} xFormat={(x) => `${x} bln`}
            ariaLabel={`Grafik simulasi total kas dan tabungan selama ${months} bulan: dari ${money(res.series[0].total)} menjadi ${money(res.endingTotal)}${res.baselineEnding != null ? `, dibanding baseline ${money(res.baselineEnding)}` : ''}`}
            series={[
              { key: 'sim', label: 'Simulasi', cls: 'pt-line-a', points: res.series.map((s) => ({ x: s.m, y: s.total })) },
              ...(res.baseSeries ? [{ key: 'base', label: 'Baseline', cls: 'pt-line-b', points: res.baseSeries.map((s) => ({ x: s.m, y: s.total })) }] : []),
            ]} />
          <ul className="pt-legend" aria-label="Keterangan grafik">
            <li><span className="pt-swatch" style={{ background: 'var(--brass)' }} /> Simulasi (kas + tabungan)</li>
            {res.baseSeries && <li><span className="pt-swatch" style={{ border: '1.5px dashed var(--ink-dim)' }} /> Baseline: rata-rata riwayatmu, tanpa tabungan atau pengeluaran sekali</li>}
          </ul>
        </div>
      )}
    </Card>
  )
}
