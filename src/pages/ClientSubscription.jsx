import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  listPlans,
  getMySubscription,
  requestSubscription,
} from '../lib/subscriptionService'
import { createPayment, listMyPayments } from '../lib/paymentService'
import { getPaymentAccount } from '../lib/paymentAccountService'

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function isAnnual(plan) {
  const n = String(plan?.name || '').toLowerCase()
  const d = Number(plan?.duration_days) || 0
  return n.includes('tahun') || n.includes('annual') || d >= 300
}

function isFree(plan) {
  return Number(plan?.price) === 0
}

function statusLabel(mine) {
  if (!mine) return { key: 'free', label: 'Gratis', hint: 'default' }
  const s = String(mine.status || '').toLowerCase()
  if (s === 'active') return { key: 'active', label: 'Aktif', hint: 'ok' }
  if (s === 'pending') return { key: 'pending', label: 'Menunggu pembayaran / verifikasi', hint: 'wait' }
  if (s === 'expired' || s === 'cancelled')
    return { key: 'ended', label: 'Berakhir', hint: 'end' }
  return { key: s, label: s, hint: 'wait' }
}

function paymentStatusMeta(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'settlement' || s === 'paid' || s === 'success' || s === 'verified')
    return { label: 'Berhasil', cls: 'ok' }
  if (s === 'pending' || s === 'challenge')
    return { label: 'Menunggu verifikasi', cls: 'wait' }
  if (s === 'deny' || s === 'cancel' || s === 'expire' || s === 'failed')
    return { label: 'Ditolak / gagal', cls: 'bad' }
  return { label: status || '—', cls: 'wait' }
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
  const [billing, setBilling] = useState('monthly') // monthly | annual
  const [confirmPlan, setConfirmPlan] = useState(null)
  const [submitting, setSubmitting] = useState(false)

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
      setPlans(p || [])
      setMine(s)
      setPayments(pay || [])
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

  const activePlan = useMemo(() => {
    if (!mine) return null
    return plans.find((p) => p.id === mine.plan_id) || mine.plan || null
  }, [mine, plans])

  const visiblePlans = useMemo(() => {
    const free = plans.filter(isFree)
    const paid = plans.filter((p) => !isFree(p))
    const monthly = paid.filter((p) => !isAnnual(p))
    const annual = paid.filter(isAnnual)
    if (billing === 'annual') {
      // show free + annual if any, else free + monthly
      if (annual.length) return [...free, ...annual]
      return [...free, ...monthly]
    }
    return [...free, ...monthly]
  }, [plans, billing])

  const hasAnnual = plans.some(isAnnual)
  const st = statusLabel(mine)

  function planButtonLabel(plan) {
    if (isFree(plan)) {
      if (mine?.status === 'active') return 'Bukan paket aktif'
      return 'Paket default'
    }
    if (!mine) return 'Pilih paket'
    const isThis = mine.plan_id === plan.id
    if (mine.status === 'active' && isThis) return '✓ Paket aktif'
    if (mine.status === 'active' && !isThis) {
      const cur = Number(activePlan?.price) || 0
      const next = Number(plan.price) || 0
      return next > cur ? 'Upgrade' : 'Pilih paket'
    }
    if (mine.status === 'pending' && isThis) return 'Menunggu konfirmasi'
    if (mine.status === 'pending' && !isThis) return 'Ada pengajuan lain'
    return 'Pilih paket'
  }

  function planButtonDisabled(plan) {
    if (isFree(plan)) return true
    if (mine?.status === 'pending' && mine.plan_id !== plan.id) return true
    if (mine?.status === 'active' && mine.plan_id === plan.id) return true
    return false
  }

  function openConfirm(plan) {
    if (planButtonDisabled(plan) || isFree(plan)) return
    setConfirmPlan(plan)
    setMsg('')
    setError('')
  }

  async function confirmAndRequest() {
    if (!confirmPlan) return
    setSubmitting(true)
    setMsg('')
    setError('')
    try {
      await requestSubscription(user.id, confirmPlan.id)
      setMsg(
        'Permintaan langganan dikirim. Lanjut transfer sesuai nominal, lalu kirim bukti di bawah.'
      )
      setConfirmPlan(null)
      await load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal mengajukan langganan')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitPayment(e) {
    e.preventDefault()
    if (!mine || mine.status !== 'pending') {
      setError('Ajukan paket berbayar dulu sebelum kirim bukti.')
      return
    }
    const plan = plans.find((p) => p.id === mine.plan_id) || mine.plan
    setSubmitting(true)
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
    } finally {
      setSubmitting(false)
    }
  }

  function copyText(text) {
    try {
      navigator.clipboard?.writeText(text)
      setMsg('Disalin ke clipboard.')
    } catch {
      setError('Gagal menyalin.')
    }
  }

  const pendingPlan =
    mine?.status === 'pending'
      ? plans.find((p) => p.id === mine.plan_id) || mine.plan
      : null

  const step =
    mine?.status === 'active'
      ? 4
      : mine?.status === 'pending' && payments.some((p) => {
          const s = String(p.status || '').toLowerCase()
          return s === 'pending' || s === 'challenge'
        })
        ? 3
        : mine?.status === 'pending'
          ? 2
          : 1

  return (
    <div className="sub-page">
      <div className="sub-shell">
        <Link to="/dashboard" className="sub-back">
          ← Dashboard
        </Link>
        <h1 className="sub-h1">Langganan</h1>
        <p className="sub-lead">Kelola paket dan pembayaran Buku Kas kamu.</p>

        {msg && (
          <div className="sub-alert ok" role="status">
            {msg}
          </div>
        )}
        {error && (
          <div className="sub-alert err" role="alert">
            {error}
          </div>
        )}
        {loading && <p className="sub-muted">Memuat...</p>}

        {/* CURRENT */}
        {!loading && (
          <section className="sub-card sub-current">
            <div className="sub-sec-label">Langganan kamu</div>
            <div className="sub-current-row">
              <div>
                <div className="sub-plan-big">
                  {mine?.status === 'active'
                    ? activePlan?.name || 'Paket berbayar'
                    : mine?.status === 'pending'
                      ? pendingPlan?.name || 'Pengajuan'
                      : 'Gratis'}
                </div>
                <div className={'sub-status ' + st.hint}>
                  {st.hint === 'ok' && '✓ '}
                  {st.hint === 'wait' && '⏳ '}
                  {st.hint === 'end' && '○ '}
                  {st.label}
                </div>
              </div>
              <div className="sub-current-meta">
                {mine?.status === 'active' && mine.ends_at && (
                  <>
                    <div className="sub-muted">Berlaku sampai</div>
                    <div className="sub-strong">{formatDate(mine.ends_at)}</div>
                    <div className="sub-muted" style={{ marginTop: 8 }}>
                      Perpanjang sebelum masa aktif berakhir.
                    </div>
                  </>
                )}
                {mine?.status === 'pending' && (
                  <>
                    <div className="sub-muted">Langkah berikutnya</div>
                    <div className="sub-strong">Transfer &amp; kirim bukti</div>
                  </>
                )}
                {(!mine || (mine.status !== 'active' && mine.status !== 'pending')) && (
                  <>
                    <div className="sub-muted">Batas gratis</div>
                    <div className="sub-strong">200 transaksi / bulan</div>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* STEPS when pending */}
        {mine?.status === 'pending' && (
          <div className="sub-steps" aria-label="Langkah pembayaran">
            {[
              [1, 'Pilih paket'],
              [2, 'Pembayaran'],
              [3, 'Verifikasi'],
              [4, 'Aktif'],
            ].map(([n, label]) => (
              <div key={n} className={'sub-step' + (step >= n ? ' on' : '')}>
                <span className="num">{n}</span>
                {label}
              </div>
            ))}
          </div>
        )}

        {/* PLANS */}
        {!loading && (
          <section className="sub-section">
            <div className="sub-section-head">
              <div>
                <h2 className="sub-h2">Pilih paket</h2>
                <p className="sub-muted">Sesuaikan dengan kebutuhan pencatatan kamu.</p>
              </div>
              {hasAnnual && (
                <div className="sub-toggle" role="group" aria-label="Periode tagihan">
                  <button
                    type="button"
                    className={billing === 'monthly' ? 'on' : ''}
                    onClick={() => setBilling('monthly')}
                  >
                    Bulanan
                  </button>
                  <button
                    type="button"
                    className={billing === 'annual' ? 'on' : ''}
                    onClick={() => setBilling('annual')}
                  >
                    Tahunan
                  </button>
                </div>
              )}
            </div>

            <div className="sub-plans">
              {visiblePlans.map((p) => {
                const isThisActive =
                  mine?.status === 'active' && mine?.plan_id === p.id
                const isFreeDefault = isFree(p) && mine?.status !== 'active'
                return (
                  <div
                    key={p.id}
                    className={
                      'sub-plan' +
                      (isThisActive || isFreeDefault ? ' featured' : '')
                    }
                  >
                    {(isThisActive || isFreeDefault) && (
                      <div className="sub-pill">
                        {isThisActive ? '✓ Paket aktif' : 'Default'}
                      </div>
                    )}
                    <div className="sub-plan-name">{p.name}</div>
                    <p className="sub-plan-desc">{p.description || '—'}</p>
                    <div className="sub-price">
                      {isFree(p) ? 'Gratis' : rupiah(p.price)}
                    </div>
                    <div className="sub-muted">
                      {isFree(p)
                        ? '200 transaksi / bulan'
                        : `${p.duration_days || '—'} hari`}
                    </div>
                    <button
                      type="button"
                      className="sub-cta"
                      disabled={planButtonDisabled(p)}
                      onClick={() => openConfirm(p)}
                    >
                      {planButtonLabel(p)}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* PAYMENT */}
        {!loading && payAcc && (payAcc.bank_name || payAcc.account_number) && (
          <section className="sub-card">
            <h2 className="sub-h2">Pembayaran manual</h2>
            <p className="sub-muted">
              Transfer sesuai nominal paket yang dipilih. Setelah transfer, kirim
              bukti di form bawah.
            </p>

            {pendingPlan && (
              <div className="sub-total">
                <span>Total pembayaran</span>
                <strong>{rupiah(pendingPlan.price)}</strong>
              </div>
            )}

            <div className="sub-bank">
              <div>
                <div className="sub-muted">Bank</div>
                <div className="sub-strong">{payAcc.bank_name || '—'}</div>
              </div>
              <div>
                <div className="sub-muted">Nomor rekening</div>
                <div className="sub-strong row">
                  {payAcc.account_number || '—'}
                  {payAcc.account_number && (
                    <button
                      type="button"
                      className="sub-copy"
                      onClick={() => copyText(payAcc.account_number)}
                    >
                      Salin
                    </button>
                  )}
                </div>
              </div>
              <div>
                <div className="sub-muted">Atas nama</div>
                <div className="sub-strong">{payAcc.account_name || '—'}</div>
              </div>
            </div>
            {payAcc.notes && (
              <p className="sub-muted" style={{ marginTop: 10 }}>
                {payAcc.notes}
              </p>
            )}

            <form className="sub-proof" onSubmit={handleSubmitPayment}>
              <h3 className="sub-h3">Konfirmasi pembayaran</h3>
              <p className="sub-muted">
                Sudah transfer? Catat metode &amp; catatan agar admin bisa
                memverifikasi.
              </p>
              <label className="sub-label">Metode</label>
              <input
                className="sub-input"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              />
              <label className="sub-label">Catatan / no. referensi (opsional)</label>
              <input
                className="sub-input"
                value={refNote}
                onChange={(e) => setRefNote(e.target.value)}
                placeholder="Contoh: transfer dari BCA · 19 Sep"
              />
              {pendingPlan && (
                <div className="sub-muted" style={{ marginBottom: 8 }}>
                  Nominal: <b>{rupiah(pendingPlan.price)}</b>
                </div>
              )}
              <button
                type="submit"
                className="sub-cta"
                disabled={submitting || mine?.status !== 'pending'}
              >
                {submitting ? 'Mengirim...' : 'Kirim bukti / konfirmasi'}
              </button>
              {mine?.status !== 'pending' && (
                <p className="sub-muted" style={{ marginTop: 8 }}>
                  Ajukan paket berbayar dulu agar status menjadi menunggu pembayaran.
                </p>
              )}
            </form>
          </section>
        )}

        {/* HISTORY */}
        {!loading && (
          <section className="sub-card">
            <h2 className="sub-h2">Riwayat pembayaran</h2>
            {payments.length === 0 ? (
              <p className="sub-muted">
                Belum ada pembayaran. Riwayat muncul setelah kamu mengirim
                konfirmasi.
              </p>
            ) : (
              <div className="sub-table-wrap">
                <table className="sub-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Nominal</th>
                      <th>Metode</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((pay) => {
                      const meta = paymentStatusMeta(pay.status)
                      return (
                        <tr key={pay.id}>
                          <td>{formatDate(pay.created_at)}</td>
                          <td>{rupiah(pay.amount)}</td>
                          <td>{pay.payment_method || pay.method || '—'}</td>
                          <td>
                            <span className={'sub-badge ' + meta.cls}>
                              {meta.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {/* CONFIRM MODAL */}
      {confirmPlan && (
        <div className="sub-modal-bg" role="dialog" aria-modal="true">
          <div className="sub-modal">
            <h3 className="sub-h2">Konfirmasi paket</h3>
            <p className="sub-plan-name">{confirmPlan.name}</p>
            <p className="sub-price" style={{ margin: '8px 0' }}>
              {rupiah(confirmPlan.price)}
            </p>
            <p className="sub-muted">
              {confirmPlan.duration_days} hari · Setelah pembayaran diverifikasi
              admin, paket akan aktif.
            </p>
            <p className="sub-muted">{confirmPlan.description}</p>
            <div className="sub-modal-actions">
              <button
                type="button"
                className="sub-ghost"
                onClick={() => setConfirmPlan(null)}
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="sub-cta"
                onClick={confirmAndRequest}
                disabled={submitting}
              >
                {submitting ? '...' : 'Lanjut ke pembayaran'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sub-page {
          min-height: 100vh;
          background: var(--paper, #16231f);
          color: var(--ink, #edeae0);
          padding: 20px 16px 40px;
          box-sizing: border-box;
        }
        .sub-shell { max-width: 1100px; margin: 0 auto; }
        .sub-back {
          color: var(--brass, #c9a24b);
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
        }
        .sub-h1 {
          margin: 10px 0 4px;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .sub-h2 {
          margin: 0 0 4px;
          font-size: 17px;
          font-weight: 700;
        }
        .sub-h3 {
          margin: 16px 0 6px;
          font-size: 14px;
          font-weight: 700;
        }
        .sub-lead, .sub-muted {
          color: var(--ink-dim, #a9b0a8);
          font-size: 13px;
          line-height: 1.45;
        }
        .sub-lead { margin: 0 0 16px; }
        .sub-strong { font-weight: 700; font-size: 15px; }
        .sub-alert {
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .sub-alert.ok {
          background: var(--brass-soft, rgba(201,162,75,0.14));
          color: var(--brass, #c9a24b);
        }
        .sub-alert.err {
          background: var(--clay-soft, rgba(196,115,90,0.14));
          color: var(--clay, #c4735a);
        }
        .sub-card {
          background: var(--paper-raised, #1d2e28);
          border: 1px solid var(--paper-line, #2b3e37);
          border-radius: 14px;
          padding: 18px;
          margin-bottom: 16px;
        }
        .sub-sec-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ink-dim);
          margin-bottom: 10px;
        }
        .sub-current-row {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
        }
        .sub-plan-big {
          font-size: 22px;
          font-weight: 700;
          color: var(--brass);
        }
        .sub-status {
          margin-top: 6px;
          font-size: 13px;
          font-weight: 600;
        }
        .sub-status.ok { color: var(--sage, #7faf9f); }
        .sub-status.wait { color: var(--brass); }
        .sub-status.end { color: var(--ink-dim); }
        .sub-steps {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
        }
        .sub-step {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--ink-dim);
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--paper-line);
        }
        .sub-step.on {
          color: var(--brass);
          border-color: var(--brass);
          background: var(--brass-soft);
        }
        .sub-step .num {
          width: 20px; height: 20px; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--paper); font-size: 11px; font-weight: 700;
        }
        .sub-section { margin-bottom: 16px; }
        .sub-section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .sub-toggle {
          display: flex;
          background: var(--paper-raised);
          border: 1px solid var(--paper-line);
          border-radius: 10px;
          padding: 3px;
        }
        .sub-toggle button {
          border: none;
          background: transparent;
          color: var(--ink-dim);
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .sub-toggle button.on {
          background: var(--brass-soft);
          color: var(--brass);
        }
        .sub-plans {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
        }
        .sub-plan {
          background: var(--paper-raised);
          border: 1px solid var(--paper-line);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          min-height: 220px;
        }
        .sub-plan.featured {
          border-color: var(--brass);
          box-shadow: 0 0 0 1px var(--brass-soft);
        }
        .sub-pill {
          align-self: flex-start;
          font-size: 11px;
          font-weight: 700;
          color: var(--brass);
          background: var(--brass-soft);
          padding: 3px 8px;
          border-radius: 999px;
          margin-bottom: 8px;
        }
        .sub-plan-name { font-size: 16px; font-weight: 700; }
        .sub-plan-desc {
          font-size: 12.5px;
          color: var(--ink-dim);
          line-height: 1.4;
          flex: 1;
          margin: 8px 0;
        }
        .sub-price {
          font-size: 22px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .sub-cta {
          margin-top: 14px;
          width: 100%;
          border: none;
          border-radius: 10px;
          padding: 11px 14px;
          background: var(--brass);
          color: var(--btn-primary-text, #1b160a);
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }
        .sub-cta:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .sub-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--paper);
          border: 1px solid var(--paper-line);
          margin: 12px 0;
          font-size: 14px;
        }
        .sub-total strong {
          font-size: 18px;
          color: var(--brass);
        }
        .sub-bank {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
          margin-top: 12px;
        }
        .sub-bank .row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .sub-copy {
          border: 1px solid var(--paper-line);
          background: transparent;
          color: var(--brass);
          border-radius: 8px;
          padding: 4px 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .sub-proof { margin-top: 8px; }
        .sub-label {
          display: block;
          font-size: 12px;
          color: var(--ink-dim);
          margin: 10px 0 6px;
        }
        .sub-input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--paper-line);
          background: var(--paper);
          color: var(--ink);
          font-size: 14px;
        }
        .sub-table-wrap { overflow-x: auto; margin-top: 10px; }
        .sub-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          min-width: 480px;
        }
        .sub-table th {
          text-align: left;
          color: var(--ink-dim);
          font-weight: 600;
          padding: 8px 6px;
          border-bottom: 1px solid var(--paper-line);
        }
        .sub-table td {
          padding: 10px 6px;
          border-bottom: 1px solid var(--paper-line);
        }
        .sub-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 999px;
        }
        .sub-badge.ok { background: rgba(127,175,159,0.2); color: var(--sage, #7faf9f); }
        .sub-badge.wait { background: var(--brass-soft); color: var(--brass); }
        .sub-badge.bad { background: var(--clay-soft); color: var(--clay); }
        .sub-modal-bg {
          position: fixed; inset: 0;
          background: rgba(8,12,10,0.55);
          display: flex; align-items: center; justify-content: center;
          z-index: 80; padding: 16px;
        }
        .sub-modal {
          width: 100%; max-width: 420px;
          background: var(--paper-raised);
          border: 1px solid var(--paper-line);
          border-radius: 14px;
          padding: 20px;
        }
        .sub-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 16px;
        }
        .sub-ghost {
          border: 1px solid var(--paper-line);
          background: transparent;
          color: var(--ink);
          border-radius: 10px;
          padding: 10px 14px;
          cursor: pointer;
        }
        @media (max-width: 640px) {
          .sub-plans { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
