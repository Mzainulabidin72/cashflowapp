import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ThemeToggle from '../components/ThemeToggle'
import '../styles/login-auth.css'

function BrandLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="lanilaGradLoginIsolated" x1="8" y1="4" x2="40" y2="44">
          <stop stopColor="#3B82F6" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#7C4DFF" />
        </linearGradient>
      </defs>
      <path
        d="M14 8c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v20.5c0 .3.1.6.3.8l7.4 7.4c.8.8.2 2.1-.9 2.1H16c-1.1 0-2-.9-2-2V8z"
        fill="url(#lanilaGradLoginIsolated)"
      />
      <path
        d="M28 28.5c4.5-1 9.2.4 12.2 3.8 1 .1.6 2.2-.6 2.2-4.2 0-8.1-1.8-10.6-4.8-.5-.6-.3-1.2-.1-1.2z"
        fill="url(#lanilaGradLoginIsolated)"
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
    else if (!isValidEmail(email)) next.email = 'Masukkan email yang valid.'
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
        setError(
          /invalid|credentials|password|email/i.test(err.message)
            ? 'Email atau kata sandi salah.'
            : err.message
        )
        return
      }
      navigate('/')
    } catch (e) {
      setError(e.message || 'Gagal masuk.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-theme-fixed">
        <ThemeToggle />
      </div>

      <aside className="login-brand" aria-label="Branding">
        <div className="login-brand-inner">
          <div className="login-logo-row">
            <BrandLogo size={48} />
            <div>
              <span className="login-logo-name">Lanila</span>
              <span className="login-logo-product">Cash Flow / Buku Kas</span>
            </div>
          </div>
          <h2 className="login-tagline">
            Kelola keuangan dengan
            <br />
            lebih mudah dan teratur.
          </h2>
          <p className="login-desc">
            Better tools · brighter days — catat, pantau, dan rencanakan cash flow dalam satu
            tempat.
          </p>
          <ul className="login-benefits">
            <li>
              <span className="check">✓</span> Catat pemasukan &amp; pengeluaran harian
            </li>
            <li>
              <span className="check">✓</span> Pantau cash flow dan ringkasan bulanan
            </li>
            <li>
              <span className="check">✓</span> Langganan, chat support, dan tools Pro
            </li>
          </ul>
        </div>
      </aside>

      <main className="login-panel">
        <div className="login-card">
          <div className="login-card-logo">
            <BrandLogo size={36} />
            <div>
              <span className="login-logo-name" style={{ fontSize: 16 }}>
                Lanila
              </span>
              <span className="login-logo-product">Cash Flow</span>
            </div>
          </div>

          <h1 className="login-title">Masuk</h1>
          <p className="login-subtitle">
            Selamat datang kembali. Silakan masuk ke akun Anda.
          </p>

          {error && (
            <div className="login-alert" role="alert">
              {error}
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                className="login-input"
                type="email"
                autoComplete="email"
                placeholder="nama@email.com"
                value={email}
                disabled={loading}
                onChange={(e) => setEmail(e.target.value)}
              />
              {fieldErr.email && (
                <span className="login-field-error" role="alert">
                  {fieldErr.email}
                </span>
              )}
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Kata sandi</label>
              <div className="login-password-wrapper">
                <input
                  id="login-password"
                  className="login-input"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi"
                  value={password}
                  disabled={loading}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
              {fieldErr.password && (
                <span className="login-field-error" role="alert">
                  {fieldErr.password}
                </span>
              )}
            </div>

            <div className="login-forgot">
              <Link to="/forgot-password">Lupa kata sandi?</Link>
            </div>

            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <p className="login-footer">
            Belum punya akun? <Link to="/register">Daftar</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
