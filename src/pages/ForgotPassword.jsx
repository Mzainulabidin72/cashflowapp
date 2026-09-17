import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    setError('')
    try {
      const redirectTo = `${window.location.origin}/reset-password`
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      )
      if (err) throw err
      setMsg(
        'Link reset sandi sudah dikirim ke email (cek inbox & folder spam).'
      )
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal mengirim email reset')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>Lupa sandi</h1>
        <p style={styles.sub}>
          Masukkan email akun. Kami kirim link untuk mengatur sandi baru.
        </p>

        {msg && <p style={styles.ok}>{msg}</p>}
        {error && <p style={styles.err}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@contoh.com"
            autoComplete="email"
          />
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Mengirim...' : 'Kirim link reset'}
          </button>
        </form>

        <p style={styles.footer}>
          <Link to="/login" style={styles.link}>
            ← Kembali ke Login
          </Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    minHeight: '100vh',
    background: '#16231F',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 14,
    padding: 24,
  },
  title: {
    margin: 0,
    fontFamily: 'Georgia, serif',
    fontSize: 22,
    color: '#C9A24B',
  },
  sub: { color: '#A9B0A8', fontSize: 13, margin: '10px 0 18px' },
  label: {
    display: 'block',
    fontSize: 12,
    color: '#A9B0A8',
    marginBottom: 6,
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
    marginBottom: 14,
  },
  btn: {
    width: '100%',
    background: '#C9A24B',
    color: '#1B160A',
    border: 'none',
    borderRadius: 8,
    padding: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  ok: { color: '#7FA37F', fontSize: 13 },
  err: { color: '#C4735A', fontSize: 13 },
  footer: { marginTop: 16, textAlign: 'center', fontSize: 13 },
  link: { color: '#C9A24B', textDecoration: 'none', fontWeight: 600 },
}
