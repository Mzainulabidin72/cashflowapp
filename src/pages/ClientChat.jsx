import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getOrCreateMyConversation,
  listMessages,
  sendMessage,
  subscribeMessages,
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

  useEffect(() => {
    if (!user) return
    let unsub = null
    let cancelled = false

    async function init() {
      setLoading(true)
      setError('')
      try {
        const conv = await getOrCreateMyConversation(user.id)
        if (cancelled) return
        setConversation(conv)

        const msgs = await listMessages(conv.id)
        if (cancelled) return
        setMessages(msgs || [])

        unsub = subscribeMessages(conv.id, (row) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev
            return [
              ...prev,
              {
                id: row.id,
                conversation_id: row.conversation_id,
                sender_id: row.sender_id,
                message: row.message,
                created_at: row.created_at,
              },
            ]
          })
        })
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e.message || 'Gagal memuat chat')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!conversation || !text.trim() || sending) return
    setSending(true)
    setError('')
    try {
      await sendMessage(conversation.id, user.id, text)
      setText('')
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal kirim pesan')
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
        <h2 style={styles.title}>Chat ke Admin</h2>
      </div>

      {error && <p style={styles.err}>{error}</p>}
      {loading && <p style={styles.muted}>Memuat chat...</p>}

      <div style={styles.box}>
        <div style={styles.messages}>
          {!loading && messages.length === 0 && (
            <p style={styles.muted}>Belum ada pesan. Mulai chat dengan admin.</p>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === user?.id
            return (
              <div
                key={m.id}
                style={{
                  ...styles.bubble,
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  background: mine ? '#C9A24B' : '#1D2E28',
                  color: mine ? '#1B160A' : '#EDEAE0',
                  border: mine ? 'none' : '1px solid #2B3E37',
                }}
              >
                <div style={{ fontSize: 14, lineHeight: 1.45 }}>{m.message}</div>
                <div
                  style={{
                    fontSize: 11,
                    marginTop: 4,
                    opacity: 0.7,
                    textAlign: mine ? 'right' : 'left',
                  }}
                >
                  {m.created_at
                    ? new Date(m.created_at).toLocaleString('id-ID')
                    : ''}
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
            disabled={!conversation || sending}
          />
          <button
            style={styles.btn}
            type="submit"
            disabled={!conversation || sending || !text.trim()}
          >
            {sending ? '...' : 'Kirim'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    minHeight: '100vh',
    background: '#16231F',
    color: '#EDEAE0',
    padding: 20,
    maxWidth: 720,
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  top: { marginBottom: 14 },
  back: {
    color: '#C9A24B',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
  },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: 22,
    color: '#C9A24B',
    margin: '10px 0 0',
  },
  muted: { color: '#A9B0A8', fontSize: 13 },
  err: { color: '#C4735A', fontSize: 13 },
  box: {
    background: '#1A2924',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 140px)',
    minHeight: 360,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  bubble: {
    maxWidth: '78%',
    padding: '10px 12px',
    borderRadius: 12,
  },
  form: {
    display: 'flex',
    gap: 8,
    padding: 12,
    borderTop: '1px solid #2B3E37',
  },
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
    padding: '10px 16px',
    fontWeight: 600,
    cursor: 'pointer',
  },
}
