import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getOrCreateMyConversation,
  listMessages,
  sendMessage,
} from '../lib/chatService'

export default function ClientChat() {
  const { user } = useAuth()
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const conv = await getOrCreateMyConversation(user.id)
      setConversation(conv)
      const msgs = await listMessages(conv.id)
      setMessages(msgs)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal memuat chat')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) load()
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || !conversation) return
    setSending(true)
    try {
      await sendMessage(conversation.id, user.id, text)
      setText('')
      const msgs = await listMessages(conversation.id)
      setMessages(msgs)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal kirim')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.top}>
        <Link to="/dashboard" style={styles.back}>
          ← Kembali ke Dashboard
        </Link>
      </div>

      <h2 style={styles.title}>Chat ke Admin</h2>
      {error && <p style={styles.err}>{error}</p>}
      {loading ? (
        <p style={styles.muted}>Memuat...</p>
      ) : (
        <>
          <div style={styles.box}>
            {messages.length === 0 && (
              <p style={styles.muted}>Belum ada pesan. Silakan mulai chat.</p>
            )}
            {messages.map((m) => {
              const mine = m.sender_id === user.id
              return (
                <div
                  key={m.id}
                  style={{
                    ...styles.bubble,
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    background: mine ? '#C9A24B' : '#2B3E37',
                    color: mine ? '#1B160A' : '#EDEAE0',
                  }}
                >
                  {m.message}
                  <div style={styles.time}>
                    {new Date(m.created_at).toLocaleString('id-ID')}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} style={styles.form}>
            <input
              style={styles.input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tulis pesan..."
            />
            <button style={styles.btn} disabled={sending || !text.trim()}>
              {sending ? '...' : 'Kirim'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}

const styles = {
  wrap: { maxWidth: 640, margin: '0 auto' },
  top: { marginBottom: 12 },
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
  muted: { color: '#A9B0A8', fontSize: 13 },
  err: { color: '#C4735A', fontSize: 13 },
  box: {
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 14,
    minHeight: 280,
    maxHeight: 420,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  bubble: {
    maxWidth: '80%',
    padding: '10px 12px',
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 1.4,
  },
  time: { fontSize: 10, opacity: 0.7, marginTop: 4 },
  form: { display: 'flex', gap: 8, marginTop: 12 },
  input: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #2B3E37',
    background: '#16231F',
    color: '#EDEAE0',
    fontSize: 14,
  },
  btn: {
    background: '#C9A24B',
    color: '#1B160A',
    border: 'none',
    borderRadius: 8,
    padding: '0 16px',
    fontWeight: 600,
    cursor: 'pointer',
  },
}