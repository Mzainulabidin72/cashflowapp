import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  listMyComplaints,
  createComplaint,
  listComplaintMessages,
  sendComplaintMessage,
  subscribeComplaintMessages,
} from '../lib/complaintService'

export default function ClientComplaints() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [messages, setMessages] = useState([])
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const bottomRef = useRef(null)

  async function loadList() {
    const data = await listMyComplaints(user.id)
    setItems(data)
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function init() {
      setLoading(true)
      try {
        await loadList()
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e.message || 'Gagal memuat keluhan')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    let unsub = null
    let cancelled = false

    async function load() {
      try {
        const msgs = await listComplaintMessages(selectedId)
        if (cancelled) return
        setMessages(msgs || [])
        unsub = subscribeComplaintMessages(selectedId, (row) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev
            return [...prev, row]
          })
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

  async function handleCreate(e) {
    e.preventDefault()
    if (!subject.trim()) return
    setError('')
    setMsg('')
    try {
      const row = await createComplaint(user.id, subject)
      setSubject('')
      setMsg('Keluhan dibuat')
      await loadList()
      setSelectedId(row.id)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal membuat keluhan')
    }
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!selectedId || !text.trim() || sending) return
    setSending(true)
    setError('')
    try {
      await sendComplaintMessage(selectedId, user.id, text)
      setText('')
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal kirim pesan')
    } finally {
      setSending(false)
    }
  }

  const selected = items.find((c) => c.id === selectedId)

  return (
    <div style={styles.wrap}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/dashboard" style={styles.back}>
          ← Kembali ke Dashboard
        </Link>
      </div>
      <h2 style={styles.title}>Keluhan</h2>
      {msg && <p style={styles.ok}>{msg}</p>}
      {error && <p style={styles.err}>{error}</p>}

      <form onSubmit={handleCreate} style={styles.createForm}>
        <input
          style={styles.input}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subjek keluhan baru..."
        />
        <button style={styles.btn} type="submit">
          Buat
        </button>
      </form>

      <div style={styles.layout}>
        <div style={styles.list}>
          {loading && <p style={styles.muted}>Memuat...</p>}
          {!loading && items.length === 0 && (
            <p style={styles.muted}>Belum ada keluhan</p>
          )}
          {items.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              style={{
                ...styles.item,
                borderColor: selectedId === c.id ? '#C9A24B' : '#2B3E37',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.subject}</div>
              <div style={{ fontSize: 11, color: '#A9B0A8', marginTop: 4 }}>
                {c.status} ·{' '}
                {c.created_at
                  ? new Date(c.created_at).toLocaleDateString('id-ID')
                  : ''}
              </div>
            </button>
          ))}
        </div>

        <div style={styles.pane}>
          {!selectedId ? (
            <p style={{ ...styles.muted, padding: 16 }}>Pilih keluhan di kiri</p>
          ) : (
            <>
              <div style={styles.head}>
                {selected?.subject || 'Keluhan'} · {selected?.status}
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
                        background: mine ? '#C9A24B' : '#1D2E28',
                        color: mine ? '#1B160A' : '#EDEAE0',
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
                  placeholder="Tulis balasan..."
                  disabled={sending}
                />
                <button style={styles.btn} type="submit" disabled={sending}>
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
    margin: '0 0 12px',
  },
  muted: { color: '#A9B0A8', fontSize: 13 },
  err: { color: '#C4735A', fontSize: 13 },
  ok: { color: '#7FA37F', fontSize: 13 },
  createForm: { display: 'flex', gap: 8, marginBottom: 14 },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(180px, 260px) 1fr',
    gap: 12,
    minHeight: 'calc(100vh - 180px)',
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
  item: {
    textAlign: 'left',
    border: '1px solid #2B3E37',
    borderRadius: 8,
    padding: 10,
    background: '#1D2E28',
    color: '#EDEAE0',
    cursor: 'pointer',
  },
  pane: {
    background: '#1A2924',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
  },
  head: {
    padding: '12px 14px',
    borderBottom: '1px solid #2B3E37',
    fontWeight: 600,
    color: '#C9A24B',
    fontSize: 14,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 280,
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
