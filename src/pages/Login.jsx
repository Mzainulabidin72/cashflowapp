import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn({ email, password })
    setLoading(false)

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email atau password salah.'
          : error.message
      )
      return
    }

    // Redirect sesuai role dijalankan di route "/"
    navigate('/')
  }

  return (
    <div style={styles.wrapper}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>CashFlow</h1>
        <p style={styles.subtitle}>Masuk ke akun kamu</p>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
          placeholder="email@contoh.com"
        />

        <label style={styles.label}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={styles.input}
          placeholder="Minimal 6 karakter"
        />

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Memproses...' : 'Masuk'}
        </button>

        <p style={styles.footer}>
          Belum punya akun?{' '}
          <Link to="/register" style={styles.link}>
            Daftar
          </Link>
        </p>
      </form>
    </div>
  )
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#16231F',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 28,
  },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: 28,
    color: '#C9A24B',
    margin: '0 0 4px',
    textAlign: 'center',
  },
  subtitle: {
    color: '#A9B0A8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    display: 'block',
    fontSize: 12,
    color: '#A9B0A8',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #2B3E37',
    background: '#16231F',
    color: '#EDEAE0',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    marginTop: 20,
    padding: '12px',
    borderRadius: 8,
    border: 'none',
    background: '#C9A24B',
    color: '#1B160A',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
  },
  error: {
    background: 'rgba(196,115,90,0.15)',
    color: '#C4735A',
    padding: '10px 12px',
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 8,
  },
  footer: {
    textAlign: 'center',
    marginTop: 18,
    fontSize: 13,
    color: '#A9B0A8',
  },
  link: {
    color: '#C9A24B',
    textDecoration: 'none',
    fontWeight: 600,
  },
}