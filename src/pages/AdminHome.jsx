import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listClients } from '../lib/adminService'

export default function AdminHome() {
  const { profile, signOut } = useAuth()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await listClients()
        if (!cancelled) setClients(data)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e.message || 'Gagal memuat client')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogout() {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Admin Panel</h1>
          <p style={styles.sub}>
            {profile?.full_name || profile?.email} · role: <b>admin</b>
          </p>
        </div>
        <button style={styles.btn} onClick={handleLogout}>
          Logout
        </button>
      </header>

      <section style={styles.section}>
        <div style={styles.sectionHead}>
          <h2 style={styles.h2}>Daftar Client</h2>
          <span style={styles.badge}>{clients.length} client</span>
        </div>

        {loading && <p style={styles.muted}>Memuat...</p>}
        {error && <p style={styles.err}>{error}</p>}

        {!loading && !error && clients.length === 0 && (
          <p style={styles.muted}>Belum ada client terdaftar.</p>
        )}

        {!loading && clients.length > 0 && (
          <div style={styles.tableWrap}>
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
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td style={styles.td}>{c.full_name || '—'}</td>
                    <td style={styles.td}>{c.email || '—'}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.status,
                          background:
                            c.status === 'active'
                              ? 'rgba(127,163,127,0.2)'
                              : 'rgba(196,115,90,0.2)',
                          color: c.status === 'active' ? '#7FA37F' : '#C4735A',
                        }}
                      >
                        {c.status || 'active'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {c.created_at
                        ? new Date(c.created_at).toLocaleDateString('id-ID')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h3 style={{ margin: '0 0 8px', color: '#C9A24B' }}>Chat</h3>
          <p style={{ margin: '0 0 12px', color: '#A9B0A8', fontSize: 14 }}>
            Balas chat dari client
          </p>
          <Link to="/admin/chat" style={styles.link}>
            Buka Chat →
          </Link>
        </div>

        <div style={styles.card}>
          <h3 style={{ margin: '0 0 8px', color: '#C9A24B' }}>Complaints</h3>
          <p style={{ margin: '0 0 12px', color: '#A9B0A8', fontSize: 14 }}>
            Keluhan client
          </p>
          <Link to="/admin/complaints" style={styles.link}>
            Buka Keluhan →
          </Link>
        </div>

        <div style={styles.card}>
          <h3 style={{ margin: '0 0 8px', color: '#C9A24B' }}>Subscriptions</h3>
          <p style={{ margin: '0 0 12px', color: '#A9B0A8', fontSize: 14 }}>
            Langganan client
          </p>
          <Link to="/admin/subscriptions" style={styles.link}>
            Buka Langganan →
          </Link>
        </div>

        <div style={styles.card}>
          <h3 style={{ margin: '0 0 8px', color: '#C9A24B' }}>Payments</h3>
          <p style={{ margin: '0 0 12px', color: '#A9B0A8', fontSize: 14 }}>
            Konfirmasi pembayaran client
          </p>
          <Link to="/admin/payments" style={styles.link}>
            Buka Pembayaran →
          </Link>
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
    marginBottom: 28,
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
  h2: { margin: 0, fontSize: 18, color: '#EDEAE0' },
  badge: {
    fontSize: 12,
    background: 'rgba(201,162,75,0.15)',
    color: '#C9A24B',
    padding: '4px 10px',
    borderRadius: 999,
  },
  muted: { color: '#A9B0A8', fontSize: 14 },
  err: { color: '#C4735A', fontSize: 14 },
  tableWrap: { overflowX: 'auto' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    minWidth: 480,
  },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: '1px solid #2B3E37',
    color: '#A9B0A8',
    fontWeight: 600,
  },
  td: { padding: '10px 8px', borderBottom: '1px solid #2B3E37' },
  status: {
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 999,
    textTransform: 'capitalize',
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
  link: {
    color: '#C9A24B',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 14,
  },
}