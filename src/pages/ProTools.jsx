import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserPlanInfo } from '../lib/planAccess'
import { listWallets, createWallet, deleteWallet, walletBalance } from '../lib/walletService'
import { listDebts, createDebt, updateDebt, deleteDebt, remaining } from '../lib/debtService'
import { simpleForecast } from '../lib/predictionService'
import { exportSummaryPdf } from '../lib/exportPdf'
import { loadTransactions } from '../lib/dataService'

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

export default function ProTools() {
  const { user } = useAuth()
  const [plan, setPlan] = useState(null)
  const [wallets, setWallets] = useState([])
  const [debts, setDebts] = useState([])
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const [wName, setWName] = useState('')
  const [wType, setWType] = useState('cash')
  const [wStart, setWStart] = useState('0')

  const [dKind, setDKind] = useState('debt')
  const [dPerson, setDPerson] = useState('')
  const [dAmount, setDAmount] = useState('')
  const [dDue, setDDue] = useState('')

  const allowed = plan?.canUseProTools === true

  async function reload() {
    const [p, w, d, t] = await Promise.all([
      getUserPlanInfo(user.id),
      listWallets(user.id),
      listDebts(user.id),
      loadTransactions(user.id),
    ])
    setPlan(p)
    setWallets(w)
    setDebts(d)
    setTxs(t)
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await reload()
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e.message || 'Gagal memuat')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const forecast = useMemo(() => simpleForecast(txs, 3), [txs])

  async function addWallet(e) {
    e.preventDefault()
    if (!allowed) return
    try {
      await createWallet(user.id, {
        name: wName,
        type: wType,
        balance_start: wStart,
      })
      setWName('')
      setWStart('0')
      setMsg('Dompet ditambah')
      await reload()
    } catch (e) {
      setError(e.message)
    }
  }

  async function removeWallet(id) {
    if (!confirm('Hapus dompet ini?')) return
    try {
      await deleteWallet(user.id, id)
      await reload()
    } catch (e) {
      setError(e.message)
    }
  }

  async function addDebt(e) {
    e.preventDefault()
    if (!allowed) return
    try {
      await createDebt(user.id, {
        kind: dKind,
        person: dPerson,
        amount: dAmount,
        due_date: dDue || null,
      })
      setDPerson('')
      setDAmount('')
      setDDue('')
      setMsg('Utang/piutang ditambah')
      await reload()
    } catch (e) {
      setError(e.message)
    }
  }

  async function markPaid(d) {
    try {
      await updateDebt(user.id, d.id, {
        paid: d.amount,
        status: 'paid',
      })
      await reload()
    } catch (e) {
      setError(e.message)
    }
  }

  function doPdf() {
    if (!allowed) return
    const lines = [
      { label: 'Paket', value: plan?.planName || 'Pro' },
      { label: 'Rata-rata pemasukan / bln', value: rupiah(forecast.avgIncome) },
      { label: 'Rata-rata pengeluaran / bln', value: rupiah(forecast.avgExpense) },
      { label: 'Rata-rata neto / bln', value: rupiah(forecast.avgNet) },
      ...forecast.months.map((m) => ({
        label: `Prediksi ${m.month}`,
        value: `In ${rupiah(m.income)} / Out ${rupiah(m.expense)} / Net ${rupiah(m.net)}`,
      })),
      ...debts.map((d) => ({
        label: `${d.kind === 'debt' ? 'Utang' : 'Piutang'} · ${d.person}`,
        value: `${rupiah(remaining(d))} sisa`,
      })),
    ]
    exportSummaryPdf({ title: 'Laporan Pro Cash Flow', lines })
  }

  if (loading) {
    return (
      <div style={styles.wrap}>
        <p style={styles.muted}>Memuat...</p>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div style={styles.wrap}>
        <Link to="/dashboard" style={styles.back}>
          ← Dashboard
        </Link>
        <h2 style={styles.title}>Fitur Pro</h2>
        <div style={styles.card}>
          <p>
            Multi-wallet, utang/piutang, prediksi, dan export PDF khusus paket{' '}
            <b>Pro / Tahunan</b>.
          </p>
          <Link to="/subscription" style={styles.link}>
            Upgrade langganan →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.wrap}>
      <Link to="/dashboard" style={styles.back}>
        ← Dashboard
      </Link>
      <h2 style={styles.title}>Tools Pro</h2>
      {msg && <p style={styles.ok}>{msg}</p>}
      {error && <p style={styles.err}>{error}</p>}

      {/* Wallets */}
      <section style={styles.card}>
        <h3 style={styles.h3}>Multi-wallet / rekening</h3>
        <form onSubmit={addWallet} style={styles.formRow}>
          <input
            style={styles.input}
            placeholder="Nama dompet"
            value={wName}
            onChange={(e) => setWName(e.target.value)}
            required
          />
          <select
            style={styles.input}
            value={wType}
            onChange={(e) => setWType(e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="ewallet">E-Wallet</option>
            <option value="other">Lainnya</option>
          </select>
          <input
            style={styles.input}
            type="number"
            placeholder="Saldo awal"
            value={wStart}
            onChange={(e) => setWStart(e.target.value)}
          />
          <button style={styles.btn} type="submit">
            Tambah
          </button>
        </form>
        {wallets.length === 0 && (
          <p style={styles.muted}>Belum ada dompet.</p>
        )}
        {wallets.map((w) => (
          <div key={w.id} style={styles.rowItem}>
            <div>
              <b>{w.name}</b>
              <span style={styles.muted}> · {w.type}</span>
              <div style={{ marginTop: 4 }}>
                Saldo: <b>{rupiah(walletBalance(w, txs))}</b>
              </div>
            </div>
            <button style={styles.btnGhost} type="button" onClick={() => removeWallet(w.id)}>
              Hapus
            </button>
          </div>
        ))}
        <p style={{ ...styles.muted, marginTop: 8, fontSize: 12 }}>
          Tip: set field wallet_id di transaksi (opsional) agar saldo dompet terhitung.
        </p>
      </section>

      {/* Debts */}
      <section style={{ ...styles.card, marginTop: 16 }}>
        <h3 style={styles.h3}>Utang & piutang</h3>
        <form onSubmit={addDebt} style={styles.formRow}>
          <select
            style={styles.input}
            value={dKind}
            onChange={(e) => setDKind(e.target.value)}
          >
            <option value="debt">Utang (saya berhutang)</option>
            <option value="receivable">Piutang (orang berhutang ke saya)</option>
          </select>
          <input
            style={styles.input}
            placeholder="Nama orang"
            value={dPerson}
            onChange={(e) => setDPerson(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="number"
            placeholder="Jumlah"
            value={dAmount}
            onChange={(e) => setDAmount(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="date"
            value={dDue}
            onChange={(e) => setDDue(e.target.value)}
          />
          <button style={styles.btn} type="submit">
            Tambah
          </button>
        </form>
        {debts.map((d) => (
          <div key={d.id} style={styles.rowItem}>
            <div>
              <b>{d.kind === 'debt' ? 'Utang' : 'Piutang'}</b> · {d.person}
              <div style={{ marginTop: 4 }}>
                Sisa {rupiah(remaining(d))} / {rupiah(d.amount)}
                {d.due_date ? ` · jatuh tempo ${d.due_date}` : ''}
                {d.status === 'paid' ? ' · lunas' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {d.status !== 'paid' && (
                <button style={styles.btnGhost} type="button" onClick={() => markPaid(d)}>
                  Lunas
                </button>
              )}
              <button
                style={styles.btnGhost}
                type="button"
                onClick={async () => {
                  await deleteDebt(user.id, d.id)
                  await reload()
                }}
              >
                Hapus
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Forecast */}
      <section style={{ ...styles.card, marginTop: 16 }}>
        <h3 style={styles.h3}>Prediksi cash flow (sederhana)</h3>
        {forecast.message ? (
          <p style={styles.muted}>{forecast.message}</p>
        ) : (
          <>
            <p style={styles.muted}>
              Berdasarkan {forecast.basedOn} bulan terakhir
            </p>
            <div style={styles.grid3}>
              <div>
                <div style={styles.muted}>Avg pemasukan</div>
                <b>{rupiah(forecast.avgIncome)}</b>
              </div>
              <div>
                <div style={styles.muted}>Avg pengeluaran</div>
                <b>{rupiah(forecast.avgExpense)}</b>
              </div>
              <div>
                <div style={styles.muted}>Avg neto</div>
                <b>{rupiah(forecast.avgNet)}</b>
              </div>
            </div>
            <ul style={{ marginTop: 12, paddingLeft: 18 }}>
              {forecast.months.map((m) => (
                <li key={m.month} style={{ marginBottom: 6 }}>
                  {m.month}: neto prediksi <b>{rupiah(m.net)}</b>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* PDF */}
      <section style={{ ...styles.card, marginTop: 16 }}>
        <h3 style={styles.h3}>Export PDF</h3>
        <p style={styles.muted}>
          Cetak / simpan PDF ringkasan prediksi + utang (dialog print browser).
        </p>
        <button style={styles.btn} type="button" onClick={doPdf}>
          Export PDF laporan Pro
        </button>
      </section>
    </div>
  )
}

const styles = {
  wrap: {
    minHeight: '100vh',
    background: '#16231F',
    color: '#EDEAE0',
    padding: 20,
    maxWidth: 900,
    margin: '0 auto',
  },
  back: {
    color: '#C9A24B',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
  },
  title: {
    fontFamily: 'Georgia, serif',
    color: '#C9A24B',
    fontSize: 22,
    margin: '10px 0 14px',
  },
  h3: { margin: '0 0 12px', fontSize: 15, color: '#C9A24B' },
  muted: { color: '#A9B0A8', fontSize: 13 },
  ok: { color: '#7FA37F', fontSize: 13 },
  err: { color: '#C4735A', fontSize: 13 },
  card: {
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 16,
  },
  formRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: '1 1 120px',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #2B3E37',
    background: '#16231F',
    color: '#EDEAE0',
    fontSize: 13,
  },
  btn: {
    background: '#C9A24B',
    color: '#1B160A',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnGhost: {
    background: 'transparent',
    border: '1px solid #2B3E37',
    color: '#EDEAE0',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 12,
  },
  rowItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    padding: '10px 0',
    borderTop: '1px solid #2B3E37',
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    marginTop: 8,
  },
  link: { color: '#C9A24B', fontWeight: 600 },
}
