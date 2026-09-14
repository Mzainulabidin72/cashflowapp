import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSuperAdminReport } from '../lib/reportService'

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

export default function SuperAdminReports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const r = await getSuperAdminReport()
        if (!cancelled) setData(r)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e.message || 'Gagal memuat laporan')
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

      <h2 style={styles.title}>Laporan Sistem</h2>
      {error && <p style={styles.err}>{error}</p>}
      {loading && <p style={styles.muted}>Memuat...</p>}

      {!loading && data && (
        <>
          <div style={styles.grid}>
            <Stat label="Total akun" value={data.totalProfiles} />
            <Stat label="User (client)" value={data.totalUsers} />
            <Stat label="Admin" value={data.totalAdmins} />
            <Stat label="Super admin" value={data.totalSuperAdmins} />
            <Stat label="User aktif" value={data.usersActive} />
            <Stat label="Langganan aktif" value={data.subsActive} />
            <Stat label="Langganan pending" value={data.subsPending} />
            <Stat label="Pembayaran lunas" value={data.paymentsPaid} />
            <Stat label="Pembayaran pending" value={data.paymentsPending} />
            <Stat label="Revenue lunas" value={rupiah(data.revenuePaid)} />
            <Stat label="Revenue pending" value={rupiah(data.revenuePending)} />
          </div>

          <div style={styles.card}>
            <h3 style={styles.h3}>Langganan aktif per paket</h3>
            {Object.keys(data.byPlan).length === 0 ? (
              <p style={styles.muted}>Belum ada langganan aktif.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {Object.entries(data.byPlan).map(([name, count]) => (
                  <li key={name} style={{ marginBottom: 6 }}>
                    {name}: <b>{count}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ ...styles.card, marginTop: 16 }}>
            <h3 style={styles.h3}>User terbaru</h3>
            {data.recentUsers.length === 0 ? (
              <p style={styles.muted}>Belum ada user.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Nama</th>
                      <th style={styles.th}>Email</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Terdaftar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentUsers.map((u) => (
                      <tr key={u.id}>
                        <td style={styles.td}>{u.full_name || '—'}</td>
                        <td style={styles.td}>{u.email || '—'}</td>
                        <td style={styles.td}>{u.status || 'active'}</td>
                        <td style={styles.td}>
                          {u.created_at
                            ? new Date(u.created_at).toLocaleDateString('id-ID')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ ...styles.card, marginTop: 16 }}>
            <h3 style={styles.h3}>Pembayaran terbaru</h3>
            {data.recentPayments.length === 0 ? (
              <p style={styles.muted}>Belum ada pembayaran.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Jumlah</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentPayments.map((p) => (
                      <tr key={p.id}>
                        <td style={styles.td}>{rupiah(p.amount)}</td>
                        <td style={styles.td}>{p.status}</td>
                        <td style={styles.td}>
                          {p.created_at
                            ? new Date(p.created_at).toLocaleString('id-ID')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
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
    margin: '0 0 16px',
  },
  muted: { color: '#A9B0A8', fontSize: 13 },
  err: { color: '#C4735A', fontSize: 13 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
    marginBottom: 18,
  },
  stat: {
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 14,
  },
  statLabel: { fontSize: 12, color: '#A9B0A8', marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: 700, color: '#C9A24B' },
  card: {
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 16,
  },
  h3: { margin: '0 0 12px', fontSize: 15 },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    minWidth: 400,
  },
  th: {
    textAlign: 'left',
    padding: '8px 6px',
    borderBottom: '1px solid #2B3E37',
    color: '#A9B0A8',
  },
  td: {
    padding: '8px 6px',
    borderBottom: '1px solid #2B3E37',
  },
}
