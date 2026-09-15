import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { loadBudget, saveBudget, sumExpenseThisMonth } from '../lib/budgetService'
import { getUserPlanInfo } from '../lib/planAccess'

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

/**
 * Panel budget bulanan.
 * Props: transactions (array), optional onToast(msg)
 * Gratis: hanya lihat (locked), Basic+: bisa set limit
 */
export default function BudgetPanel({ transactions = [], onToast }) {
  const { user } = useAuth()
  const [limit, setLimit] = useState(0)
  const [draft, setDraft] = useState('')
  const [planInfo, setPlanInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const spent = sumExpenseThisMonth(transactions)
  const canEdit = !!planInfo?.canUseCustomCategory // Basic+ (sama gate kategori custom)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function init() {
      setLoading(true)
      try {
        const [b, info] = await Promise.all([
          loadBudget(user.id),
          getUserPlanInfo(user.id),
        ])
        if (cancelled) return
        setLimit(b)
        setDraft(String(b || ''))
        setPlanInfo(info)
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleSave(e) {
    e.preventDefault()
    if (!canEdit) {
      onToast?.('Budget bulanan khusus paket Basic/Pro. Silakan upgrade.')
      return
    }
    setSaving(true)
    try {
      const v = await saveBudget(user.id, draft)
      setLimit(v)
      onToast?.('Budget disimpan')
    } catch (e) {
      console.error(e)
      onToast?.(e.message || 'Gagal simpan budget')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={styles.card}>
        <p style={styles.muted}>Memuat budget...</p>
      </div>
    )
  }

  const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
  const over = limit > 0 && spent > limit
  const barColor = over ? '#C4735A' : pct >= 80 ? '#C9A24B' : '#7FA37F'

  return (
    <div style={styles.card}>
      <div style={styles.head}>
        <h3 style={styles.h3}>Budget pengeluaran bulan ini</h3>
        {!canEdit && (
          <span style={styles.lock}>Basic/Pro</span>
        )}
      </div>

      <div style={styles.row}>
        <span style={styles.muted}>Terpakai</span>
        <b style={{ color: over ? '#C4735A' : '#EDEAE0' }}>{rupiah(spent)}</b>
      </div>
      <div style={styles.row}>
        <span style={styles.muted}>Limit</span>
        <b>{limit > 0 ? rupiah(limit) : 'Belum diset'}</b>
      </div>

      {limit > 0 && (
        <>
          <div style={styles.barBg}>
            <div
              style={{
                ...styles.barFill,
                width: `${pct}%`,
                background: barColor,
              }}
            />
          </div>
          <div style={{ ...styles.muted, marginTop: 6, fontSize: 12 }}>
            {pct}% terpakai
            {over ? ' — melebihi budget!' : ''}
          </div>
        </>
      )}

      <form onSubmit={handleSave} style={styles.form}>
        <input
          style={{
            ...styles.input,
            opacity: canEdit ? 1 : 0.55,
          }}
          type="number"
          min="0"
          step="1000"
          value={draft}
          disabled={!canEdit || saving}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Limit bulanan (Rp)"
        />
        <button
          style={{
            ...styles.btn,
            opacity: canEdit ? 1 : 0.55,
          }}
          type="submit"
          disabled={!canEdit || saving}
        >
          {saving ? '...' : 'Simpan'}
        </button>
      </form>
      {!canEdit && (
        <p style={{ ...styles.muted, marginTop: 8, fontSize: 12 }}>
          Upgrade ke Basic/Pro untuk mengatur budget.
        </p>
      )}
    </div>
  )
}

const styles = {
  card: {
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  h3: {
    margin: 0,
    fontSize: 15,
    color: '#C9A24B',
    fontFamily: 'Georgia, serif',
  },
  lock: {
    fontSize: 11,
    color: '#C9A24B',
    border: '1px solid #C9A24B',
    borderRadius: 999,
    padding: '2px 8px',
  },
  muted: { color: '#A9B0A8', fontSize: 13 },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 6,
    fontSize: 14,
  },
  barBg: {
    height: 8,
    background: '#16231F',
    borderRadius: 999,
    marginTop: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 0.3s',
  },
  form: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
  },
  input: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #2B3E37',
    background: '#16231F',
    color: '#EDEAE0',
    fontSize: 13,
  },
  btn: {
    background: '#C9A24B',
    color: '#1B160A',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 13,
  },
}
