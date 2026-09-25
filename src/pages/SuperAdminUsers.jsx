import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import SuperAdminShell from '../components/super/SuperAdminShell'
import {
  listAllProfiles,
  updateProfileRole,
  updateProfileStatus,
} from '../lib/adminService'

export default function SuperAdminUsers() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [roleF, setRoleF] = useState('all')
  const [statusF, setStatusF] = useState('all')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setRows(await listAllProfiles())
    } catch (e) {
      setError(e.message || 'Gagal memuat users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (roleF !== 'all' && r.role !== roleF) return false
      if (statusF !== 'all' && (r.status || 'active') !== statusF) return false
      if (!q.trim()) return true
      const s = q.toLowerCase()
      return (
        (r.full_name || '').toLowerCase().includes(s) ||
        (r.email || '').toLowerCase().includes(s)
      )
    })
  }, [rows, q, roleF, statusF])

  async function setRole(id, role) {
    if (!confirm(`Ubah role menjadi ${role}?`)) return
    try {
      await updateProfileRole(id, role, user?.id)
      setMsg('Role diperbarui')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function setStatus(id, status) {
    if (!confirm(`Ubah status menjadi ${status}?`)) return
    try {
      await updateProfileStatus(id, status, user?.id)
      setMsg('Status diperbarui')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <SuperAdminShell title="Users">
      <p className="sa-muted" style={{ marginTop: 0 }}>
        Kelola akun Lanila — role, status, dan akses produk.
      </p>
      {msg && <p className="sa-ok">{msg}</p>}
      {error && <p className="sa-err">{error}</p>}

      <div
        className="sa-card"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}
      >
        <input
          className="sa-input"
          style={{ flex: '1 1 200px', maxWidth: 280 }}
          placeholder="Cari nama / email..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="sa-select" style={{ width: 140 }} value={roleF} onChange={(e) => setRoleF(e.target.value)}>
          <option value="all">Semua role</option>
          <option value="user">user</option>
          <option value="admin">admin</option>
          <option value="super_admin">super_admin</option>
        </select>
        <select className="sa-select" style={{ width: 140 }} value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="all">Semua status</option>
          <option value="active">active</option>
          <option value="suspended">suspended</option>
        </select>
      </div>

      {loading && <p className="sa-muted">Memuat...</p>}

      <div className="sa-card">
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="sa-muted">
                    No users found.
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.full_name || '—'}</div>
                    <div className="sa-muted">{r.email}</div>
                  </td>
                  <td>{r.role}</td>
                  <td>{r.status || 'active'}</td>
                  <td className="sa-muted">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString('id-ID')
                      : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <select
                        className="sa-select"
                        style={{ width: 120 }}
                        value={r.role}
                        onChange={(e) => setRole(r.id, e.target.value)}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                        <option value="super_admin">super_admin</option>
                      </select>
                      {(r.status || 'active') === 'active' ? (
                        <button
                          type="button"
                          className="sa-btn sa-btn-danger"
                          onClick={() => setStatus(r.id, 'suspended')}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="sa-btn sa-btn-primary"
                          onClick={() => setStatus(r.id, 'active')}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SuperAdminShell>
  )
}
