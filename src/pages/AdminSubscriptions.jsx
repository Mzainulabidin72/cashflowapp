import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  listAllSubscriptions,
  activateSubscription,
  updateSubscriptionStatus,
} from '../lib/subscriptionService'

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

export default function AdminSubscriptions() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await listAllSubscriptions()
      setRows(data)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal memuat')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleActivate(row) {
    try {
      await activateSubscription(
        row.id,
        row.plan?.duration_days || 30,
        user?.id
      )
      setMsg('Langganan diaktifkan')
      await load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal mengaktifkan')
    }
  }

  async function handleCancel(id) {
    try {
      await updateSubscriptionStatus(id, 'cancelled')
      setMsg('Langganan dibatalkan')
      await load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal membatalkan')
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/admin" style={styles.back}>
          ← Kembali ke Admin
        </Link>
      </div>

      <h2 style={styles.title}>Langganan Client</h2>
      {msg && <p style={styles.ok}>{msg}</p>}
      {error && <p style={styles.err}>{error}</p>}
      {loading && <p style={styles.muted}>Memuat...</p>}

      {!loading && rows.length === 0 && (
        <p style={styles.muted}>Belum ada permintaan langganan.</p>
      )}

      {!loading && rows.length > 0 && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Client</th>
                <th style={styles.th}>Paket</th>
                <th style={styles.th}>Harga</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={styles.td}>
                    {r.profile?.full_name || r.profile?.email || '—'}
                  </td>
                  <td style={styles.td}>{r.plan?.name || '—'}</td>
                  <td style={styles.td}>{rupiah(r.plan?.price)}</td>
                  <td style={styles.td}>{r.status}</td>
                  <td style={styles.td}>
                    {r.status === 'pending' && (
                      <button
                        style={styles.btn}
                        onClick={() => handleActivate(r)}
                      >
                        Aktifkan
                      </button>
                    )}
                    {(r.status === 'pending' || r.status === 'active') && (
                      <button
                        style={styles.btnGhost}
                        onClick={() => handleCancel(r.id)}
                      >
                        Batalkan
                      </button>
                    )}
                  </td>
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
    color: '#EDEAE0',
  },
  back: {
    color: '#C9A24B',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
  },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: 20,
    color: '#C9A24B',
    margin: '0 0 14px',
  },
  muted: {
    color: '#A9B0A8',
    fontSize: 13,
  },
  ok: {
    color: '#7FA37F',
    fontSize: 13,
  },
  err: {
    color: '#C4735A',
    fontSize: 13,
  },
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
    minWidth: 560,
  },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: '1px solid #2B3E37',
    color: '#A9B0A8',
  },
  td: {
    padding: '10px 8px',
    borderBottom: '1px solid #2B3E37',
  },
  btn: {
    background: '#C9A24B',
    color: '#1B160A',
    border: 'none',
    borderRadius: 6,
    padding: '6px 10px',
    fontWeight: 600,
    cursor: 'pointer',
    marginRight: 6,
  },
  btnGhost: {
    background: 'transparent',
    color: '#C4735A',
    border: '1px solid #C4735A',
    borderRadius: 6,
    padding: '6px 10px',
    cursor: 'pointer',
  },
}