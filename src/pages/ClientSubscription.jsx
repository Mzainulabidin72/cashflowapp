import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  listPlans,
  getMySubscription,
  requestSubscription,
} from '../lib/subscriptionService'
import { createPayment, listMyPayments } from '../lib/paymentService'
import { getPaymentAccount } from '../lib/paymentAccountService'
import { openMidtransPay } from '../lib/midtransService'

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

export default function ClientSubscription() {
  const { user } = useAuth()
  const [plans, setPlans] = useState([])
  const [mine, setMine] = useState(null)
  const [payments, setPayments] = useState([])
  const [payAcc, setPayAcc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [refNote, setRefNote] = useState('')
  const [method, setMethod] = useState('Transfer Bank')
  const [paying, setPaying] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [p, s, pay, acc] = await Promise.all([
        listPlans(),
        getMySubscription(user.id),
        listMyPayments(user.id),
        getPaymentAccount(),
      ])
      setPlans(p)
      setMine(s)
      setPayments(pay)
      setPayAcc(acc)
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
      setMsg('Permintaan langganan dikirim. Bayar via Midtrans atau transfer manual.')
      await load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal mengajukan langganan')
    }
  }

  async function handleMidtrans() {
    if (!mine || mine.status !== 'pending') {
      setError('Ajukan paket berbayar dulu (status pending)')
      return
    }
    setPaying(true)
    setError('')
    setMsg('')
    try {
      const result = await openMidtransPay({
        subscriptionId: mine.id,
        planId: mine.plan_id,
      })
      if (result.ok) {
        setMsg('Pembayaran berhasil. Status akan aktif setelah konfirmasi Midtrans.')
      } else if (result.pending) {
        setMsg('Pembayaran pending. Selesaikan di aplikasi bank/e-wallet.')
      } else if (result.closed) {
        setMsg('Popup ditutup. Kamu bisa bayar lagi kapan saja.')
      } else {
        setError('Pembayaran gagal / dibatalkan')
      }
      await load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal membuka Midtrans')
    } finally {
      setPaying(false)
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
                Paket aktif: <b style={{ color: '#C9A24B' }}>{activePlanName}</b>
              </div>
            </div>
          ) : mine?.status === 'pending' ? (
            <div style={{ fontSize: 14 }}>
              <div>
                Status: <b>pending</b>
              </div>
              <div style={styles.muted}>
                Paket:{' '}
                <b>
                  {mine.plan?.name ||
                    plans.find((p) => p.id === mine.plan_id)?.name ||
                    '—'}
                </b>
              </div>
              <button
                style={{ ...styles.btn, marginTop: 12, width: 'auto' }}
                onClick={handleMidtrans}
                disabled={paying}
              >
                {paying ? 'Membuka Midtrans...' : 'Bayar online (Midtrans)'}
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 14 }}>
              <div>
                Paket aktif: <b>Gratis</b>
              </div>
              <div style={styles.muted}>
                Batas 200 transaksi / bulan. Upgrade untuk unlimited.
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
              }}
            >
              <div style={styles.planName}>{p.name}</div>
              <div style={styles.planDesc}>{p.description}</div>
              <div style={styles.planPrice}>
                {Number(p.price) === 0 ? 'Gratis' : rupiah(p.price)}
              </div>
              <button
                style={{
                  ...styles.btn,
                  opacity: planButtonDisabled(p) ? 0.65 : 1,
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

      {payAcc && (payAcc.bank_name || payAcc.account_number) && (
        <div style={{ ...styles.card, marginTop: 18 }}>
          <h3 style={styles.h3}>Atau transfer manual</h3>
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>
            <div>
              Bank: <b>{payAcc.bank_name || '—'}</b>
            </div>
            <div>
              No. rek: <b>{payAcc.account_number || '—'}</b>
            </div>
            <div>
              a/n: <b>{payAcc.account_name || '—'}</b>
            </div>
            {payAcc.notes ? (
              <div style={{ ...styles.muted, marginTop: 8 }}>{payAcc.notes}</div>
            ) : null}
          </div>
        </div>
      )}

      <div style={{ ...styles.card, marginTop: 18 }}>
        <h3 style={styles.h3}>Kirim bukti (manual)</h3>
        <form onSubmit={handleSubmitPayment}>
          <label style={styles.label}>Metode</label>
          <input
            style={styles.input}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          />
          <label style={styles.label}>Catatan / No. referensi</label>
          <input
            style={styles.input}
            value={refNote}
            onChange={(e) => setRefNote(e.target.value)}
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
                {p.provider || 'manual'}
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
    minHeight: 220,
  },
  planName: { color: '#C9A24B', fontWeight: 700, fontSize: 16 },
  planDesc: {
    fontSize: 13,
    color: '#A9B0A8',
    margin: '8px 0',
    flex: 1,
  },
  planPrice: { fontSize: 18, fontWeight: 700, marginBottom: 10 },
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
