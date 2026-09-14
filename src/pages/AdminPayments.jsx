import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listAllPayments, markPaymentPaid } from '../lib/paymentService'
import {
  listAllSubscriptions,
  activateSubscription,
} from '../lib/subscriptionService'

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

export default function AdminPayments() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [payments, subscriptions] = await Promise.all([
        listAllPayments(),
        listAllSubscriptions(),
      ])
      setRows(payments)
      setSubs(subscriptions)
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

  function findSub(subscriptionId) {
    return subs.find((s) => s.id === subscriptionId)
  }

  async function handleConfirm(payment) {
    try {
      await markPaymentPaid(payment.id, user?.id)

      const sub = findSub(payment.subscription_id)
      if (sub && sub.status === 'pending') {
        await activateSubscription(
          sub.id,
          sub.plan?.duration_days || 30,
          user?.id
        )
      }

      setMsg('Pembayaran dikonfirmasi & langganan diaktifkan (jika pending)')
      await load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal konfirmasi')
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/admin" style={styles.back}>
          ← Kembali ke Admin
        </Link>
      </div>

      <h2 style={styles.title}>Konfirmasi Pembayaran</h2>
      {msg && <p style={styles.ok}>{msg}</p>}
      {error && <p style={styles.err}>{error}</p>}
      {loading && <p style={styles.muted}>Memuat...</p>}

      {!loading && rows.length === 0 && (
        <p style={styles.muted}>Belum ada data pembayaran.</p>
      )}

      {!loading && rows.length > 0 && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Client</th>
                <th style={styles.th}>Jumlah</th>
                <th style={styles.th}>Metode / Catatan</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Waktu</th>
                <th style={styles.th}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={styles.td}>
                    {r.profile?.full_name || r.profile?.email || '—'}
                  </td>
                  <td style={styles.td}>{rupiah(r.amount)}</td>
                  <td style={styles.td}>{r.payment_method || '—'}</td>
                  <td style={styles.td}>{r.status}</td>
                  <td style={styles.td}>
                    {r.created_at
                      ? new Date(r.created_at).toLocaleString('id-ID')
                      : '—'}
                  </td>
                  <td style={styles.td}>
                    {r.status === 'pending' && (
                      <button
                        style={styles.btn}
                        onClick={() => handleConfirm(r)}
                      >
                        Konfirmasi & Aktifkan
                      </button>
                    )}
                    {r.status === 'paid' && (
                      <span style={{ color: '#7FA37F', fontSize: 12 }}>Lunas</span>
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
  wrap: { color: '#EDEAE0' },
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
  muted: { color: '#A9B0A8', fontSize: 13 },
  ok: { color: '#7FA37F', fontSize: 13 },
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
  btn: {
    background: '#C9A24B',
    color: '#1B160A',
    border: 'none',
    borderRadius: 6,
    padding: '6px 10px',
    fontWeight: 600,
    cursor: 'pointer',
  },
}