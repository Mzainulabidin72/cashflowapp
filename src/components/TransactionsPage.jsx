import { useMemo, useState } from 'react'
import {
  Plus,
  Search,
  Lock,
  Download,
  Pencil,
  Trash2,
  ArrowUpDown,
  X,
} from 'lucide-react'

function rupiah(n) {
  return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID')
}

function inRange(date, period, customFrom, customTo) {
  if (period === 'all') return true
  const d = String(date || '')
  if (!d) return false
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  if (period === 'today') return d === today
  if (period === 'week') {
    const from = new Date(now)
    from.setDate(from.getDate() - 7)
    return d >= from.toISOString().slice(0, 10)
  }
  if (period === 'month') return d.startsWith(today.slice(0, 7))
  if (period === 'year') return d.startsWith(String(now.getFullYear()))
  if (period === 'custom') {
    if (customFrom && d < customFrom) return false
    if (customTo && d > customTo) return false
    return true
  }
  return true
}

function countTxThisMonth(transactions) {
  const key = new Date().toISOString().slice(0, 7)
  return (transactions || []).filter((t) =>
    String(t.date || '').startsWith(key)
  ).length
}

/**
 * Props:
 * - transactions, categories
 * - onAdd, onEdit, onDelete  — open modal / CRUD handlers from App
 * - planInfo: { planName, rank, canUseExport, canUseCustomCategory, canUseUnlimitedTx, canUseFullAnalytics, txLimitPerMonth }
 * - onUpgrade(plan) — e.g. setTab subscription
 * - exportTransactionsCsv(list)
 * - TransactionModal — if null, onAdd/onEdit should open App modal
 */
export default function TransactionsPage({
  transactions = [],
  categories = { income: [], expense: [] },
  onAdd,
  onEdit,
  onDelete,
  planInfo,
  onUpgrade,
  exportTransactionsCsv,
  // legacy
  canExport: canExportProp,
  onExportBlocked,
}) {
  const rank = planInfo?.rank ?? (canExportProp ? 1 : 0)
  const isGratis = rank < 1
  const isBasic = rank >= 1 && rank < 2
  const isPro = rank >= 2 || !!planInfo?.canUseFullAnalytics
  const canFilter = rank >= 1
  const canExport = planInfo?.canUseExport ?? !!canExportProp
  const canUnlimited = planInfo?.canUseUnlimitedTx ?? rank >= 1
  const txLimit = planInfo?.txLimitPerMonth ?? 200
  const usedThisMonth = countTxThisMonth(transactions)
  const nearLimit =
    !canUnlimited && txLimit && usedThisMonth / txLimit >= 0.8
  const atLimit = !canUnlimited && txLimit && usedThisMonth >= txLimit

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [period, setPeriod] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [upgradeModal, setUpgradeModal] = useState(null) // { tier, title, body }

  const allCats = [...(categories.income || []), ...(categories.expense || [])]

  const filtered = useMemo(() => {
    let list = transactions.filter((t) => {
      if (canFilter) {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false
        if (catFilter !== 'all' && t.category !== catFilter) return false
        if (period !== 'all' && !inRange(t.date, period, customFrom, customTo))
          return false
        if (query) {
          const q = query.toLowerCase()
          const hay = `${t.description || ''} ${t.note || ''} ${t.category || ''} ${t.method || ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
      }
      return true
    })
    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'date') cmp = String(a.date).localeCompare(String(b.date))
      else if (sortKey === 'amount')
        cmp = Number(a.amount) - Number(b.amount)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [
    transactions,
    typeFilter,
    catFilter,
    period,
    customFrom,
    customTo,
    query,
    sortKey,
    sortDir,
    canFilter,
  ])

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function needBasic(feature) {
    setUpgradeModal({
      tier: 'Basic',
      title: 'Fitur ini tersedia di Basic',
      body:
        feature ||
        'Cari, filter, kategori custom, transaksi unlimited, dan export CSV tersedia mulai paket Basic.',
    })
  }

  function needPro(feature) {
    setUpgradeModal({
      tier: 'Pro',
      title: 'Fitur ini tersedia di Pro',
      body:
        feature ||
        'Multi-wallet, prediksi cash flow, analytics lanjutan, dan laporan PDF tersedia di Pro.',
    })
  }

  function handleExport() {
    if (!canExport) {
      needBasic('Export CSV tersedia di paket Basic dan Pro.')
      onExportBlocked?.()
      return
    }
    if (typeof exportTransactionsCsv === 'function') {
      exportTransactionsCsv(filtered.length ? filtered : transactions)
    }
  }

  function handleAdd() {
    if (atLimit) {
      needBasic(
        `Kuota Gratis ${txLimit} transaksi/bulan sudah penuh. Upgrade Basic untuk unlimited.`
      )
      return
    }
    onAdd?.()
  }

  const planLabel = isPro
    ? 'Paket Pro'
    : isBasic
      ? 'Paket Basic'
      : 'Paket Gratis'

  const displayList = canFilter ? filtered : transactions

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <h2 className="bk-serif" style={{ fontSize: 22, margin: 0 }}>
            Transaksi
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-dim)' }}>
            Catat dan kelola seluruh pemasukan dan pengeluaranmu.
          </p>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 999,
                background: 'var(--brass-soft, rgba(201,162,75,0.15))',
                color: 'var(--brass)',
              }}
            >
              {planLabel}
            </span>
            {canUnlimited ? (
              <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
                Transaksi unlimited
              </span>
            ) : (
              <span
                style={{
                  fontSize: 12,
                  color: nearLimit ? 'var(--clay)' : 'var(--ink-dim)',
                }}
              >
                {usedThisMonth} / {txLimit} transaksi bulan ini
                {nearLimit && !atLimit
                  ? ' · hampir mencapai kuota'
                  : ''}
                {atLimit ? ' · kuota penuh' : ''}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="bk-btn bk-btn-ghost"
            onClick={handleExport}
            style={{ opacity: canExport ? 1 : 0.75 }}
          >
            {canExport ? (
              <Download size={14} />
            ) : (
              <Lock size={14} />
            )}{' '}
            Export CSV
            {!canExport && (
              <span style={{ fontSize: 10, marginLeft: 4 }}>Basic</span>
            )}
          </button>
          {isPro ? (
            <button
              type="button"
              className="bk-btn bk-btn-ghost"
              onClick={() => onUpgrade?.('pro-tools')}
            >
              Laporan / Tools Pro
            </button>
          ) : (
            <button
              type="button"
              className="bk-btn bk-btn-ghost"
              onClick={() =>
                needPro('Laporan PDF & tools lanjutan ada di paket Pro.')
              }
              style={{ opacity: 0.75 }}
            >
              <Lock size={14} /> Laporan PDF
              <span style={{ fontSize: 10, marginLeft: 4 }}>Pro</span>
            </button>
          )}
          <button
            type="button"
            className="bk-btn bk-btn-primary"
            onClick={handleAdd}
          >
            <Plus size={16} /> Tambah transaksi
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        className="bk-card"
        style={{
          padding: 14,
          marginBottom: 14,
          position: 'relative',
        }}
      >
        {!canFilter && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(22,35,31,0.04)',
              borderRadius: 12,
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onClick={() =>
              needBasic(
                'Pencarian & filter transaksi tersedia di paket Basic.'
              )
            }
          >
            <span
              style={{
                background: 'var(--paper-raised)',
                border: '1px solid var(--paper-line)',
                borderRadius: 999,
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--brass)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Lock size={14} /> Filter & pencarian · Basic
            </span>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            opacity: canFilter ? 1 : 0.45,
            pointerEvents: canFilter ? 'auto' : 'none',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ink-dim)',
              }}
            />
            <input
              className="bk-input"
              style={{ paddingLeft: 32 }}
              placeholder="Cari deskripsi, kategori..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="bk-input"
            style={{ flex: '0 1 140px' }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">Semua tipe</option>
            <option value="income">Pemasukan</option>
            <option value="expense">Pengeluaran</option>
          </select>
          <select
            className="bk-input"
            style={{ flex: '0 1 160px' }}
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
          >
            <option value="all">Semua kategori</option>
            {allCats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="bk-input"
            style={{ flex: '0 1 140px' }}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="all">Semua periode</option>
            <option value="today">Hari ini</option>
            <option value="week">7 hari</option>
            <option value="month">Bulan ini</option>
            <option value="year">Tahun ini</option>
            <option value="custom">Custom</option>
          </select>
          {period === 'custom' && (
            <>
              <input
                type="date"
                className="bk-input"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <input
                type="date"
                className="bk-input"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </>
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div
        className="bk-card bk-scroll tx-desktop"
        style={{ overflowX: 'auto', padding: 0 }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
            minWidth: 640,
          }}
        >
          <thead>
            <tr>
              <Th onClick={() => toggleSort('date')} active={sortKey === 'date'}>
                Tanggal
              </Th>
              <th style={thStyle}>Deskripsi</th>
              <th style={thStyle}>Kategori</th>
              <th style={thStyle}>Metode</th>
              <Th
                onClick={() => toggleSort('amount')}
                active={sortKey === 'amount'}
                right
              >
                Nominal
              </Th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {displayList.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{ padding: 24, textAlign: 'center', color: 'var(--ink-dim)' }}
                >
                  Belum ada transaksi
                  {canFilter && (query || typeFilter !== 'all')
                    ? ' untuk filter ini'
                    : ''}
                  .
                </td>
              </tr>
            )}
            {displayList.map((t) => (
              <tr key={t.id}>
                <td style={tdStyle}>{t.date}</td>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600 }}>{t.description || '—'}</div>
                  {t.note ? (
                    <div style={{ fontSize: 11, color: 'var(--ink-dim)' }}>
                      {t.note}
                    </div>
                  ) : null}
                </td>
                <td style={tdStyle}>{t.category}</td>
                <td style={tdStyle}>{t.method || '—'}</td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: 'right',
                    fontWeight: 700,
                    color:
                      t.type === 'income' ? 'var(--brass)' : 'var(--clay)',
                  }}
                  className="bk-mono"
                >
                  {t.type === 'income' ? '+' : '−'}
                  {rupiah(t.amount)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <button
                    type="button"
                    className="bk-btn bk-btn-ghost"
                    style={{ padding: '6px 8px', minHeight: 36 }}
                    onClick={() => onEdit?.(t)}
                    aria-label="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="bk-btn bk-btn-ghost"
                    style={{
                      padding: '6px 8px',
                      minHeight: 36,
                      color: 'var(--clay)',
                    }}
                    onClick={() => {
                      if (confirm('Hapus transaksi ini?')) onDelete?.(t)
                    }}
                    aria-label="Hapus"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="tx-mobile" style={{ display: 'none', flexDirection: 'column', gap: 10 }}>
        {displayList.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--ink-dim)', padding: 20 }}>
            Belum ada transaksi.
          </p>
        )}
        {displayList.map((t) => (
          <div key={t.id} className="bk-card" style={{ padding: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 6,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {t.description || '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
                  {t.date} · {t.category}
                  {t.method ? ` · ${t.method}` : ''}
                </div>
              </div>
              <div
                className="bk-mono"
                style={{
                  fontWeight: 700,
                  color: t.type === 'income' ? 'var(--brass)' : 'var(--clay)',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.type === 'income' ? '+' : '−'}
                {rupiah(t.amount)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                onClick={() => onEdit?.(t)}
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                style={{ color: 'var(--clay)' }}
                onClick={() => {
                  if (confirm('Hapus transaksi ini?')) onDelete?.(t)
                }}
              >
                <Trash2 size={14} /> Hapus
              </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 720px) {
          .tx-desktop { display: none !important; }
          .tx-mobile { display: flex !important; }
        }
      `}</style>

      {/* Upgrade modal */}
      {upgradeModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8,12,10,0.5)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setUpgradeModal(null)}
        >
          <div
            className="bk-card"
            style={{ maxWidth: 400, width: '100%', padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--brass)',
                    marginBottom: 4,
                  }}
                >
                  {upgradeModal.tier}
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: 17 }}>
                  {upgradeModal.title}
                </h3>
              </div>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                style={{ padding: 6 }}
                onClick={() => setUpgradeModal(null)}
              >
                <X size={16} />
              </button>
            </div>
            <p
              style={{
                fontSize: 13,
                color: 'var(--ink-dim)',
                lineHeight: 1.45,
                margin: '0 0 16px',
              }}
            >
              {upgradeModal.body}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                onClick={() => setUpgradeModal(null)}
              >
                Nanti
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={() => {
                  setUpgradeModal(null)
                  onUpgrade?.(upgradeModal.tier)
                }}
              >
                Upgrade ke {upgradeModal.tier}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle = {
  textAlign: 'left',
  padding: '10px 12px',
  borderBottom: '1px solid var(--paper-line)',
  color: 'var(--ink-dim)',
  fontWeight: 600,
  fontSize: 12,
}
const tdStyle = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--paper-line)',
  verticalAlign: 'top',
}

function Th({ children, onClick, active, right }) {
  return (
    <th
      onClick={onClick}
      style={{
        ...thStyle,
        textAlign: right ? 'right' : 'left',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: active ? 'var(--brass)' : 'var(--ink-dim)',
        }}
      >
        {children}{' '}
        <ArrowUpDown size={11} style={{ opacity: active ? 1 : 0.4 }} />
      </span>
    </th>
  )
}
