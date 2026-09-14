import { Link } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  listMyComplaints,
  createComplaint,
  listComplaintMessages,
  sendComplaintMessage,
} from '../lib/complaintService'

export default function ClientComplaints() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [active, setActive] = useState(null)
  const [messages, setMessages] = useState([])
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await listMyComplaints(user.id)
      setItems(data)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal memuat keluhan')
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

  async function handleCreate(e) {
    e.preventDefault()
    if (!subject.trim()) return
    try {
      await createComplaint(user.id, subject)
      setSubject('')
      await load()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal buat keluhan')
    }
  }

  async function openItem(c) {
    setActive(c)
    try {
      const msgs = await listComplaintMessages(c.id)
      setMessages(msgs)
    } catch (e) {
      console.error(e)
      setError(e.message)
    }
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || !active) return
    try {
      await sendComplaintMessage(active.id, user.id, text)
      setText('')
      const msgs = await listComplaintMessages(active.id)
      setMessages(msgs)
    } catch (e) {
      console.error(e)
      setError(e.message)
    }
  }

  return (
    <div style={styles.wrap}>
            <div style={{ marginBottom: 12 }}>
        <Link to="/dashboard" style={{ color: '#C9A24B', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
          ← Kembali ke Dashboard
        </Link>
      </div>
      <h2 style={styles.title}>Keluhan Saya</h2>
      {error && <p style={styles.err}>{error}</p>}

      <form onSubmit={handleCreate} style={styles.createForm}>
        <input
          style={styles.input}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Judul keluhan baru..."
        />
        <button style={styles.btn} type="submit">
          Buat
        </button>
      </form>

      <div style={styles.layout}>
        <div style={styles.list}>
          {loading && <p style={styles.muted}>Memuat...</p>}
          {!loading && items.length === 0 && (
            <p style={styles.muted}>Belum ada keluhan.</p>
          )}
          {items.map((c) => (
            <div
              key={c.id}
              onClick={() => openItem(c)}
              style={{
                ...styles.item,
                borderColor: active?.id === c.id ? '#C9A24B' : '#2B3E37',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.subject}</div>
              <div style={styles.muted}>{c.status}</div>
            </div>
          ))}
        </div>

        <div style={styles.chat}>
          {!active ? (
            <p style={styles.muted}>Pilih keluhan di kiri.</p>
          ) : (
            <>
              <div style={{ marginBottom: 8, fontSize: 13 }}>
                <b>{active.subject}</b> · {active.status}
              </div>
              <div style={styles.box}>
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
                  placeholder="Tulis balasan..."
                />
                <button style={styles.btn} disabled={!text.trim()}>
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
  wrap: { maxWidth: 900, margin: '0 auto', color: '#EDEAE0' },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: 20,
    color: '#C9A24B',
    margin: '0 0 14px',
  },
  err: { color: '#C4735A', fontSize: 13 },
  muted: { color: '#A9B0A8', fontSize: 12 },
  createForm: { display: 'flex', gap: 8, marginBottom: 14 },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(180px, 260px) 1fr',
    gap: 12,
    minHeight: 380,
  },
  list: {
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 10,
    maxHeight: 480,
    overflowY: 'auto',
  },
  item: {
    border: '1px solid #2B3E37',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    cursor: 'pointer',
  },
  chat: {
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
  },
  box: {
    flex: 1,
    minHeight: 240,
    maxHeight: 360,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 10,
  },
  bubble: {
    maxWidth: '80%',
    padding: '10px 12px',
    borderRadius: 12,
    fontSize: 14,
  },
  time: { fontSize: 10, opacity: 0.7, marginTop: 4 },
  form: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #2B3E37',
    background: '#16231F',
    color: '#EDEAE0',
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