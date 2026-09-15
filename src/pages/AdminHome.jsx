import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAdminBadges } from '../lib/adminStatsService'
import { supabase } from '../lib/supabase'

export default function AdminHome() {
  const { profile, signOut } = useAuth()
  const [badges, setBadges] = useState({
    conversations: 0,
    openComplaints: 0,
    pendingPayments: 0,
    pendingSubscriptions: 0,
  })
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [b, profilesRes] = await Promise.all([
          getAdminBadges(),
          supabase
            .from('profiles')
            .select('id, full_name, email, role, status, created_at')
            .eq('role', 'user')
            .order('created_at', { ascending: false })
            .limit(20),
        ])
        if (cancelled) return
        setBadges(b)
        if (profilesRes.error) throw profilesRes.error
        setClients(profilesRes.data || [])
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e.message || 'Gagal memuat')
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
            {profile?.full_name || profile?.email} · {profile?.role}
          </p>
        </div>
        <button style={styles.logout} onClick={handleLogout}>
          Logout
        </button>
      </header>

      {error && <p style={styles.err}>{error}</p>}
      {loading && <p style={styles.muted}>Memuat...</p>}

      <div style={styles.grid}>
        <Card
          title="Chat Client"
          desc="Balas pesan client"
          to="/admin/chat"
          badge={badges.conversations}
          badgeLabel="percakapan"
        />
        <Card
          title="Keluhan"
          desc="Tangani keluhan client"
          to="/admin/complaints"
          badge={badges.openComplaints}
          badgeLabel="open / progress"
        />
        <Card
          title="Langganan"
          desc="Aktifkan / kelola subscription"
          to="/admin/subscriptions"
          badge={badges.pendingSubscriptions}
          badgeLabel="pending"
        />
        <Card
          title="Pembayaran"
          desc="Konfirmasi bukti transfer"
          to="/admin/payments"
          badge={badges.pendingPayments}
          badgeLabel="menunggu"
        />
      </div>

      <section style={styles.section}>
        <h2 style={styles.h2}>Client terbaru</h2>
        {clients.length === 0 && !loading && (
          <p style={styles.muted}>Belum ada client.</p>
        )}
        {clients.length > 0 && (
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
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td style={styles.td}>{c.full_name || '—'}</td>
                    <td style={styles.td}>{c.email || '—'}</td>
                    <td style={styles.td}>{c.status || 'active'}</td>
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
    </div>
  )
}

function Card({ title, desc, to, badge, badgeLabel }) {
  const show = Number(badge) > 0
  return (
    <Link to={to} style={styles.card}>
      <div style={styles.cardTop}>
        <h3 style={styles.cardTitle}>{title}</h3>
        {show && (
          <span style={styles.badge} title={badgeLabel}>
            {badge}
          </span>
        )}
      </div>
      <p style={styles.cardDesc}>{desc}</p>
      {show && (
        <p style={styles.badgeHint}>
          {badge} {badgeLabel}
        </p>
      )}
      <span style={styles.link}>Buka →</span>
    </Link>
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
  logout: {
    background: 'transparent',
    border: '1px solid #C4735A',
    color: '#C4735A',
    padding: '8px 14px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  muted: { color: '#A9B0A8', fontSize: 13 },
  err: { color: '#C4735A', fontSize: 13 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 14,
    marginBottom: 24,
  },
  card: {
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 16,
    textDecoration: 'none',
    color: '#EDEAE0',
    display: 'block',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    margin: 0,
    color: '#C9A24B',
    fontSize: 16,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    background: '#C4735A',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
  },
  cardDesc: {
    margin: '8px 0 0',
    color: '#A9B0A8',
    fontSize: 13,
  },
  badgeHint: {
    margin: '8px 0 0',
    fontSize: 12,
    color: '#C9A24B',
  },
  link: {
    display: 'inline-block',
    marginTop: 12,
    color: '#C9A24B',
    fontWeight: 600,
    fontSize: 13,
  },
  section: {
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 16,
  },
  h2: { margin: '0 0 12px', fontSize: 16 },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    minWidth: 480,
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
