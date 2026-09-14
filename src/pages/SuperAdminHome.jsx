import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  listAllProfiles,
  updateProfileRole,
  updateProfileStatus,
  getMaintenance,
  setMaintenance,
} from '../lib/adminService'
import {
  getPaymentAccount,
  setPaymentAccount,
} from '../lib/paymentAccountService'

export default function SuperAdminHome() {
  const { profile, user, signOut } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [maint, setMaint] = useState({
    enabled: false,
    title: 'Maintenance',
    message: 'Sistem sedang dalam perbaikan.',
    estimated_end: '',
  })
  const [payAcc, setPayAcc] = useState({
    bank_name: '',
    account_number: '',
    account_name: '',
    notes: '',
  })

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [data, m, pay] = await Promise.all([
        listAllProfiles(),
        getMaintenance(),
        getPaymentAccount(),
      ])
      setRows(data)
      setMaint({
        enabled: !!m.enabled,
        title: m.title || 'Maintenance',
        message: m.message || 'Sistem sedang dalam perbaikan.',
        estimated_end: m.estimated_end || '',
      })
      setPayAcc({
        bank_name: pay.bank_name || '',
        account_number: pay.account_number || '',
        account_name: pay.account_name || '',
        notes: pay.notes || '',
      })
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleRoleChange(id, role) {
    try {
      await updateProfileRole(id, role, user?.id)
      setMsg('Role diperbarui')
      await load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal ubah role')
    }
  }

  async function handleStatusChange(id, status) {
    try {
      await updateProfileStatus(id, status, user?.id)
      setMsg('Status diperbarui')
      await load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal ubah status')
    }
  }

  async function handleSaveMaintenance() {
    try {
      await setMaintenance(
        {
          enabled: !!maint.enabled,
          title: maint.title || 'Maintenance',
          message: maint.message || 'Sistem sedang dalam perbaikan.',
          estimated_end: maint.estimated_end || null,
        },
        user?.id
      )
      setMsg('Maintenance disimpan')
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal simpan maintenance')
    }
  }

  async function handleSavePaymentAccount() {
    try {
      await setPaymentAccount(payAcc)
      setMsg('Rekening pembayaran disimpan')
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal simpan rekening')
    }
  }

  async function handleLogout() {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Super Admin</h1>
          <p style={styles.sub}>
            {profile?.full_name || profile?.email} · role: <b>super_admin</b>
          </p>
        </div>
        <button style={styles.btn} onClick={handleLogout}>
          Logout
        </button>
      </header>

      {msg && <p style={styles.ok}>{msg}</p>}
      {error && <p style={styles.err}>{error}</p>}

      <section style={styles.section}>
        <div style={styles.sectionHead}>
          <h2 style={styles.h2}>Maintenance Mode</h2>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            fontSize: 14,
          }}
        >
          <input
            type="checkbox"
            checked={!!maint.enabled}
            onChange={(e) =>
              setMaint((p) => ({ ...p, enabled: e.target.checked }))
            }
          />
          Aktifkan maintenance (blokir user biasa)
        </label>

        <label style={styles.label}>Judul</label>
        <input
          style={styles.input}
          value={maint.title}
          onChange={(e) => setMaint((p) => ({ ...p, title: e.target.value }))}
        />

        <label style={styles.label}>Pesan</label>
        <textarea
          style={{ ...styles.input, minHeight: 70, resize: 'vertical' }}
          value={maint.message}
          onChange={(e) => setMaint((p) => ({ ...p, message: e.target.value }))}
        />

        <label style={styles.label}>Perkiraan selesai (opsional)</label>
        <input
          style={styles.input}
          value={maint.estimated_end || ''}
          onChange={(e) =>
            setMaint((p) => ({ ...p, estimated_end: e.target.value }))
          }
          placeholder="contoh: 12 Sep 2026, 18:00"
        />

        <button style={styles.saveBtn} onClick={handleSaveMaintenance}>
          Simpan Maintenance
        </button>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHead}>
          <h2 style={styles.h2}>Rekening Transfer (untuk client)</h2>
        </div>
        <p style={{ margin: '0 0 12px', color: '#A9B0A8', fontSize: 13 }}>
          Ditampilkan di halaman Langganan client saat bayar manual.
        </p>
        <label style={styles.label}>Bank</label>
        <input
          style={styles.input}
          value={payAcc.bank_name}
          onChange={(e) =>
            setPayAcc((p) => ({ ...p, bank_name: e.target.value }))
          }
          placeholder="BCA / Mandiri / BRI / ..."
        />
        <label style={styles.label}>No. rekening</label>
        <input
          style={styles.input}
          value={payAcc.account_number}
          onChange={(e) =>
            setPayAcc((p) => ({ ...p, account_number: e.target.value }))
          }
          placeholder="1234567890"
        />
        <label style={styles.label}>Atas nama</label>
        <input
          style={styles.input}
          value={payAcc.account_name}
          onChange={(e) =>
            setPayAcc((p) => ({ ...p, account_name: e.target.value }))
          }
          placeholder="Nama pemilik rekening"
        />
        <label style={styles.label}>Catatan</label>
        <textarea
          style={{ ...styles.input, minHeight: 70, resize: 'vertical' }}
          value={payAcc.notes}
          onChange={(e) => setPayAcc((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Contoh: cantumkan email akun di berita transfer"
        />
        <button style={styles.saveBtn} onClick={handleSavePaymentAccount}>
          Simpan Rekening
        </button>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHead}>
          <h2 style={styles.h2}>Semua Akun</h2>
          <span style={styles.badge}>{rows.length} akun</span>
        </div>

        {loading && <p style={styles.muted}>Memuat...</p>}

        {!loading && rows.length === 0 && (
          <p style={styles.muted}>Belum ada akun.</p>
        )}

        {!loading && rows.length > 0 && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nama</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Terdaftar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isSelf = r.id === user?.id
                  return (
                    <tr key={r.id}>
                      <td style={styles.td}>
                        {r.full_name || '—'}
                        {isSelf ? ' (kamu)' : ''}
                      </td>
                      <td style={styles.td}>{r.email || '—'}</td>
                      <td style={styles.td}>
                        <select
                          value={r.role}
                          disabled={isSelf}
                          onChange={(e) =>
                            handleRoleChange(r.id, e.target.value)
                          }
                          style={styles.select}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                          <option value="super_admin">super_admin</option>
                        </select>
                      </td>
                      <td style={styles.td}>
                        <select
                          value={r.status || 'active'}
                          disabled={isSelf}
                          onChange={(e) =>
                            handleStatusChange(r.id, e.target.value)
                          }
                          style={styles.select}
                        >
                          <option value="active">active</option>
                          <option value="inactive">inactive</option>
                          <option value="suspended">suspended</option>
                        </select>
                      </td>
                      <td style={styles.td}>
                        {r.created_at
                          ? new Date(r.created_at).toLocaleDateString('id-ID')
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h3 style={{ margin: '0 0 8px', color: '#C9A24B' }}>Activity Logs</h3>
          <p style={{ margin: '0 0 12px', color: '#A9B0A8', fontSize: 14 }}>
            Jejak aktivitas sistem
          </p>
          <a
            href="/super-admin/logs"
            style={{
              color: '#C9A24B',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            Buka Logs →
          </a>
        </div>
        <div style={styles.card}>
          <h3 style={{ margin: '0 0 8px', color: '#C9A24B' }}>Reports</h3>
          <p style={{ margin: '0 0 12px', color: '#A9B0A8', fontSize: 14 }}>
            Ringkasan user, langganan, revenue
          </p>
          <a
            href="/super-admin/reports"
            style={{
              color: '#C9A24B',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            Buka Laporan →
          </a>
        </div>
      </div>
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    margin: 0,
    fontFamily: 'Georgia, serif',
    fontSize: 26,
    color: '#C9A24B',
  },
  sub: { margin: '6px 0 0', color: '#A9B0A8', fontSize: 13 },
  btn: {
    background: 'transparent',
    border: '1px solid #C4735A',
    color: '#C4735A',
    padding: '8px 14px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  section: {
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  h2: { margin: 0, fontSize: 18 },
  badge: {
    fontSize: 12,
    background: 'rgba(201,162,75,0.15)',
    color: '#C9A24B',
    padding: '4px 10px',
    borderRadius: 999,
  },
  muted: { color: '#A9B0A8', fontSize: 14 },
  err: { color: '#C4735A', fontSize: 14, marginBottom: 10 },
  ok: { color: '#7FA37F', fontSize: 14, marginBottom: 10 },
  tableWrap: { overflowX: 'auto' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    minWidth: 560,
  },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: '1px solid #2B3E37',
    color: '#A9B0A8',
    fontWeight: 600,
  },
  td: { padding: '10px 8px', borderBottom: '1px solid #2B3E37' },
  select: {
    background: '#16231F',
    color: '#EDEAE0',
    border: '1px solid #2B3E37',
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 12,
  },
  label: {
    display: 'block',
    fontSize: 12,
    color: '#A9B0A8',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #2B3E37',
    background: '#16231F',
    color: '#EDEAE0',
    fontSize: 14,
  },
  saveBtn: {
    marginTop: 14,
    background: '#C9A24B',
    color: '#1B160A',
    border: 'none',
    borderRadius: 8,
    padding: '10px 16px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 14,
  },
  card: {
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 18,
  },
}
