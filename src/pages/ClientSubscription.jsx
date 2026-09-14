import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  listPlans,
  getMySubscription,
  requestSubscription,
} from '../lib/subscriptionService'
import { createPayment, listMyPayments } from '../lib/paymentService'

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

export default function ClientSubscription() {
  const { user } = useAuth()
  const [plans, setPlans] = useState([])
  const [mine, setMine] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [refNote, setRefNote] = useState('')
  const [method, setMethod] = useState('Transfer Bank')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [p, s, pay] = await Promise.all([
        listPlans(),
        getMySubscription(user.id),
        listMyPayments(user.id),
      ])
      setPlans(p)
      setMine(s)
      setPayments(pay)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal memuat')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) load()
  }, [user])

  async function handleRequest(planId, price) {
    if (Number(price) === 0) return
    setMsg('')
    setError('')
    try {
      await requestSubscription(user.id, planId)
      setMsg(
        'Permintaan langganan dikirim. Silakan transfer lalu kirim bukti di bawah.'
      )
      await load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal mengajukan langganan')
    }
  }

  async function handleSubmitPayment(e) {
    e.preventDefault()
    if (!mine || mine.status !== 'pending') {
      setError('Ajukan paket berbayar dulu (status pending) sebelum kirim bukti')
      return
    }
    const plan = plans.find((p) => p.id === mine.plan_id) || mine.plan
    try {
      await createPayment({
        subscriptionId: mine.id,
        userId: user.id,
        amount: plan?.price || 0,
        paymentMethod: `${method}${refNote ? ' | ' + refNote : ''}`,
        note: refNote,
      })
      setMsg('Bukti/pembayaran dicatat. Menunggu konfirmasi admin.')
      setRefNote('')
      await load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal kirim pembayaran')
    }
  }

  const activePlanName =
    mine?.status === 'active'
      ? mine.plan?.name ||
        plans.find((p) => p.id === mine.plan_id)?.name ||
        'Paket berbayar'
      : null

  function planButtonLabel(plan) {
    if (Number(plan.price) === 0) {
      if (mine?.status === 'active') return 'Bukan paket aktif'
      return 'Paket default (Gratis)'
    }
    if (!mine) return 'Ajukan langganan'

    const isThis = mine.plan_id === plan.id

    if (mine.status === 'active' && isThis) return '✓ Paket aktif'
    if (mine.status === 'active' && !isThis) return 'Ganti ke paket ini'
    if (mine.status === 'pending' && isThis) return 'Menunggu konfirmasi'
    if (mine.status === 'pending' && !isThis) return 'Sedang ada pengajuan'
    return 'Ajukan langganan'
  }

  function planButtonDisabled(plan) {
    if (Number(plan.price) === 0) return true
    if (mine?.status === 'pending' && mine.plan_id !== plan.id) return true
    if (mine?.status === 'active' && mine.plan_id === plan.id) return true
    return false
  }

  return (
    <div style={styles.wrap}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/dashboard" style={styles.back}>
          ← Kembali ke Dashboard
        </Link>
      </div>

      <h2 style={styles.title}>Langganan</h2>
      {msg && <p style={styles.ok}>{msg}</p>}
      {error && <p style={styles.err}>{error}</p>}
      {loading && <p style={styles.muted}>Memuat...</p>}

      {!loading && (
        <div style={styles.card}>
          <h3 style={styles.h3}>Status kamu</h3>
          {mine?.status === 'active' ? (
            <div style={{ fontSize: 14 }}>
              <div>
                Status: <b style={{ color: '#7FA37F' }}>active</b>
              </div>
              <div style={{ marginTop: 4 }}>
                Paket aktif:{' '}
                <b style={{ color: '#C9A24B' }}>{activePlanName}</b>
              </div>
              {mine.starts_at && (
                <div style={styles.muted}>
                  Mulai: {new Date(mine.starts_at).toLocaleDateString('id-ID')}
                </div>
              )}
              {mine.ends_at && (
                <div style={styles.muted}>
                  Berakhir: {new Date(mine.ends_at).toLocaleDateString('id-ID')}
                </div>
              )}
            </div>
          ) : mine?.status === 'pending' ? (
            <div style={{ fontSize: 14 }}>
              <div>
                Status: <b>pending</b> (menunggu bayar/konfirmasi)
              </div>
              <div style={styles.muted}>
                Paket diajukan:{' '}
                <b>
                  {mine.plan?.name ||
                    plans.find((p) => p.id === mine.plan_id)?.name ||
                    '—'}
                </b>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 14 }}>
              <div>
                Paket aktif: <b>Gratis</b>
              </div>
              <div style={styles.muted}>
                Batas 200 transaksi per bulan. Upgrade untuk unlimited.
              </div>
            </div>
          )}
        </div>
      )}

      <h3 style={{ ...styles.h3, marginTop: 18 }}>Paket tersedia</h3>
      <div style={styles.grid}>
        {plans.map((p) => {
          const isThisActive =
            mine?.status === 'active' && mine?.plan_id === p.id
          const isFreeDefault =
            Number(p.price) === 0 && mine?.status !== 'active'

          return (
            <div
              key={p.id}
              style={{
                ...styles.plan,
                borderColor:
                  isThisActive || isFreeDefault ? '#C9A24B' : '#2B3E37',
                boxShadow: isThisActive
                  ? '0 0 0 1px rgba(201,162,75,0.4)'
                  : 'none',
              }}
            >
              {isThisActive && (
                <div style={styles.badgeActive}>● SEDANG AKTIF</div>
              )}
              <div style={styles.planName}>{p.name}</div>
              <div style={styles.planDesc}>{p.description}</div>
              <div style={styles.planPrice}>
                {Number(p.price) === 0 ? 'Gratis' : rupiah(p.price)}
              </div>
              <div style={{ ...styles.muted, marginBottom: 12 }}>
                {Number(p.price) === 0
                  ? '200 transaksi / bulan'
                  : `${p.duration_days} hari`}
              </div>
              <button
                style={{
                  ...styles.btn,
                  opacity: planButtonDisabled(p) ? 0.65 : 1,
                  background: isThisActive ? '#7FA37F' : '#C9A24B',
                }}
                onClick={() => handleRequest(p.id, p.price)}
                disabled={planButtonDisabled(p)}
              >
                {planButtonLabel(p)}
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ ...styles.card, marginTop: 18 }}>
        <h3 style={styles.h3}>Kirim bukti pembayaran (manual)</h3>
        <p style={styles.muted}>
          Hanya untuk pengajuan berbayar (status pending). Transfer ke rekening
          admin, lalu isi catatan/referensi.
        </p>
        <form onSubmit={handleSubmitPayment}>
          <label style={styles.label}>Metode</label>
          <input
            style={styles.input}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder="Transfer Bank / E-Wallet"
          />
          <label style={styles.label}>Catatan / No. referensi</label>
          <input
            style={styles.input}
            value={refNote}
            onChange={(e) => setRefNote(e.target.value)}
            placeholder="Contoh: TRX123 dari BCA a/n Budi"
          />
          <button style={{ ...styles.btn, marginTop: 12 }} type="submit">
            Kirim bukti
          </button>
        </form>

        {payments.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Riwayat bayar</h4>
            {payments.map((p) => (
              <div
                key={p.id}
                style={{ fontSize: 13, marginBottom: 6, color: '#A9B0A8' }}
              >
                {rupiah(p.amount)} · {p.status} · {p.payment_method || '-'} ·{' '}
                {p.created_at
                  ? new Date(p.created_at).toLocaleString('id-ID')
                  : ''}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  wrap: { maxWidth: 900, margin: '0 auto', color: '#EDEAE0' },
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
  h3: { margin: '0 0 10px', fontSize: 15 },
  muted: { color: '#A9B0A8', fontSize: 13 },
  ok: { color: '#7FA37F', fontSize: 13 },
  err: { color: '#C4735A', fontSize: 13 },
  card: {
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 16,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 12,
    alignItems: 'stretch',
  },
  plan: {
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 280,
  },
  badgeActive: {
    fontSize: 11,
    color: '#C9A24B',
    fontWeight: 700,
    marginBottom: 6,
  },
  planName: {
    color: '#C9A24B',
    fontWeight: 700,
    fontSize: 16,
  },
  planDesc: {
    fontSize: 13,
    color: '#A9B0A8',
    margin: '8px 0',
    flex: 1,
    lineHeight: 1.45,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 6,
  },
  btn: {
    marginTop: 'auto',
    width: '100%',
    background: '#C9A24B',
    color: '#1B160A',
    border: 'none',
    borderRadius: 8,
    padding: '10px 12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  label: {
    display: 'block',
    fontSize: 12,
    color: '#A9B0A8',
    marginTop: 10,
    marginBottom: 4,
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
}