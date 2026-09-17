import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import '../styles/design-tokens.css'
import '../styles/auth-layout.css'

function BrandLogo({ size = 48 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lanilaGrad" x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#C9A24B" />
        </linearGradient>
      </defs>
      <path
        d="M14 8c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v20.5c0 .3.1.6.3.8l7.4 7.4c.8.8.2 2.1-.9 2.1H16c-1.1 0-2-.9-2-2V8z"
        fill="url(#lanilaGrad)"
      />
      <path
        d="M28 28.5c4.5-1 9.2.4 12.2 3.8 1 .1.6 2.2-.6 2.2-4.2 0-8.1-1.8-10.6-4.8-.5-.6-.3-1.2-.1-1.2z"
        fill="url(#lanilaGrad)"
        opacity="0.9"
      />
    </svg>
  )
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErr, setFieldErr] = useState({ email: '', password: '' })

  function validate() {
    const next = { email: '', password: '' }
    if (!email.trim()) next.email = 'Email wajib diisi.'
    else if (!isValidEmail(email)) next.email = 'Format email tidak valid.'
    if (!password) next.password = 'Kata sandi wajib diisi.'
    setFieldErr(next)
    return !next.email && !next.password
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!validate()) return

    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (err) {
        const msg = /invalid|credentials|password|email/i.test(err.message)
          ? 'Email atau kata sandi yang Anda masukkan salah.'
          : err.message
        setError(msg)
        return
      }
      navigate('/')
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal masuk. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page" data-theme="cashflow">
      <aside className="auth-brand" aria-label="Branding">
        <div className="auth-brand-inner">
          <div className="auth-logo-row">
            <BrandLogo size={48} />
            <div className="auth-logo-text">
              <span className="auth-logo-name">Lanila</span>
              <span className="auth-logo-product">Cash Flow / Buku Kas</span>
            </div>
          </div>

          <h2 className="auth-tagline">
            Kelola keuangan dengan lebih mudah dan teratur.
          </h2>
          <p className="auth-desc">
            Better tools · brighter days — catat, pantau, dan rencanakan cash flow
            dalam satu tempat.
          </p>

          <ul className="auth-benefits">
            <li>
              <span className="check" aria-hidden="true">✓</span>
              Catat pemasukan &amp; pengeluaran harian
            </li>
            <li>
              <span className="check" aria-hidden="true">✓</span>
              Pantau cash flow dan ringkasan bulanan
            </li>
            <li>
              <span className="check" aria-hidden="true">✓</span>
              Langganan, chat support, dan tools Pro
            </li>
          </ul>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <BrandLogo size={36} />
            <div className="auth-logo-text">
              <span className="auth-logo-name" style={{ fontSize: 16 }}>Lanila</span>
              <span className="auth-logo-product">Cash Flow</span>
            </div>
          </div>

          <h1>Masuk</h1>
          <p className="welcome">Selamat datang kembali. Silakan masuk ke akun Anda.</p>

          {error && (
            <div className="ds-alert ds-alert-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="ds-field">
              <label className="ds-label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                className="ds-input"
                type="email"
                autoComplete="email"
                placeholder="nama@email.com"
                value={email}
                disabled={loading}
                aria-invalid={!!fieldErr.email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (fieldErr.email) setFieldErr((f) => ({ ...f, email: '' }))
                }}
              />
              {fieldErr.email && <p className="ds-field-error">{fieldErr.email}</p>}
            </div>

            <div className="ds-field">
              <label className="ds-label" htmlFor="login-password">Kata sandi</label>
              <div className="ds-input-wrap">
                <input
                  id="login-password"
                  className="ds-input"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi"
                  value={password}
                  disabled={loading}
                  aria-invalid={!!fieldErr.password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (fieldErr.password) setFieldErr((f) => ({ ...f, password: '' }))
                  }}
                />
                <button
                  type="button"
                  className="ds-icon-btn"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
              {fieldErr.password && <p className="ds-field-error">{fieldErr.password}</p>}
            </div>

            <div className="ds-row-between">
              <Link to="/forgot-password" className="ds-link">Lupa kata sandi?</Link>
            </div>

            <button className="ds-btn" type="submit" disabled={loading}>
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <p className="auth-footer">
            Belum punya akun?{' '}
            <Link to="/register" className="ds-link">Daftar</Link>
          </p>
        </div>
      </main>
    </div>
  )
}