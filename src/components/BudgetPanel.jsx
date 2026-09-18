import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { loadBudget, saveBudget, sumExpenseThisMonth } from '../lib/budgetService'
import { getUserPlanInfo } from '../lib/planAccess'

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

function formatInputDisplay(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('id-ID')
}

export default function BudgetPanel({ transactions = [], onToast }) {
  const { user } = useAuth()
  const [limit, setLimit] = useState(0)
  const [draft, setDraft] = useState('')
  const [planInfo, setPlanInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const spent = sumExpenseThisMonth(transactions)
  const canEdit = !!planInfo?.canUseCustomCategory

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
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
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

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
      <div className="ds-budget">
        <p className="ds-caption">Memuat budget...</p>
      </div>
    )
  }

  const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
  const over = limit > 0 && spent > limit
  const overAmt = over ? spent - limit : 0
  const barColor = over
    ? 'var(--ds-expense)'
    : pct >= 80
      ? 'var(--ds-warning)'
      : 'var(--ds-success)'

  return (
    <div className="ds-budget">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h3 className="ds-card-title" style={{ margin: 0 }}>
          Budget bulan ini
        </h3>
        {!canEdit && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--ds-primary)',
              border: '1px solid var(--ds-primary)',
              borderRadius: 999,
              padding: '2px 8px',
            }}
          >
            Basic/Pro
          </span>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <span className="ds-money" style={{ fontSize: 20, color: over ? 'var(--ds-expense)' : 'var(--ds-text)' }}>
          {rupiah(spent)}
        </span>
        <span className="ds-caption"> dari {limit > 0 ? rupiah(limit) : '—'}</span>
      </div>

      {limit > 0 && (
        <>
          <div className="ds-budget-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
          </div>
          <p className="ds-caption" style={{ margin: 0 }}>
            {pct}% terpakai
            {over ? ` · ${rupiah(overAmt)} di atas budget` : ''}
          </p>
        </>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--ds-border)', borderRadius: 8, padding: '0 10px', background: 'var(--ds-bg)' }}>
          <span className="ds-caption">Rp</span>
          <input
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: 'var(--ds-text)',
              padding: '10px 0',
              fontSize: 13,
              outline: 'none',
              opacity: canEdit ? 1 : 0.55,
            }}
            inputMode="numeric"
            value={formatInputDisplay(draft)}
            disabled={!canEdit || saving}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
            placeholder="2.000.000"
            aria-label="Limit budget"
          />
        </div>
        <button
          type="submit"
          className="bk-btn bk-btn-primary"
          disabled={!canEdit || saving}
          style={{ opacity: canEdit ? 1 : 0.55 }}
        >
          {saving ? '...' : 'Atur Budget'}
        </button>
      </form>
    </div>
  )
}
