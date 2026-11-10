import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { loadBudget, saveBudget, sumExpenseThisMonth } from '../lib/budgetService'
import { getUserPlanInfo } from '../lib/planAccess'
import { formatMoney, formatNumber, usePrefs } from '../lib/prefs'

const rupiah = (n) => formatMoney(n)

function formatInputDisplay(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  return formatNumber(Number(digits))
}

export default function BudgetPanel({ transactions = [], onToast }) {
  usePrefs()
  const { user } = useAuth()
  const [limit, setLimit] = useState(0)
  const [draft, setDraft] = useState('')
  const [planInfo, setPlanInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const spent = sumExpenseThisMonth(transactions)
  const canEdit = !!planInfo?.canUseCustomCategory

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError('')
      try {
        const [b, info] = await Promise.all([
          loadBudget(user.id),
          getUserPlanInfo(user.id),
        ])
        if (cancelled) return
        setLimit(b)
        setDraft(b ? String(b) : '')
        setPlanInfo(info)
      } catch (e) {
        console.error(e)
        if (!cancelled) setLoadError(e.message || 'Budget tidak dapat dimuat.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, reloadKey])

  async function handleSave(e) {
    e.preventDefault()
    if (!canEdit) {
      onToast?.('Budget bulanan khusus paket Basic/Pro.')
      return
    }
    setSaving(true)
    try {
      const v = await saveBudget(user.id, draft.replace(/\D/g, ''))
      setLimit(v)
      setDraft(v ? String(v) : '')
      onToast?.('Budget disimpan')
    } catch (e) {
      onToast?.(e.message || 'Gagal simpan budget')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="ds-budget dash-budget" aria-label="Budget bulanan" aria-busy="true">
        <div className="dash-budget-skeleton" />
      </section>
    )
  }

  if (loadError) {
    return (
      <section className="ds-budget dash-budget" aria-label="Budget bulanan">
        <div className="dash-card-heading">
          <div>
            <h2>Budget bulan ini</h2>
            <p role="alert">{loadError}</p>
          </div>
          <button type="button" className="bk-btn bk-btn-ghost" onClick={() => setReloadKey((key) => key + 1)}>
            Coba lagi
          </button>
        </div>
      </section>
    )
  }

  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0
  const over = limit > 0 && spent > limit
  const overAmt = over ? spent - limit : 0
  const remaining = limit - spent
  const status = limit <= 0
    ? 'Atur budget untuk memantau pengeluaran'
    : over
      ? 'Budget terlampaui'
      : pct >= 80
        ? 'Mendekati batas budget'
        : 'Dalam batas budget'
  const barColor = over
    ? 'var(--ds-expense)'
    : pct >= 80
      ? 'var(--ds-warning)'
      : 'var(--ds-success)'

  return (
    <section className={`ds-budget dash-budget${over ? ' is-over' : ''}${limit > 0 && pct >= 80 && !over ? ' is-warning' : ''}`} aria-label="Budget bulanan">
      <div className="dash-budget-heading">
        <div className="dash-card-heading">
          <div>
            <h2>Budget bulan ini</h2>
            <p>Pengeluaran berdasarkan transaksi bulan berjalan.</p>
          </div>
        </div>
        {!canEdit && (
          <span className="dash-budget-plan">Basic/Pro</span>
        )}
      </div>

      <div className="dash-budget-metrics">
        <div>
          <span className="dash-budget-label">Total budget</span>
          <strong>{limit > 0 ? rupiah(limit) : 'Belum diatur'}</strong>
        </div>
        <div>
          <span className="dash-budget-label">Total pengeluaran</span>
          <strong className={over ? 'is-expense' : ''}>{rupiah(spent)}</strong>
        </div>
        <div>
          <span className="dash-budget-label">Sisa budget</span>
          <strong className={remaining < 0 ? 'is-expense' : ''}>{limit > 0 ? rupiah(remaining) : '—'}</strong>
        </div>
      </div>

      {limit > 0 && (
        <>
          <div className="dash-budget-progress-row">
            <span className={`dash-budget-status${over ? ' is-over' : pct >= 80 ? ' is-warning' : ''}`}>{status}</span>
            <strong>{pct}% terpakai</strong>
          </div>
          <div className="ds-budget-bar dash-budget-bar" role="progressbar" aria-label="Pemakaian budget bulanan" aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
          </div>
          {over && <p className="dash-budget-overrun">Pengeluaran melebihi budget sebesar {rupiah(overAmt)}.</p>}
        </>
      )}

      <form onSubmit={handleSave} className="dash-budget-form">
        <label className="dash-budget-input-wrap">
          <span>Rp</span>
          <input
            inputMode="numeric"
            value={formatInputDisplay(draft)}
            disabled={!canEdit || saving}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
            placeholder="2.000.000"
            aria-label="Limit budget"
          />
        </label>
        <button
          type="submit"
          className="bk-btn bk-btn-primary"
          disabled={!canEdit || saving}
        >
          {saving ? 'Menyimpan...' : 'Simpan budget'}
        </button>
      </form>
    </section>
  )
}
