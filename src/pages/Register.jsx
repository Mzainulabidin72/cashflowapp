import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ThemeToggle from '../components/ThemeToggle'
import '../styles/auth-layout.css'

function BrandLogo({ size = 48 }) {
  const id = 'lanilaRegMark'
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="8" y1="4" x2="40" y2="44">
          <stop stopColor="#3B82F6" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#7C4DFF" />
        </linearGradient>
      </defs>
      <path
        d="M14 8c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v20.5c0 .3.1.6.3.8l7.4 7.4c.8.8.2 2.1-.9 2.1H16c-1.1 0-2-.9-2-2V8z"
        fill={`url(#${id})`}
      />
      <path
        d="M28 28.5c4.5-1 9.2.4 12.2 3.8 1 .1.6 2.2-.6 2.2-4.2 0-8.1-1.8-10.6-4.8-.5-.6-.3-1.2-.1-1.2z"
        fill={`url(#${id})`}
        opacity="0.9"
      />
    </svg>
  )
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())
}

function passwordStrength(pw) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { level: 0, label: 'Lemah' }
  if (score <= 3) return { level: 1, label: 'Sedang' }
  return { level: 2, label: 'Kuat' }
}

export default function Register() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [terms, setTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('form') // form | success | onboard

  const strength = useMemo(() => passwordStrength(password), [password])
  const match = confirm.length === 0 ? '' : password === confirm ? 'ok' : 'bad'

  const formValid =
    fullName.trim() &&
    isValidEmail(email) &&
    password.length >= 8 &&
    password === confirm &&
    terms

  function validate() {
    const e = {}
    if (!fullName.trim()) e.fullName = 'Nama wajib diisi.'
    if (!email.trim()) e.email = 'Email wajib diisi.'
    else if (!isValidEmail(email)) e.email = 'Email tidak valid.'
    if (!password) e.password = 'Password wajib diisi.'
    else if (password.length < 8) e.password = 'Password minimal 8 karakter.'
    if (!confirm) e.confirm = 'Ulangi password.'
    else if (password !== confirm) e.confirm = 'Password tidak sama.'
    if (!terms) e.terms = 'Centang persetujuan Terms & Privacy.'
    return e
  }

  const [fieldErr, setFieldErr] = useState({})

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const errs = validate()
    setFieldErr(errs)
    if (Object.keys(errs).length || loading) return
    setLoading(true)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${origin}/login`,
        },
      })
      if (err) {
        const msg = err.message || ''
        if (/already|registered|exists/i.test(msg)) {
          setError('Email sudah terdaftar. Silakan masuk atau gunakan email lain.')
        } else {
          setError(msg)
        }
        return
      }
      if (data?.user?.id) {
        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: fullName.trim(),
            email: email.trim(),
            role: 'user',
          })
        } catch (_) {}
      }
      setStep('success')
    } catch (err) {
      setError(err.message || 'Gagal mendaftar.')
    } finally {
      setLoading(false)
    }
  }

  function finishOnboard(target) {
    if (target === 'cashflow') navigate('/dashboard')
    else if (target === 'skip') navigate('/dashboard')
    else navigate('/dashboard')
  }

  return (
    <div className="auth-page">
      <aside className="auth-brand" aria-label="Lanila">
        <div className="auth-brand-glow" aria-hidden />
        <div className="auth-brand-inner">
          <div className="auth-logo-row">
            <BrandLogo size={48} />
            <div className="auth-logo-text">
              <span className="auth-logo-name">Lanila</span>
              <span className="auth-logo-product">Better Tools · Brighter Days</span>
            </div>
          </div>
          <h2 className="auth-tagline">
            Satu akun untuk seluruh
            <br />
            produk Lanila.
          </h2>
          <p className="auth-desc">
            Kelola keuangan, waktu, kebiasaan, dan produktivitas lain dengan identitas
            yang sama — aman, tenang, dan terpusat.
          </p>
          <ul className="auth-benefits">
            <li><span className="check">✓</span> CashFlow — Buku Kas</li>
            <li><span className="check">✓</span> Time &amp; Habit</li>
            <li><span className="check">✓</span> Productivity Tools</li>
            <li><span className="check">✓</span> Dan produk Lanila lainnya</li>
          </ul>
        </div>
      </aside>

      <div className="auth-theme-fixed">
        <ThemeToggle label />
      </div>

      <main className="auth-panel">
        <div className="auth-card">
          {step === 'form' && (
            <>
              <div className="auth-card-header">
                <div className="auth-logo-row auth-logo-row-sm">
                  <BrandLogo size={36} />
                  <span className="auth-logo-name">Lanila</span>
                </div>
                <span className="auth-product-chip">Daftar untuk menggunakan produk Lanila</span>
                <h1 className="auth-title">Buat akun Lanila</h1>
                <p className="auth-subtitle">
                  Satu akun untuk seluruh produk Lanila.
                  <br />
                  Paket awal: <strong>Gratis</strong>.
                </p>
              </div>

              <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {error && (
                  <div className="auth-alert" role="alert">
                    {error}
                  </div>
                )}

                <div className="auth-field">
                  <label htmlFor="reg-name">Nama lengkap</label>
                  <input
                    id="reg-name"
                    className="auth-input"
                    autoComplete="name"
                    placeholder="Nama lengkap"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                  />
                  {fieldErr.fullName && (
                    <span className="auth-field-error" role="alert">{fieldErr.fullName}</span>
                  )}
                </div>

                <div className="auth-field">
                  <label htmlFor="reg-email">Email</label>
                  <input
                    id="reg-email"
                    type="email"
                    className="auth-input"
                    autoComplete="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                  {fieldErr.email && (
                    <span className="auth-field-error" role="alert">{fieldErr.email}</span>
                  )}
                </div>

                <div className="auth-field">
                  <label htmlFor="reg-password">Password</label>
                  <div className="auth-input-wrap">
                    <input
                      id="reg-password"
                      type={showPw ? 'text' : 'password'}
                      className="auth-input"
                      autoComplete="new-password"
                      placeholder="Minimal 8 karakter"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="auth-eye"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {showPw ? 'Sembunyi' : 'Lihat'}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <>
                      <div className="auth-strength" aria-hidden>
                        <span className={strength.level === 0 ? 'on-weak' : strength.level === 1 ? 'on-mid' : 'on-strong'} />
                        <span className={strength.level >= 1 ? (strength.level === 1 ? 'on-mid' : 'on-strong') : ''} />
                        <span className={strength.level >= 2 ? 'on-strong' : ''} />
                      </div>
                      <div className="auth-strength-label">Kekuatan: {strength.label}</div>
                    </>
                  )}
                  {fieldErr.password && (
                    <span className="auth-field-error" role="alert">{fieldErr.password}</span>
                  )}
                </div>

                <div className="auth-field">
                  <label htmlFor="reg-confirm">Konfirmasi password</label>
                  <div className="auth-input-wrap">
                    <input
                      id="reg-confirm"
                      type={showConfirm ? 'text' : 'password'}
                      className="auth-input"
                      autoComplete="new-password"
                      placeholder="Ulangi password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="auth-eye"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? 'Sembunyikan' : 'Tampilkan'}
                    >
                      {showConfirm ? 'Sembunyi' : 'Lihat'}
                    </button>
                  </div>
                  {match === 'ok' && <div className="auth-match ok">Password cocok</div>}
                  {match === 'bad' && <div className="auth-match bad">Password tidak sama</div>}
                  {fieldErr.confirm && (
                    <span className="auth-field-error" role="alert">{fieldErr.confirm}</span>
                  )}
                </div>

                <label className="auth-terms">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                    disabled={loading}
                  />
                  <span>
                    Saya menyetujui{' '}
                    <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>
                    {' '}dan{' '}
                    <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
                  </span>
                </label>
                {fieldErr.terms && (
                  <span className="auth-field-error" role="alert" style={{ display: 'block', marginBottom: 10 }}>
                    {fieldErr.terms}
                  </span>
                )}

                <button
                  type="submit"
                  className="auth-btn auth-btn-primary"
                  disabled={loading || !formValid}
                  style={{ width: '100%' }}
                >
                  {loading ? 'Mendaftarkan…' : 'Daftar'}
                </button>

                <div className="auth-divider">atau daftar dengan</div>
                <button type="button" className="auth-social" disabled title="Segera hadir">
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.7 3.7 14.5 2.7 12 2.7 6.9 2.7 2.7 6.9 2.7 12S6.9 21.3 12 21.3c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.8H12z" />
                  </svg>
                  Lanjutkan dengan Google
                </button>

                <p className="auth-footer">
                  Sudah punya akun?{' '}
                  <Link to="/login" className="ds-link">Masuk</Link>
                </p>
              </form>
            </>
          )}

          {step === 'success' && (
            <div className="auth-success-box">
              <div className="auth-success-icon" aria-hidden>✓</div>
              <h2>Selamat datang di Lanila!</h2>
              <p>
                Account kamu berhasil dibuat.
                {email ? (
                  <>
                    {' '}Kami kirim konfirmasi ke <strong>{email.trim()}</strong>.
                  </>
                ) : null}
              </p>
              <button
                type="button"
                className="auth-btn auth-btn-primary"
                style={{ width: '100%' }}
                onClick={() => setStep('onboard')}
              >
                Lanjut
              </button>
              <p className="auth-footer">
                <Link to="/login" className="ds-link">Ke halaman masuk</Link>
              </p>
            </div>
          )}

          {step === 'onboard' && (
            <div className="auth-onboard">
              <h2 className="auth-title">Selamat datang di Lanila 👋</h2>
              <p className="auth-subtitle">Mulai dari mana?</p>
              <div className="auth-onboard-grid">
                <button type="button" className="auth-onboard-card" onClick={() => finishOnboard('cashflow')}>
                  <strong>CashFlow</strong>
                  <span>Kelola keuangan pribadi</span>
                </button>
                <button type="button" className="auth-onboard-card is-soon" disabled>
                  <strong>Time &amp; Habit</strong>
                  <span>Atur waktu dan kebiasaan · segera</span>
                </button>
                <button type="button" className="auth-onboard-card is-soon" disabled>
                  <strong>Productivity</strong>
                  <span>Tingkatkan produktivitas · segera</span>
                </button>
              </div>
              <button
                type="button"
                className="auth-btn auth-btn-ghost"
                style={{ width: '100%', marginTop: 12 }}
                onClick={() => finishOnboard('skip')}
              >
                Lewati dulu
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
