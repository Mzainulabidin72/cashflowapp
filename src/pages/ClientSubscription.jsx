import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  listPlans,
  getMySubscription,
  requestSubscription,
} from '../lib/subscriptionService'
import {
  createPayment,
  getPendingPayment,
  listMyPayments,
} from '../lib/paymentService'
import { getPaymentAccount } from '../lib/paymentAccountService'
import { FREE_TX_LIMIT_PER_MONTH, planRank } from '../lib/planAccess'

const PAYMENT_PAGE_SIZE = 10

function rupiah(value) {
  return 'Rp ' + Number(value || 0).toLocaleString('id-ID')
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function isAnnual(plan) {
  const name = String(plan?.name || '').toLowerCase()
  return name.includes('tahun') || name.includes('annual') || Number(plan?.duration_days) >= 300
}

function isFree(plan) {
  return Number(plan?.price) === 0
}

function planTierRank(name) {
  const normalized = String(name || '').toLowerCase()
  if (normalized.includes('pro')) return 2
  if (normalized.includes('basic') || normalized.includes('kelola')) return 1
  return planRank(name)
}

function subscriptionState(subscription) {
  if (!subscription) return 'free'
  const status = String(subscription.status || '').toLowerCase()
  if (
    status === 'active' &&
    subscription.ends_at &&
    new Date(subscription.ends_at).getTime() <= Date.now()
  ) {
    return 'expired'
  }
  return status
}

function subscriptionStatusMeta(status) {
  const labels = {
    free: { label: 'Gratis', tone: 'neutral' },
    active: { label: 'Aktif', tone: 'ok' },
    pending: { label: 'Menunggu pembayaran', tone: 'wait' },
    expired: { label: 'Kedaluwarsa', tone: 'neutral' },
    cancelled: { label: 'Dibatalkan', tone: 'neutral' },
  }
  return labels[status] || { label: status || 'Tidak diketahui', tone: 'neutral' }
}

function paymentStatusMeta(status) {
  const normalized = String(status || '').toLowerCase()
  if (['paid', 'settlement', 'success', 'verified'].includes(normalized)) {
    return { label: 'Lunas / terverifikasi', tone: 'ok' }
  }
  if (['pending', 'challenge'].includes(normalized)) {
    return { label: 'Menunggu verifikasi', tone: 'wait' }
  }
  if (normalized === 'rejected') return { label: 'Ditolak', tone: 'bad' }
  if (['expired', 'expire'].includes(normalized)) {
    return { label: 'Kedaluwarsa', tone: 'neutral' }
  }
  if (['failed', 'deny', 'cancel'].includes(normalized)) {
    return { label: 'Gagal', tone: 'bad' }
  }
  return { label: status || '—', tone: 'neutral' }
}

function basePlanName(plan) {
  const name = String(plan?.name || '').trim()
  const base = name
    .replace(/\b(?:annual|yearly|tahunan|bulanan|monthly|per|bulan|tahun|months?|years?)\b/gi, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/[\s()[\]_-]+/g, ' ')
    .trim()
  return base || name
}

function getPlanGroups(plans, billing) {
  const groups = new Map()
  plans.forEach((plan) => {
    const name = basePlanName(plan)
    const key = name.toLowerCase() || String(plan.id)
    if (!groups.has(key)) groups.set(key, { name, plans: [] })
    groups.get(key).plans.push(plan)
  })

  return [...groups.values()]
    .map((group) => {
      const desired = group.plans.filter((plan) =>
        billing === 'annual' ? isAnnual(plan) : !isAnnual(plan)
      )
      const selected = (desired.length ? desired : group.plans)
        .slice()
        .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))[0]
      const monthly = group.plans.find((plan) => !isFree(plan) && !isAnnual(plan))
      const annual = group.plans.find((plan) => !isFree(plan) && isAnnual(plan))
      let savings = 0
      if (monthly && annual && Number(monthly.duration_days) > 0) {
        savings = Math.round(
          (Number(monthly.price) / Number(monthly.duration_days)) *
            Number(annual.duration_days) -
            Number(annual.price)
        )
      }
      return { ...group, selected, savings: savings > 0 ? savings : 0 }
    })
    .filter((group) => group.selected)
    .sort((a, b) => Number(a.selected.price || 0) - Number(b.selected.price || 0))
}

function billingInterval(plan) {
  if (isFree(plan)) return 'Tanpa batas waktu'
  if (isAnnual(plan)) return 'per tahun'
  const duration = Number(plan?.duration_days)
  if (!duration || duration === 30) return 'per bulan'
  return `per ${duration} hari`
}

function remainingDays(endDate) {
  if (!endDate) return null
  const end = new Date(endDate).getTime()
  if (Number.isNaN(end)) return null
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000))
}

export default function ClientSubscription() {
  const { user } = useAuth()
  const [plans, setPlans] = useState([])
  const [mine, setMine] = useState(null)
  const [payments, setPayments] = useState([])
  const [paymentCount, setPaymentCount] = useState(0)
  const [pendingPayment, setPendingPayment] = useState(null)
  const [payAcc, setPayAcc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [refNote, setRefNote] = useState('')
  const [method, setMethod] = useState('Transfer Bank')
  const [billing, setBilling] = useState('monthly')
  const [confirmPlan, setConfirmPlan] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')
  const [paymentPage, setPaymentPage] = useState(0)

  async function load(page = paymentPage) {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [availablePlans, subscription, paymentPageData, account] =
        await Promise.all([
          listPlans(),
          getMySubscription(user.id),
          listMyPayments(user.id, page, PAYMENT_PAGE_SIZE),
          getPaymentAccount(),
        ])
      const openPayment =
        subscription?.status === 'pending'
          ? await getPendingPayment(subscription.id, user.id)
          : null
      setPlans(availablePlans || [])
      setMine(subscription)
      setPayments(paymentPageData.payments)
      setPaymentCount(paymentPageData.count)
      setPendingPayment(openPayment)
      setPayAcc(account)
    } catch (loadError) {
      console.error(loadError)
      setError('Informasi langganan tidak dapat dimuat. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) load(paymentPage)
  }, [user, paymentPage])

  useEffect(() => {
    if (!confirmPlan) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !submitting) setConfirmPlan(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmPlan, submitting])

  const activePlan = useMemo(() => {
    if (!mine) return null
    return plans.find((plan) => plan.id === mine.plan_id) || mine.plan || null
  }, [mine, plans])

  const state = subscriptionState(mine)
  const isActive = state === 'active'
  const isPending = state === 'pending'
  const baseStatus = subscriptionStatusMeta(state)
  const status =
    isPending && pendingPayment
      ? { ...baseStatus, label: 'Menunggu verifikasi' }
      : baseStatus
  const pendingPlan = isPending
    ? plans.find((plan) => plan.id === mine.plan_id) || mine.plan
    : null
  const planGroups = useMemo(
    () => getPlanGroups(plans, billing),
    [plans, billing]
  )
  const hasAnnualPlans = plans.some(isAnnual)
  const accountAvailable = Boolean(payAcc?.bank_name && payAcc?.account_number)
  const totalPaymentPages = Math.ceil(paymentCount / PAYMENT_PAGE_SIZE)
  const remaining = isActive ? remainingDays(mine?.ends_at) : null
  const hasRejectedPayment = payments.some((payment) =>
    ['rejected', 'failed', 'deny', 'cancel', 'expired', 'expire'].includes(
      String(payment.status || '').toLowerCase()
    )
  )

  function planButtonLabel(plan) {
    if (isFree(plan)) return isActive ? 'Paket berbayar aktif' : 'Paket gratis'
    if (isPending) {
      return mine.plan_id === plan.id
        ? pendingPayment
          ? 'Menunggu verifikasi'
          : 'Paket diajukan'
        : 'Selesaikan pengajuan'
    }
    if (isActive && mine.plan_id === plan.id) return 'Paket aktif'
    if (isActive && planTierRank(plan.name) < planTierRank(activePlan?.name)) {
      return 'Downgrade tidak tersedia'
    }
    if (isActive && planTierRank(plan.name) > planTierRank(activePlan?.name)) return 'Upgrade'
    return 'Pilih paket'
  }

  function planButtonDisabled(plan) {
    if (isFree(plan)) return true
    if (isPending) return true
    if (isActive && mine.plan_id === plan.id) return true
    return isActive && planTierRank(plan.name) < planTierRank(activePlan?.name)
  }

  function openConfirm(plan) {
    if (planButtonDisabled(plan) || isFree(plan)) return
    setConfirmPlan(plan)
    setMsg('')
    setError('')
  }

  async function confirmAndRequest() {
    if (!confirmPlan || !user) return
    setSubmitting(true)
    setMsg('')
    setError('')
    try {
      await requestSubscription(user.id, confirmPlan.id)
      setConfirmPlan(null)
      setPaymentPage(0)
      setMsg(
        'Pengajuan paket dibuat dan belum aktif. Silakan transfer sesuai nominal, lalu kirim konfirmasi pembayaran.'
      )
      await load(0)
    } catch (requestError) {
      console.error(requestError)
      setError('Pengajuan paket gagal dibuat. Silakan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitPayment(event) {
    event.preventDefault()
    if (!user || !mine || !pendingPlan || !isPending) {
      setError('Pilih paket berbayar terlebih dahulu sebelum mengirim konfirmasi.')
      return
    }
    if (!accountAvailable) {
      setError('Informasi rekening belum tersedia. Silakan hubungi admin.')
      return
    }
    if (!Number.isFinite(Number(pendingPlan.price)) || Number(pendingPlan.price) <= 0) {
      setError('Nominal paket tidak valid. Silakan hubungi admin.')
      return
    }
    if (pendingPayment) {
      setError('Konfirmasi pembayaran Anda sedang menunggu verifikasi.')
      return
    }
    if (!method.trim()) {
      setError('Metode pembayaran wajib diisi.')
      return
    }

    setSubmitting(true)
    setMsg('')
    setError('')
    try {
      await createPayment({
        subscriptionId: mine.id,
        userId: user.id,
        amount: Number(pendingPlan.price),
        paymentMethod: method.trim(),
        note: refNote.trim(),
      })
      setRefNote('')
      setPaymentPage(0)
      setMsg('Konfirmasi pembayaran terkirim dan menunggu verifikasi admin.')
      await load(0)
    } catch (paymentError) {
      console.error(paymentError)
      if (paymentError.message?.includes('sudah menunggu verifikasi')) {
        setError(paymentError.message)
      } else {
        setError('Konfirmasi pembayaran gagal dikirim. Silakan coba lagi.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function copyAccountNumber() {
    setCopyMessage('')
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard tidak tersedia di browser ini.')
      }
      await navigator.clipboard.writeText(payAcc.account_number)
      setCopyMessage('Nomor rekening berhasil disalin.')
    } catch (copyError) {
      console.error(copyError)
      setCopyMessage('Nomor rekening tidak dapat disalin. Silakan salin manual.')
    }
  }

  return (
    <div className="sub-page">
      <div className="sub-shell">
        <Link to="/dashboard" className="sub-back">
          ← Dashboard
        </Link>
        <header className="sub-heading">
          <div className="sub-eyebrow">Buku Kas Lanila</div>
          <h1 className="sub-h1">Langganan</h1>
          <p className="sub-lead">
            Pilih paket yang sesuai dan kelola pembayaran Anda.
          </p>
        </header>

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
        {loading && <p className="sub-muted">Memuat informasi langganan…</p>}

        {!loading && (
          <>
            <section className="sub-card sub-current" aria-labelledby="sub-current-title">
              <div className="sub-current-main">
                <div className="sub-sec-label" id="sub-current-title">
                  Paket Anda
                </div>
                <h2 className="sub-plan-big">
                  {isPending
                    ? pendingPlan?.name || 'Pengajuan paket'
                    : isActive
                      ? activePlan?.name || 'Paket berbayar'
                      : 'Gratis'}
                </h2>
                <span className={`sub-status ${status.tone}`}>
                  <span className="sub-status-dot" aria-hidden="true" />
                  {status.label}
                </span>
              </div>
              <div className="sub-current-meta">
                {isActive && (
                  <>
                    <div className="sub-meta-pair">
                      <span className="sub-muted">Mulai</span>
                      <strong>{formatDate(mine.starts_at)}</strong>
                    </div>
                    <div className="sub-meta-pair">
                      <span className="sub-muted">Berakhir</span>
                      <strong>{formatDate(mine.ends_at)}</strong>
                    </div>
                    {remaining !== null && (
                      <p className="sub-remaining">
                        {remaining === 0
                          ? 'Masa aktif berakhir hari ini.'
                          : `Sisa ${remaining} hari.`}
                      </p>
                    )}
                  </>
                )}
                {isPending && (
                  <>
                    <span className="sub-muted">Langkah berikutnya</span>
                    <strong>
                      {pendingPayment
                        ? 'Menunggu verifikasi admin'
                        : 'Transfer dan kirim konfirmasi'}
                    </strong>
                  </>
                )}
                {!isActive && !isPending && (
                  <>
                    <span className="sub-muted">Batas paket gratis</span>
                    <strong>{FREE_TX_LIMIT_PER_MONTH} transaksi / bulan</strong>
                    {state === 'expired' && activePlan?.name && (
                      <span className="sub-muted">
                        Paket sebelumnya: {activePlan.name}
                      </span>
                    )}
                  </>
                )}
              </div>
            </section>

            {isPending && (
              <div className="sub-steps" aria-label="Tahapan pembayaran">
                {[
                  ['1', 'Paket dipilih'],
                  ['2', 'Transfer'],
                  ['3', pendingPayment ? 'Verifikasi' : 'Konfirmasi'],
                ].map(([number, label], index) => {
                  const stepDone = pendingPayment ? index <= 2 : index === 0
                  return (
                    <div
                      key={number}
                      className={`sub-step${stepDone ? ' on' : ''}`}
                    >
                      <span className="sub-step-number">{number}</span>
                      {label}
                    </div>
                  )
                })}
              </div>
            )}

            <section className="sub-section" aria-labelledby="sub-plans-title">
              <div className="sub-section-head">
                <div>
                  <div className="sub-sec-label">Paket dan harga</div>
                  <h2 className="sub-h2" id="sub-plans-title">
                    Pilih paket
                  </h2>
                  <p className="sub-muted">
                    Harga dan fitur mengikuti paket yang tersedia.
                  </p>
                </div>
                {hasAnnualPlans && (
                  <div className="sub-toggle" role="group" aria-label="Periode tagihan">
                    <button
                      type="button"
                      className={billing === 'monthly' ? 'on' : ''}
                      aria-pressed={billing === 'monthly'}
                      onClick={() => setBilling('monthly')}
                    >
                      Bulanan
                    </button>
                    <button
                      type="button"
                      className={billing === 'annual' ? 'on' : ''}
                      aria-pressed={billing === 'annual'}
                      onClick={() => setBilling('annual')}
                    >
                      Tahunan
                    </button>
                  </div>
                )}
              </div>

              {plans.length === 0 ? (
                <div className="sub-empty">
                  Paket langganan belum tersedia.
                </div>
              ) : (
                <div className="sub-plans">
                  {planGroups.map((group) => {
                    const plan = group.selected
                    const activeChoice = isActive && mine.plan_id === plan.id
                    const freeChoice = isFree(plan) && !isActive
                    const downgrade =
                      isActive &&
                      !isFree(plan) &&
                      planTierRank(plan.name) < planTierRank(activePlan?.name)
                    return (
                      <article
                        key={plan.id}
                        className={`sub-plan${activeChoice ? ' current' : ''}`}
                      >
                        {(activeChoice || freeChoice) && (
                          <span className="sub-pill">
                            {activeChoice ? 'Paket aktif' : 'Paket saat ini'}
                          </span>
                        )}
                        <h3 className="sub-plan-name">{group.name}</h3>
                        <p className="sub-plan-desc">
                          {plan.description || 'Informasi paket tidak tersedia.'}
                        </p>
                        <div className="sub-price-row">
                          <span className="sub-price">
                            {isFree(plan) ? 'Gratis' : rupiah(plan.price)}
                          </span>
                          {!isFree(plan) && (
                            <span className="sub-price-period">
                              {billingInterval(plan)}
                            </span>
                          )}
                        </div>
                        {isFree(plan) ? (
                          <p className="sub-plan-limit">
                            {FREE_TX_LIMIT_PER_MONTH} transaksi / bulan
                          </p>
                        ) : (
                          <p className="sub-plan-limit">
                            Masa paket {Number(plan.duration_days) || '—'} hari
                          </p>
                        )}
                        {group.savings > 0 && isAnnual(plan) && (
                          <span className="sub-savings">
                            Hemat {rupiah(group.savings)} dibanding durasi setara
                          </span>
                        )}
                        {downgrade && (
                          <p className="sub-plan-note">
                            Penurunan paket tidak tersedia selama paket aktif.
                          </p>
                        )}
                        <button
                          type="button"
                          className="sub-cta"
                          disabled={planButtonDisabled(plan)}
                          onClick={() => openConfirm(plan)}
                        >
                          {planButtonLabel(plan)}
                        </button>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="sub-card sub-payment" aria-labelledby="sub-payment-title">
              <div className="sub-section-head">
                <div>
                  <div className="sub-sec-label">Pembayaran manual</div>
                  <h2 className="sub-h2" id="sub-payment-title">
                    Cara membayar
                  </h2>
                  <p className="sub-muted">
                    Paket baru aktif setelah pembayaran diverifikasi admin.
                  </p>
                </div>
              </div>

              <div className="sub-flow">
                <section className="sub-flow-step">
                  <div className="sub-step-title">
                    <span className="sub-step-number">1</span>
                    <h3>Pilih paket</h3>
                  </div>
                  {pendingPlan ? (
                    <div className="sub-selection">
                      <strong>{pendingPlan.name}</strong>
                      <span>
                        {rupiah(pendingPlan.price)} · {pendingPlan.duration_days || '—'} hari
                      </span>
                    </div>
                  ) : (
                    <p className="sub-muted">
                      Pilih paket berbayar di atas untuk melihat jumlah yang harus dibayar.
                    </p>
                  )}
                </section>

                <section className="sub-flow-step">
                  <div className="sub-step-title">
                    <span className="sub-step-number">2</span>
                    <h3>Transfer pembayaran</h3>
                  </div>
                  {accountAvailable ? (
                    <>
                      <dl className="sub-bank">
                        <div>
                          <dt>Bank</dt>
                          <dd>{payAcc.bank_name}</dd>
                        </div>
                        <div>
                          <dt>Nomor rekening</dt>
                          <dd className="sub-account-number">
                            <span>{payAcc.account_number}</span>
                            <button
                              type="button"
                              className="sub-copy"
                              onClick={copyAccountNumber}
                            >
                              Salin
                            </button>
                          </dd>
                        </div>
                        {payAcc.account_name && (
                          <div>
                            <dt>Atas nama</dt>
                            <dd>{payAcc.account_name}</dd>
                          </div>
                        )}
                      </dl>
                      {copyMessage && (
                        <p className="sub-copy-feedback" role="status">
                          {copyMessage}
                        </p>
                      )}
                      {payAcc.notes && <p className="sub-bank-notes">{payAcc.notes}</p>}
                    </>
                  ) : (
                    <p className="sub-inline-alert">
                      Informasi rekening belum tersedia. Silakan hubungi admin sebelum melakukan pembayaran.
                    </p>
                  )}
                  <p className="sub-transfer-note">
                    Pastikan jumlah transfer sama persis dengan nominal paket.
                  </p>
                </section>

                <section className="sub-flow-step">
                  <div className="sub-step-title">
                    <span className="sub-step-number">3</span>
                    <h3>Kirim konfirmasi</h3>
                  </div>
                  {pendingPayment ? (
                    <div className="sub-pending-note" role="status">
                      <strong>Konfirmasi sudah diterima.</strong>
                      <span>
                        Pembayaran Anda menunggu verifikasi admin. Anda tidak perlu mengirim ulang.
                      </span>
                    </div>
                  ) : (
                    <>
                      {pendingPlan ? (
                        <div className="sub-confirm-total">
                          <span>Total konfirmasi</span>
                          <strong>{rupiah(pendingPlan.price)}</strong>
                        </div>
                      ) : (
                        <p className="sub-muted">
                          Ajukan paket berbayar terlebih dahulu sebelum mengirim konfirmasi.
                        </p>
                      )}
                      <form className="sub-proof" onSubmit={handleSubmitPayment}>
                        <label className="sub-label" htmlFor="sub-method">
                          Metode pembayaran
                        </label>
                        <input
                          id="sub-method"
                          className="sub-input"
                          value={method}
                          onChange={(event) => setMethod(event.target.value)}
                          required
                          disabled={!pendingPlan || !accountAvailable || submitting}
                        />
                        <label className="sub-label" htmlFor="sub-reference">
                          Catatan atau nomor referensi (opsional)
                        </label>
                        <textarea
                          id="sub-reference"
                          className="sub-input sub-textarea"
                          value={refNote}
                          onChange={(event) => setRefNote(event.target.value)}
                          placeholder="Masukkan referensi transfer jika tersedia"
                          rows={3}
                          disabled={!pendingPlan || !accountAvailable || submitting}
                        />
                        {hasRejectedPayment && isPending && (
                          <p className="sub-muted">
                            Pembayaran sebelumnya ditolak atau gagal. Anda dapat mengirim konfirmasi baru.
                          </p>
                        )}
                        <button
                          type="submit"
                          className="sub-cta"
                          disabled={
                            submitting ||
                            !pendingPlan ||
                            !isPending ||
                            !accountAvailable
                          }
                        >
                          {submitting ? 'Mengirim…' : 'Kirim konfirmasi pembayaran'}
                        </button>
                      </form>
                    </>
                  )}
                </section>
              </div>
            </section>

            <section className="sub-card" aria-labelledby="sub-history-title">
              <div className="sub-section-head sub-history-head">
                <div>
                  <div className="sub-sec-label">Transaksi</div>
                  <h2 className="sub-h2" id="sub-history-title">
                    Riwayat pembayaran
                  </h2>
                </div>
              </div>
              {payments.length === 0 ? (
                <div className="sub-empty">
                  Belum ada pembayaran. Riwayat akan muncul setelah konfirmasi dikirim.
                </div>
              ) : (
                <>
                  <div className="sub-table-wrap">
                    <table className="sub-table">
                      <thead>
                        <tr>
                          <th scope="col">Tanggal</th>
                          <th scope="col">Paket / deskripsi</th>
                          <th scope="col">Nominal</th>
                          <th scope="col">Metode</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => {
                          const meta = paymentStatusMeta(payment.status)
                          const description =
                            payment.subscription_id === mine?.id && activePlan
                              ? activePlan.name
                              : 'Pembayaran langganan'
                          return (
                            <tr key={payment.id}>
                              <td>{formatDate(payment.created_at)}</td>
                              <td>{description}</td>
                              <td className="sub-table-amount">
                                {rupiah(payment.amount)}
                              </td>
                              <td>{payment.payment_method || payment.method || '—'}</td>
                              <td>
                                <span className={`sub-badge ${meta.tone}`}>
                                  {meta.label}
                                </span>
                                {String(payment.status).toLowerCase() === 'pending' && (
                                  <span className="sub-status-hint">
                                    Menunggu pemeriksaan admin.
                                  </span>
                                )}
                                {payment.note &&
                                  String(payment.status).toLowerCase() === 'rejected' && (
                                    <span className="sub-status-hint">
                                      {payment.note}
                                    </span>
                                  )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {totalPaymentPages > 1 && (
                    <div className="sub-pagination">
                      <span>
                        Halaman {paymentPage + 1} dari {totalPaymentPages}
                      </span>
                      <div>
                        <button
                          type="button"
                          className="sub-page-button"
                          disabled={paymentPage === 0 || loading}
                          onClick={() => setPaymentPage((page) => page - 1)}
                        >
                          Sebelumnya
                        </button>
                        <button
                          type="button"
                          className="sub-page-button"
                          disabled={paymentPage + 1 >= totalPaymentPages || loading}
                          onClick={() => setPaymentPage((page) => page + 1)}
                        >
                          Berikutnya
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>

      {confirmPlan && (
        <div className="sub-modal-bg">
          <section
            className="sub-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sub-modal-title"
          >
            <div className="sub-sec-label">Tinjau pilihan Anda</div>
            <h2 className="sub-modal-title" id="sub-modal-title">
              Konfirmasi paket
            </h2>
            <p className="sub-modal-plan">{basePlanName(confirmPlan)}</p>
            <p className="sub-modal-price">
              {rupiah(confirmPlan.price)}
              <span>{billingInterval(confirmPlan)}</span>
            </p>
            <p className="sub-muted">
              Masa paket {confirmPlan.duration_days || '—'} hari. Paket hanya aktif
              setelah pembayaran diverifikasi admin.
            </p>
            {isActive && (
              <p className="sub-modal-note">
                Paket Anda saat ini tetap aktif sampai pengajuan baru diproses.
              </p>
            )}
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
                {submitting ? 'Mengirim…' : 'Ajukan paket'}
              </button>
            </div>
          </section>
        </div>
      )}

      <style>{`
        .sub-page {
          min-height: 100vh;
          box-sizing: border-box;
          padding: 28px 20px 48px;
          background: var(--paper, #16231f);
          color: var(--ink, #edeae0);
        }
        .sub-shell { width: min(100%, 1120px); margin: 0 auto; }
        .sub-back {
          display: inline-flex;
          align-items: center;
          min-height: 36px;
          color: var(--brass, #c9a24b);
          text-decoration: none;
          font-size: 13px;
          font-weight: 650;
        }
        .sub-back:hover { text-decoration: underline; }
        .sub-heading { margin: 12px 0 22px; }
        .sub-eyebrow, .sub-sec-label {
          color: var(--ink-dim, #a9b0a8);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .sub-h1 { margin: 5px 0 4px; font-size: clamp(26px, 3vw, 32px); line-height: 1.2; letter-spacing: -.035em; }
        .sub-lead, .sub-muted {
          color: var(--ink-dim, #a9b0a8);
          font-size: 13px;
          line-height: 1.55;
        }
        .sub-lead { margin: 0; }
        .sub-muted { margin: 6px 0 0; }
        .sub-alert {
          padding: 12px 14px;
          margin: 0 0 14px;
          border: 1px solid var(--paper-line, #2b3e37);
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.5;
        }
        .sub-alert.ok { color: var(--ink); background: var(--brass-soft, rgba(201,162,75,.14)); }
        .sub-alert.err { color: var(--clay, #c4735a); background: var(--clay-soft, rgba(196,115,90,.14)); }
        .sub-card {
          min-width: 0;
          padding: 20px;
          margin: 0 0 18px;
          border: 1px solid var(--paper-line, #2b3e37);
          border-radius: 16px;
          background: var(--paper-raised, #1d2e28);
          box-shadow: 0 4px 16px rgba(0, 0, 0, .04);
        }
        .sub-current {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          border-left: 3px solid var(--brass, #c9a24b);
        }
        .sub-current-main { min-width: 180px; }
        .sub-plan-big { margin: 7px 0 8px; font-size: 23px; line-height: 1.25; letter-spacing: -.02em; }
        .sub-status { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; }
        .sub-status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
        .sub-status.ok { color: var(--moss, #6f9f7a); }
        .sub-status.wait { color: var(--brass, #c9a24b); }
        .sub-status.neutral { color: var(--ink-dim, #a9b0a8); }
        .sub-current-meta {
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
          gap: 24px;
          flex-wrap: wrap;
          min-width: min(100%, 360px);
        }
        .sub-current-meta > .sub-muted, .sub-current-meta > strong { max-width: 240px; }
        .sub-meta-pair { display: grid; gap: 5px; min-width: 120px; }
        .sub-meta-pair strong, .sub-current-meta > strong { font-size: 13px; }
        .sub-remaining { flex-basis: 100%; margin: -12px 0 0; color: var(--ink-dim); font-size: 12px; text-align: right; }
        .sub-steps { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 20px; }
        .sub-step { display: inline-flex; align-items: center; gap: 8px; padding: 7px 11px; border: 1px solid var(--paper-line); border-radius: 999px; color: var(--ink-dim); font-size: 12px; }
        .sub-step.on { border-color: var(--brass); color: var(--ink); background: var(--brass-soft); }
        .sub-step-number {
          display: inline-flex;
          flex: 0 0 25px;
          width: 25px;
          height: 25px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--paper, #16231f);
          color: var(--brass, #c9a24b);
          font-size: 12px;
          font-weight: 750;
        }
        .sub-section { margin: 26px 0 22px; }
        .sub-section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
        .sub-h2 { margin: 4px 0 0; font-size: 19px; line-height: 1.3; letter-spacing: -.02em; }
        .sub-toggle { display: inline-flex; flex: 0 0 auto; padding: 3px; border: 1px solid var(--paper-line); border-radius: 11px; background: var(--paper, #16231f); }
        .sub-toggle button {
          min-height: 38px;
          padding: 7px 14px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--ink-dim);
          font: inherit;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
        }
        .sub-toggle button.on { background: var(--brass-soft); color: var(--ink); }
        .sub-plans { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: stretch; }
        .sub-plan {
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 290px;
          padding: 20px;
          border: 1px solid var(--paper-line);
          border-radius: 16px;
          background: var(--paper-raised);
        }
        .sub-plan.current { border-color: var(--brass); box-shadow: 0 0 0 1px var(--brass-soft); }
        .sub-pill { align-self: flex-start; margin: 0 0 12px; padding: 4px 9px; border-radius: 999px; background: var(--brass-soft); color: var(--brass); font-size: 11px; font-weight: 750; }
        .sub-plan-name { margin: 2px 0 0; font-size: 17px; }
        .sub-plan-desc { min-height: 42px; margin: 9px 0 15px; color: var(--ink-dim); font-size: 12.5px; line-height: 1.5; }
        .sub-price-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; }
        .sub-price { font-size: 23px; font-weight: 750; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
        .sub-price-period { color: var(--ink-dim); font-size: 12px; }
        .sub-plan-limit { margin: 6px 0 8px; color: var(--ink-dim); font-size: 12px; }
        .sub-savings { align-self: flex-start; margin: 3px 0 8px; padding: 4px 7px; border-radius: 7px; background: var(--brass-soft); color: var(--ink); font-size: 11px; font-weight: 650; }
        .sub-plan-note { margin: 4px 0 0; color: var(--ink-dim); font-size: 11px; line-height: 1.45; }
        .sub-cta {
          width: 100%;
          min-height: 44px;
          margin-top: auto;
          padding: 10px 14px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: var(--brass, #c9a24b);
          color: var(--btn-primary-text, #1b160a);
          font: inherit;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          transition: background .15s ease, transform .15s ease;
        }
        .sub-cta:hover:not(:disabled) { filter: brightness(1.05); transform: translateY(-1px); }
        .sub-cta:disabled { border-color: var(--paper-line); background: var(--paper, #16231f); color: var(--ink-dim); cursor: not-allowed; }
        .sub-payment { padding-bottom: 22px; }
        .sub-flow { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .sub-flow-step { min-width: 0; padding: 16px; border: 1px solid var(--paper-line); border-radius: 13px; background: var(--paper, #16231f); }
        .sub-step-title { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
        .sub-step-title h3 { margin: 0; font-size: 14px; }
        .sub-selection { display: grid; gap: 5px; padding: 12px; border-radius: 10px; background: var(--paper-raised); }
        .sub-selection strong { font-size: 13px; }
        .sub-selection span { color: var(--brass); font-size: 13px; font-weight: 700; }
        .sub-bank { display: grid; gap: 12px; margin: 0; }
        .sub-bank dt { margin-bottom: 4px; color: var(--ink-dim); font-size: 11px; }
        .sub-bank dd { margin: 0; font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }
        .sub-account-number { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-variant-numeric: tabular-nums; }
        .sub-copy { flex: 0 0 auto; min-height: 34px; padding: 5px 10px; border: 1px solid var(--paper-line); border-radius: 8px; background: var(--paper-raised); color: var(--brass); font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
        .sub-copy-feedback { margin: 8px 0 0; color: var(--moss, #6f9f7a); font-size: 11px; }
        .sub-bank-notes, .sub-transfer-note { margin: 12px 0 0; color: var(--ink-dim); font-size: 11px; line-height: 1.5; white-space: pre-line; }
        .sub-transfer-note { padding-top: 10px; border-top: 1px solid var(--paper-line); }
        .sub-inline-alert, .sub-pending-note { margin: 0; padding: 11px; border-radius: 9px; background: var(--brass-soft); color: var(--ink); font-size: 12px; line-height: 1.5; }
        .sub-pending-note { display: grid; gap: 5px; }
        .sub-pending-note span { color: var(--ink-dim); }
        .sub-confirm-total { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 12px; font-size: 12px; }
        .sub-confirm-total strong { color: var(--brass); font-size: 16px; }
        .sub-proof { display: grid; gap: 8px; }
        .sub-label { margin-top: 4px; color: var(--ink-dim); font-size: 11px; font-weight: 650; }
        .sub-input { width: 100%; box-sizing: border-box; padding: 10px 11px; border: 1px solid var(--paper-line); border-radius: 9px; background: var(--paper-raised); color: var(--ink); font: inherit; font-size: 13px; }
        .sub-input::placeholder { color: var(--ink-dim); opacity: .8; }
        .sub-input:disabled { opacity: .65; }
        .sub-textarea { resize: vertical; min-height: 76px; }
        .sub-proof .sub-cta { margin-top: 4px; }
        .sub-empty { padding: 16px; border: 1px dashed var(--paper-line); border-radius: 11px; color: var(--ink-dim); font-size: 13px; }
        .sub-table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .sub-table { width: 100%; min-width: 660px; border-collapse: collapse; text-align: left; font-size: 12px; }
        .sub-table th { padding: 11px 9px; border-bottom: 1px solid var(--paper-line); color: var(--ink-dim); font-size: 11px; font-weight: 700; }
        .sub-table td { max-width: 230px; padding: 12px 9px; border-bottom: 1px solid var(--paper-line); vertical-align: top; overflow-wrap: anywhere; }
        .sub-table tbody tr:last-child td { border-bottom: 0; }
        .sub-table-amount { white-space: nowrap; font-weight: 700; font-variant-numeric: tabular-nums; }
        .sub-badge { display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 999px; font-size: 10px; font-weight: 750; white-space: nowrap; }
        .sub-badge.ok { background: rgba(111,159,122,.16); color: var(--moss, #6f9f7a); }
        .sub-badge.wait { background: var(--brass-soft); color: var(--brass); }
        .sub-badge.bad { background: var(--clay-soft, rgba(196,115,90,.14)); color: var(--clay, #c4735a); }
        .sub-badge.neutral { background: var(--paper); color: var(--ink-dim); }
        .sub-status-hint { display: block; margin-top: 5px; color: var(--ink-dim); font-size: 10px; line-height: 1.4; }
        .sub-pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; color: var(--ink-dim); font-size: 12px; }
        .sub-pagination > div { display: flex; gap: 8px; }
        .sub-page-button, .sub-ghost { min-height: 40px; padding: 8px 12px; border: 1px solid var(--paper-line); border-radius: 9px; background: var(--paper-raised); color: var(--ink); font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }
        .sub-page-button:disabled, .sub-ghost:disabled { opacity: .55; cursor: not-allowed; }
        .sub-modal-bg { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(8,12,10,.64); }
        .sub-modal { width: min(100%, 440px); box-sizing: border-box; padding: 22px; border: 1px solid var(--paper-line); border-radius: 16px; background: var(--paper-raised); box-shadow: 0 20px 60px rgba(0,0,0,.24); }
        .sub-modal-title { margin: 5px 0 12px; font-size: 21px; }
        .sub-modal-plan { margin: 0; font-size: 15px; font-weight: 700; }
        .sub-modal-price { display: flex; align-items: baseline; gap: 7px; margin: 8px 0; color: var(--brass); font-size: 23px; font-weight: 750; }
        .sub-modal-price span { color: var(--ink-dim); font-size: 12px; font-weight: 500; }
        .sub-modal-note { padding: 10px; border-radius: 9px; background: var(--paper); color: var(--ink-dim); font-size: 12px; line-height: 1.5; }
        .sub-modal-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 18px; }
        .sub-modal-actions .sub-cta { width: auto; min-width: 145px; margin: 0; }
        .sub-page button:focus-visible, .sub-page a:focus-visible, .sub-modal button:focus-visible, .sub-input:focus-visible { outline: 3px solid var(--brass); outline-offset: 2px; }
        @media (max-width: 900px) {
          .sub-flow { grid-template-columns: 1fr 1fr; }
          .sub-flow-step:last-child { grid-column: 1 / -1; }
        }
        @media (max-width: 700px) {
          .sub-page { padding: 18px 14px 36px; }
          .sub-card { padding: 16px; }
          .sub-current { align-items: flex-start; flex-direction: column; gap: 16px; }
          .sub-current-meta { justify-content: flex-start; min-width: 0; gap: 14px 22px; }
          .sub-remaining { margin: -7px 0 0; text-align: left; }
          .sub-section-head { align-items: flex-start; flex-direction: column; }
          .sub-plans { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .sub-plan { min-height: 270px; padding: 16px; }
          .sub-flow { grid-template-columns: 1fr; }
          .sub-flow-step:last-child { grid-column: auto; }
        }
        @media (max-width: 480px) {
          .sub-plans { grid-template-columns: 1fr; }
          .sub-plan { min-height: 0; }
          .sub-plan-desc { min-height: 0; }
          .sub-toggle { width: 100%; }
          .sub-toggle button { flex: 1; }
          .sub-modal-actions { flex-direction: column-reverse; }
          .sub-modal-actions .sub-cta, .sub-modal-actions .sub-ghost { width: 100%; }
          .sub-pagination { align-items: flex-start; flex-direction: column; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sub-cta { transition: none; }
        }
      `}</style>
    </div>
  )
}
