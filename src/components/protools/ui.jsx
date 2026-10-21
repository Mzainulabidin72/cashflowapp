import { Children, cloneElement, useId } from 'react'
import { AlertCircle, ArrowUpRight, ArrowDownRight, Minus, Info } from 'lucide-react'
import { formatMoney } from '../../lib/prefs'
import { fillMoney } from '../../lib/proToolsCalc'

/** Nominal terformat sesuai Pengaturan (Rp, titik/koma). */
export const money = (n) => formatMoney(n)
/** Isi token {{angka}} dari modul perhitungan dengan nominal terformat. */
export const txt = (s) => fillMoney(s, formatMoney)
export const pctText = (p, digits = 0) =>
  `${Number(p).toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`

export function Card({ id, title, icon: Icon, desc, actions, children, className = '' }) {
  const hid = `${id || title}-title`.replace(/\s+/g, '-')
  return (
    <section id={id} className={`pt-card ${className}`} aria-labelledby={hid}>
      <div className="pt-card-head">
        <div style={{ minWidth: 0 }}>
          <h2 id={hid} className="pt-card-title">
            {Icon && <Icon size={18} strokeWidth={1.75} aria-hidden="true" />}
            {title}
          </h2>
          {desc && <p className="pt-card-desc">{desc}</p>}
        </div>
        {actions && <div className="pt-card-actions">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

/** Label di atas kontrol + pesan error/hint yang terhubung lewat aria-describedby. */
export function Field({ label, error, hint, wide, children }) {
  const id = useId()
  const only = Children.only(children)
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div className={'pt-field' + (wide ? ' is-wide' : '')}>
      <label className="pt-label" htmlFor={id}>
        {label}
      </label>
      {cloneElement(only, { id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <div className="pt-error" id={`${id}-err`} role="alert">
          <AlertCircle size={13} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : hint ? (
        <div className="pt-hint" id={`${id}-hint`}>
          {hint}
        </div>
      ) : null}
    </div>
  )
}

/** Status: selalu ikon + teks, jadi tidak mengandalkan warna saja. */
export function Tag({ tone = 'neutral', icon: Icon, children }) {
  return (
    <span className={`pt-tag is-${tone}`}>
      {Icon && <Icon size={12} strokeWidth={2} aria-hidden="true" />}
      {children}
    </span>
  )
}

/** Perubahan persen dengan panah + tanda (+/−). invert: kenaikan = buruk (mis. pengeluaran). */
export function Delta({ pct, invert = false, suffix = '' }) {
  if (pct == null) return <span className="pt-delta pt-muted">Belum ada pembanding</span>
  const up = pct > 0.5
  const down = pct < -0.5
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
  const good = invert ? down : up
  const bad = invert ? up : down
  const cls = good ? 'pt-pos' : bad ? 'pt-neg' : 'pt-muted'
  const word = up ? 'naik' : down ? 'turun' : 'tetap'
  return (
    <span className={`pt-delta ${cls}`}>
      <Icon size={13} strokeWidth={2.25} aria-hidden="true" />
      <span aria-hidden="true">
        {up ? '+' : down ? '−' : ''}
        {pctText(Math.abs(pct))}
      </span>
      <span className="sr-only">
        {word} {pctText(Math.abs(pct))}
      </span>
      {suffix && <span className="pt-muted" style={{ fontWeight: 400 }}>{suffix}</span>}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="pt-empty">
      {Icon && <Icon size={28} strokeWidth={1.5} aria-hidden="true" />}
      <div className="pt-empty-title">{title}</div>
      {text && <div className="pt-small pt-muted" style={{ maxWidth: 420 }}>{text}</div>}
      {action}
    </div>
  )
}

export function Notice({ tone = 'warn', icon: Icon = Info, children }) {
  return (
    <div className={`pt-notice${tone === 'danger' ? ' is-danger' : tone === 'neutral' ? ' is-neutral' : ''}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon size={15} aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

/** Input angka: type=number agar keyboard numerik di HP; nilai disimpan sebagai string di state form. */
export function NumInput(props) {
  return <input className="pt-input" type="number" inputMode="decimal" min="0" step="any" {...props} />
}
