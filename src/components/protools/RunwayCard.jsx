import { Hourglass, Info } from 'lucide-react'
import { Card, Notice, money } from './ui'
import { runwayLabel } from '../../lib/proToolsCalc'

export default function RunwayCard({ runway, wallets, balances }) {
  const liquid = balances.filter((b) => b.type !== 'investment')
  const excluded = balances.filter((b) => b.type === 'investment')
  const nameOf = (id) => wallets.find((w) => w.id === id)?.name || 'Dompet'
  const ok = runway.status === 'ok'
  const pct = ok ? Math.min(100, (runway.months / 6) * 100) : 0
  return (
    <Card id="pt-runway" title="Cash runway" icon={Hourglass} desc="Berapa lama dana likuidmu cukup bila pengeluaran bulanan sama seperti rata-rata.">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
          {ok ? runwayLabel(runway.months) : runway.status === 'empty' ? '0 bulan' : 'Belum dapat dihitung'}
        </div>
        {runway.status === 'unavailable' && <p className="pt-small pt-muted" style={{ margin: '4px 0 0' }}>{runway.reason}</p>}
        {runway.status === 'empty' && <p className="pt-small pt-muted" style={{ margin: '4px 0 0' }}>Dana likuid tercatat 0 atau negatif.</p>}
      </div>
      {ok && (
        <div style={{ marginBottom: 16 }}>
          <div className={'pt-bar' + (runway.months >= 3 ? ' is-pos' : runway.months < 1 ? ' is-neg' : '')} role="progressbar" aria-label="Runway dibanding 6 bulan" aria-valuemin={0} aria-valuemax={6} aria-valuenow={Math.min(6, Number(runway.months.toFixed(1)))}><span style={{ width: `${pct}%` }} /></div>
          <div className="pt-hint" style={{ marginTop: 4 }}>Skala 0–6 bulan. Patokan umum dana darurat: 3 bulan.</div>
        </div>
      )}
      <dl className="pt-kv" style={{ fontSize: 14 }}>
        <dt>Dana likuid</dt><dd>{money(runway.liquid ?? liquid.reduce((s, b) => s + b.balance, 0))}</dd>
        <dt>Rata-rata pengeluaran / bulan</dt><dd>{runway.avgExpense ? money(runway.avgExpense) : '—'}</dd>
      </dl>
      <div style={{ marginTop: 12 }}>
        <Notice tone="neutral" icon={Info}>
          <div><strong>Dihitung:</strong> dana likuid ÷ rata-rata pengeluaran {runway.n ? `${runway.n} periode selesai terakhir` : 'periode selesai terakhir'}.</div>
          <div style={{ marginTop: 4 }}><strong>Dompet yang dihitung:</strong> {liquid.length ? liquid.map((b) => nameOf(b.id)).join(', ') : 'belum ada'}.{excluded.length ? ` Tidak dihitung (investasi): ${excluded.map((b) => nameOf(b.id)).join(', ')}.` : ''}</div>
        </Notice>
      </div>
    </Card>
  )
}
