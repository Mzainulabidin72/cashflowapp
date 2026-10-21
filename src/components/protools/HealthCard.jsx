import { HeartPulse } from 'lucide-react'
import { Card, txt } from './ui'

function Gauge({ score }) {
  const r = 56
  const c = 2 * Math.PI * r
  const has = score != null
  const tone = !has ? '' : score >= 70 ? ' is-pos' : score < 40 ? ' is-neg' : ''
  return (
    <div className="pt-gauge" role="img" aria-label={has ? `Skor kesehatan keuangan ${score} dari 100` : 'Skor belum dapat dihitung'}>
      <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
        <circle className="pt-gauge-track" cx="66" cy="66" r={r} fill="none" strokeWidth="11" />
        {has && (
          <circle className={'pt-gauge-fill' + tone} cx="66" cy="66" r={r} fill="none" strokeWidth="11" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 66 66)" />
        )}
      </svg>
      <div className="pt-gauge-text">
        <span className="pt-gauge-score">{has ? score : '—'}</span>
        <span className="pt-gauge-of">{has ? 'dari 100' : 'belum ada'}</span>
      </div>
    </div>
  )
}

export default function HealthCard({ health, advice, periodsUsed }) {
  const adviceFor = (id) => advice.find((a) => a.id === id)
  return (
    <Card id="pt-health" title="Kesehatan keuangan" icon={HeartPulse}
      desc="Indikator perkiraan dari data yang kamu catat, bukan penilaian keuangan resmi.">
      <div className="pt-health-top">
        <Gauge score={health.score} />
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{health.label}</div>
          {health.score != null ? (
            <p className="pt-small pt-muted" style={{ margin: '4px 0 0' }}>
              Rata-rata {health.availableCount} komponen di bawah dengan bobot sama{periodsUsed ? `, memakai data ${periodsUsed}` : ''}.
            </p>
          ) : (
            <p className="pt-small pt-muted" style={{ margin: '4px 0 0' }}>
              Skor muncul setelah minimal 3 dari 4 komponen punya data. Saat ini {health.availableCount} tersedia.
              Catat transaksi selama minimal satu periode penuh (sebulan) agar skor bisa dihitung.
            </p>
          )}
        </div>
      </div>

      {health.components.map((c) => {
        const tone = !c.available ? '' : c.value >= 70 ? ' is-pos' : c.value < 40 ? ' is-neg' : ''
        const adv = adviceFor(c.id)
        return (
          <div className="pt-comp" key={c.id}>
            <div className="pt-comp-head">
              <strong>{c.label}</strong>
              <span className={c.available ? '' : 'pt-muted'}>
                {c.available ? `${c.display} · ${Math.round(c.value)}/100` : 'Belum tersedia'}
              </span>
            </div>
            {c.available && (
              <div className={'pt-bar' + tone} role="progressbar" aria-label={`${c.label}: ${Math.round(c.value)} dari 100`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(c.value)}>
                <span style={{ width: `${c.value}%` }} />
              </div>
            )}
            <div className="pt-hint" style={{ marginTop: 8 }}>{c.detail}</div>
            {adv && <p className="pt-advice">{txt(adv.text)}</p>}
          </div>
        )
      })}
    </Card>
  )
}
