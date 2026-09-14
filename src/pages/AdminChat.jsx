import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  listConversations,
  listMessages,
  sendMessage,
  subscribeMessages,
} from '../lib/chatService'

export default function AdminChat() {
  const { user } = useAuth()
  const [convs, setConvs] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  async function loadConvs() {
    try {
      const data = await listConversations()
      setConvs(data)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal memuat percakapan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConvs()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    let unsub = null
    let cancelled = false

    async function load() {
      try {
        const msgs = await listMessages(selectedId)
        if (cancelled) return
        setMessages(msgs || [])

        unsub = subscribeMessages(selectedId, (row) => {
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
          // refresh list urutan kiri
          loadConvs()
        })
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e.message || 'Gagal memuat pesan')
      }
    }

    load()
    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [selectedId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!selectedId || !text.trim() || sending) return
    setSending(true)
    setError('')
    try {
      await sendMessage(selectedId, user.id, text)
      setText('')
      await loadConvs()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal kirim')
    } finally {
      setSending(false)
    }
  }

  const selected = convs.find((c) => c.id === selectedId)

  return (
    <div style={styles.wrap}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/admin" style={styles.back}>
          ← Kembali ke Admin
        </Link>
      </div>
      <h2 style={styles.title}>Chat Client</h2>
      {error && <p style={styles.err}>{error}</p>}

      <div style={styles.layout}>
        <div style={styles.list}>
          {loading && <p style={styles.muted}>Memuat...</p>}
          {!loading && convs.length === 0 && (
            <p style={styles.muted}>Belum ada percakapan</p>
          )}
          {convs.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              style={{
                ...styles.convItem,
                borderColor: selectedId === c.id ? '#C9A24B' : '#2B3E37',
                background: selectedId === c.id ? '#243830' : '#1D2E28',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                {c.profile?.full_name || c.profile?.email || 'User'}
              </div>
              <div style={{ fontSize: 11, color: '#A9B0A8', marginTop: 4 }}>
                {c.last_message_at
                  ? new Date(c.last_message_at).toLocaleString('id-ID')
                  : '—'}
              </div>
            </button>
          ))}
        </div>

        <div style={styles.chatPane}>
          {!selectedId ? (
            <p style={{ ...styles.muted, padding: 16 }}>
              Pilih percakapan di kiri
            </p>
          ) : (
            <>
              <div style={styles.chatHead}>
                {selected?.profile?.full_name ||
                  selected?.profile?.email ||
                  'Client'}
              </div>
              <div style={styles.messages}>
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id
                  return (
                    <div
                      key={m.id}
                      style={{
                        ...styles.bubble,
                        alignSelf: mine ? 'flex-end' : 'flex-start',
                        background: mine ? '#C9A24B' : '#16231F',
                        color: mine ? '#1B160A' : '#EDEAE0',
                        border: mine ? 'none' : '1px solid #2B3E37',
                      }}
                    >
                      <div style={{ fontSize: 14 }}>{m.message}</div>
                      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
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
                  placeholder="Balas client..."
                  disabled={sending}
                />
                <button
                  style={styles.btn}
                  type="submit"
                  disabled={sending || !text.trim()}
                >
                  Kirim
                </button>
              </form>
            </>
          )}
        </div>
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
  },
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
    margin: '0 0 14px',
  },
  muted: { color: '#A9B0A8', fontSize: 13 },
  err: { color: '#C4735A', fontSize: 13 },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(200px, 280px) 1fr',
    gap: 12,
    minHeight: 'calc(100vh - 120px)',
  },
  list: {
    background: '#1A2924',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 10,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  convItem: {
    textAlign: 'left',
    border: '1px solid #2B3E37',
    borderRadius: 8,
    padding: 10,
    color: '#EDEAE0',
    cursor: 'pointer',
  },
  chatPane: {
    background: '#1A2924',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 400,
  },
  chatHead: {
    padding: '12px 14px',
    borderBottom: '1px solid #2B3E37',
    fontWeight: 600,
    color: '#C9A24B',
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
    maxWidth: '75%',
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
