import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    // Session recovery dari link email
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setReady(true)
      else setError('Link tidak valid atau sudah kedaluwarsa. Minta link baru.')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => sub?.subscription?.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Sandi minimal 6 karakter')
      return
    }
    if (password !== password2) {
      setError('Konfirmasi sandi tidak sama')
      return
    }
    setLoading(true)
    setError('')
    setMsg('')
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setMsg('Sandi berhasil diubah. Mengalihkan ke login...')
      setTimeout(() => navigate('/login'), 1500)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal mengubah sandi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>Sandi baru</h1>
        <p style={styles.sub}>Masukkan sandi baru untuk akun kamu.</p>

        {msg && <p style={styles.ok}>{msg}</p>}
        {error && <p style={styles.err}>{error}</p>}

        {ready && (
          <form onSubmit={handleSubmit}>
            <label style={styles.label}>Sandi baru</label>
            <input
              style={styles.input}
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <label style={styles.label}>Ulangi sandi</label>
            <input
              style={styles.input}
              type="password"
              required
              minLength={6}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
            />
            <button style={styles.btn} type="submit" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan sandi baru'}
            </button>
          </form>
        )}

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
