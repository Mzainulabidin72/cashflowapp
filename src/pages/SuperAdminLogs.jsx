import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listActivityLogs } from '../lib/activityService'

export default function SuperAdminLogs() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await listActivityLogs(150)
        if (!cancelled) setRows(data)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e.message || 'Gagal memuat log')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div style={styles.wrap}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/super-admin" style={styles.back}>
          ← Kembali ke Super Admin
        </Link>
      </div>

      <h2 style={styles.title}>Activity Logs</h2>
      {error && <p style={styles.err}>{error}</p>}
      {loading && <p style={styles.muted}>Memuat...</p>}

      {!loading && rows.length === 0 && (
        <p style={styles.muted}>Belum ada log.</p>
      )}

      {!loading && rows.length > 0 && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Waktu</th>
                <th style={styles.th}>User</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Aksi</th>
                <th style={styles.th}>Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={styles.td}>
                    {r.created_at
                      ? new Date(r.created_at).toLocaleString('id-ID')
                      : '—'}
                  </td>
                  <td style={styles.td}>
                    {r.profile?.full_name || r.profile?.email || r.user_id || '—'}
                  </td>
                  <td style={styles.td}>{r.role || '—'}</td>
                  <td style={styles.td}>{r.action}</td>
                  <td style={styles.td}>{r.target_id || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const styles = {
  wrap: {
    minHeight: '100vh',
    background: '#16231F',
    color: '#EDEAE0',
    padding: 24,
  },
  back: {
    color: '#C9A24B',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
  },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: 22,
    color: '#C9A24B',
    margin: '0 0 14px',
  },
  muted: { color: '#A9B0A8', fontSize: 13 },
  err: { color: '#C4735A', fontSize: 13 },
  tableWrap: {
    overflowX: 'auto',
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 12,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    minWidth: 640,
  },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: '1px solid #2B3E37',
    color: '#A9B0A8',
  },
  td: { padding: '10px 8px', borderBottom: '1px solid #2B3E37' },
}