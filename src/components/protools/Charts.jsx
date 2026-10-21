import { periodShort } from '../../lib/proToolsCalc'
import { money } from './ui'

/** 1.250.000 → "1,3 jt", 450.000 → "450 rb", 2,5 miliar → "2,5 M" (label sumbu). */
export function compact(n) {
  const a = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  const f = (v, d = 1) => v.toLocaleString('id-ID', { maximumFractionDigits: d })
  if (a >= 1e9) return `${sign}${f(a / 1e9)} M`
  if (a >= 1e6) return `${sign}${f(a / 1e6)} jt`
  if (a >= 1e3) return `${sign}${f(a / 1e3, Number.isInteger(a / 1e3) ? 0 : 1)} rb`
  return `${sign}${f(a, 0)}`
}

function niceMax(v) {
  if (!(v > 0)) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nf * exp
}

/**
 * Grafik batang pemasukan/pengeluaran: periode aktual (solid) lalu estimasi (tembus-pandang
 * bergaris putus-putus) dipisah garis vertikal. Tabel di sampingnya memuat angka lengkap.
 */
export function ForecastChart({ actual, estimate, ariaLabel }) {
  const all = [...actual.map((p) => ({ ...p, est: false })), ...estimate.map((p) => ({ ...p, est: true }))]
  const W = 640
  const H = 260
  const m = { l: 52, r: 8, t: 12, b: 34 }
  const iw = W - m.l - m.r
  const ih = H - m.t - m.b
  const max = niceMax(Math.max(...all.flatMap((p) => [p.income, p.expense]), 0))
  const y = (v) => m.t + ih - (v / max) * ih
  const slot = iw / all.length
  const bw = Math.min(26, slot * 0.34)
  const years = new Set(all.map((p) => p.key.slice(0, 4)))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const divIdx = actual.length

  return (
    <svg className="pt-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      {ticks.map((t) => (
        <g key={t}>
          <line className="pt-axis" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} strokeOpacity={t === 0 ? 1 : 0.5} />
          <text x={m.l - 6} y={y(t) + 4} textAnchor="end">
            {compact(t)}
          </text>
        </g>
      ))}
      {all.map((p, i) => {
        const cx = m.l + slot * i + slot / 2
        const label = periodShort(p.key, years.size > 1)
        return (
          <g key={p.key}>
            <rect className={'pt-bar-income' + (p.est ? ' pt-est' : '')} x={cx - bw - 1.5} y={y(p.income)} width={bw} height={Math.max(0, m.t + ih - y(p.income))} rx="3">
              <title>{`${p.label}${p.est ? ' (estimasi)' : ''}: pemasukan ${money(p.income)}`}</title>
            </rect>
            <rect className={'pt-bar-expense' + (p.est ? ' pt-est' : '')} x={cx + 1.5} y={y(p.expense)} width={bw} height={Math.max(0, m.t + ih - y(p.expense))} rx="3">
              <title>{`${p.label}${p.est ? ' (estimasi)' : ''}: pengeluaran ${money(p.expense)}`}</title>
            </rect>
            <text x={cx} y={H - 14} textAnchor="middle">
              {label}
            </text>
            {p.est && (
              <text x={cx} y={H - 3} textAnchor="middle" style={{ fontSize: 9.5 }}>
                est.
              </text>
            )}
          </g>
        )
      })}
      {actual.length > 0 && estimate.length > 0 && (
        <line className="pt-divider" x1={m.l + slot * divIdx} x2={m.l + slot * divIdx} y1={m.t} y2={m.t + ih} />
      )}
    </svg>
  )
}

/** Grafik garis sederhana (satu/dua seri) untuk simulasi. series: [{ key, label, cls, points:[{x,y}] }] */
export function LineChart({ series, xMax, ariaLabel, xFormat = (x) => `${x}` }) {
  const W = 640
  const H = 240
  const m = { l: 56, r: 12, t: 12, b: 30 }
  const iw = W - m.l - m.r
  const ih = H - m.t - m.b
  const ys = series.flatMap((s) => s.points.map((p) => p.y))
  let lo = Math.min(0, ...ys)
  let hi = Math.max(0, ...ys)
  if (hi === lo) hi = lo + 1
  const pad = (hi - lo) * 0.08
  hi += pad
  if (lo < 0) lo -= pad
  const x = (v) => m.l + (v / xMax) * iw
  const y = (v) => m.t + ih - ((v - lo) / (hi - lo)) * ih
  const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3)
  const step = xMax <= 6 ? 1 : xMax <= 12 ? 2 : 4
  const xt = []
  for (let v = 0; v <= xMax; v += step) xt.push(v)
  return (
    <svg className="pt-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line className="pt-axis" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} strokeOpacity={0.5} />
          <text x={m.l - 6} y={y(t) + 4} textAnchor="end">
            {compact(t)}
          </text>
        </g>
      ))}
      {lo < 0 && hi > 0 && <line className="pt-zero" x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} />}
      {xt.map((v) => (
        <text key={v} x={x(v)} y={H - 10} textAnchor="middle">
          {xFormat(v)}
        </text>
      ))}
      {series.map((s) => (
        <polyline key={s.key} className={s.cls} points={s.points.map((p) => `${x(p.x)},${y(p.y)}`).join(' ')} strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </svg>
  )
}
