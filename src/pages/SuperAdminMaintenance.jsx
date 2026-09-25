import { useEffect, useState } from 'react'
import SuperAdminShell from '../components/super/SuperAdminShell'
import { getMaintenance, setMaintenance } from '../lib/adminService'

export default function SuperAdminMaintenance() {
  const [maint, setMaint] = useState({
    enabled: false,
    title: 'Scheduled Maintenance',
    message: 'The system is currently undergoing maintenance.',
    estimated_end: '',
  })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMaintenance()
      .then((m) =>
        setMaint({
          enabled: !!m.enabled,
          title: m.title || 'Scheduled Maintenance',
          message: m.message || 'The system is currently undergoing maintenance.',
          estimated_end: m.estimated_end || '',
        })
      )
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    if (maint.enabled && !confirm('Aktifkan maintenance mode untuk semua user?')) return
    try {
      await setMaintenance({
        enabled: !!maint.enabled,
        title: maint.title,
        message: maint.message,
        estimated_end: maint.estimated_end || null,
      })
      setMsg('Maintenance settings disimpan.')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <SuperAdminShell title="Maintenance">
      {loading && <p className="sa-muted">Memuat...</p>}
      {msg && <p className="sa-ok">{msg}</p>}
      {error && <p className="sa-err">{error}</p>}

      <div className="sa-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>Maintenance Mode</h2>
          {maint.enabled ? (
            <span className="sa-badge warn">● ON</span>
          ) : (
            <span className="sa-badge">● OFF</span>
          )}
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <input
            type="checkbox"
            checked={!!maint.enabled}
            onChange={(e) => setMaint({ ...maint, enabled: e.target.checked })}
          />
          Enable maintenance mode
        </label>

        <div style={{ marginBottom: 12 }}>
          <label className="sa-muted">Title</label>
          <input
            className="sa-input"
            value={maint.title}
            onChange={(e) => setMaint({ ...maint, title: e.target.value })}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="sa-muted">Message</label>
          <textarea
            className="sa-textarea"
            value={maint.message}
            onChange={(e) => setMaint({ ...maint, message: e.target.value })}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="sa-muted">Estimated completion (ISO / datetime string)</label>
          <input
            className="sa-input"
            placeholder="2026-09-23T23:00"
            value={maint.estimated_end || ''}
            onChange={(e) => setMaint({ ...maint, estimated_end: e.target.value })}
          />
        </div>
        <button type="button" className="sa-btn sa-btn-primary" onClick={save}>
          Save
        </button>
      </div>
    </SuperAdminShell>
  )
}
