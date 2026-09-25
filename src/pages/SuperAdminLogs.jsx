import { useEffect, useMemo, useState } from 'react'
import SuperAdminShell from '../components/super/SuperAdminShell'
import {
  listAuditLogs,
  formatAuditAction,
  AUDIT_ACTION_LABELS,
} from '../lib/auditLogService'

function fmtTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(iso)
  }
}

export default function SuperAdminLogs() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [action, setAction] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selected, setSelected] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await listAuditLogs({
        limit: 200,
        action,
        q,
        fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
        toDate: toDate
          ? new Date(toDate + 'T23:59:59').toISOString()
          : undefined,
      })
      setRows(data)
    } catch (e) {
      console.error(e)
      setError(
        e.message?.includes('relation') || e.code === '42P01'
          ? 'Tabel audit_logs belum ada. Jalankan sql/audit_logs.sql di Supabase.'
          : e.message || 'Gagal memuat audit logs'
      )
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const actionOptions = useMemo(() => {
    const keys = Object.keys(AUDIT_ACTION_LABELS)
    return keys
  }, [])

  return (
    <SuperAdminShell title="Audit Logs">
      <p className="sa-muted" style={{ marginTop: 0 }}>
        Catatan aktivitas admin yang sensitif. Log bersifat append-only — tidak bisa
        diedit dari UI.
      </p>

      {error && <p className="sa-err">{error}</p>}

      <div
        className="sa-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: '1 1 180px' }}>
          <label className="sa-muted" style={{ display: 'block', marginBottom: 4 }}>
            Cari
          </label>
          <input
            className="sa-input"
            placeholder="Actor, target, action..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div style={{ flex: '0 1 180px' }}>
          <label className="sa-muted" style={{ display: 'block', marginBottom: 4 }}>
            Action
          </label>
          <select
            className="sa-select"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="all">Semua</option>
            {actionOptions.map((a) => (
              <option key={a} value={a}>
                {formatAuditAction(a)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '0 1 150px' }}>
          <label className="sa-muted" style={{ display: 'block', marginBottom: 4 }}>
            Dari
          </label>
          <input
            type="date"
            className="sa-input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div style={{ flex: '0 1 150px' }}>
          <label className="sa-muted" style={{ display: 'block', marginBottom: 4 }}>
            Sampai
          </label>
          <input
            type="date"
            className="sa-input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <button type="button" className="sa-btn sa-btn-primary" onClick={load}>
          Terapkan
        </button>
      </div>

      {loading && <p className="sa-muted">Memuat log...</p>}

      <div className="sa-card">
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Perubahan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="sa-muted">
                    No audit activity yet.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="sa-muted" style={{ whiteSpace: 'nowrap' }}>
                    {fmtTime(r.created_at)}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>
                      {r.actor_email || r.actor_id?.slice(0, 8) || '—'}
                    </div>
                  </td>
                  <td>{formatAuditAction(r.action)}</td>
                  <td>
                    <div style={{ fontSize: 13 }}>{r.target_label || r.target_id || '—'}</div>
                    {r.target_type && (
                      <div className="sa-muted" style={{ fontSize: 11 }}>
                        {r.target_type}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {r.previous_value || r.new_value ? (
                      <>
                        <span className="sa-muted">{r.previous_value || '—'}</span>
                        {' → '}
                        <strong>{r.new_value || '—'}</strong>
                      </>
                    ) : (
                      <span className="sa-muted">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="sa-btn sa-btn-ghost"
                      onClick={() => setSelected(r)}
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setSelected(null)}
        >
          <div
            className="sa-card"
            style={{ maxWidth: 480, width: '100%', margin: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Log detail</h2>
            <dl style={{ fontSize: 13, margin: 0 }}>
              {[
                ['Waktu', fmtTime(selected.created_at)],
                ['Actor', selected.actor_email || selected.actor_id || '—'],
                ['Action', formatAuditAction(selected.action)],
                ['Target type', selected.target_type || '—'],
                ['Target', selected.target_label || selected.target_id || '—'],
                ['Previous', selected.previous_value || '—'],
                ['New', selected.new_value || '—'],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 1fr',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <dt className="sa-muted">{k}</dt>
                  <dd style={{ margin: 0 }}>{v}</dd>
                </div>
              ))}
            </dl>
            {selected.meta && Object.keys(selected.meta).length > 0 && (
              <pre
                style={{
                  fontSize: 11,
                  background: 'var(--sa-bg)',
                  padding: 10,
                  borderRadius: 8,
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(selected.meta, null, 2)}
              </pre>
            )}
            <button
              type="button"
              className="sa-btn"
              style={{ marginTop: 12 }}
              onClick={() => setSelected(null)}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </SuperAdminShell>
  )
}
