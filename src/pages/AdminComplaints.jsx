import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  listAllComplaints,
  updateComplaintStatus,
  listComplaintMessages,
  sendComplaintMessage,
} from '../lib/complaintService'

const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED']

export default function AdminComplaints() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [active, setActive] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await listAllComplaints()
      setItems(data)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal memuat')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  async function handleStatus(status) {
    if (!active) return
    try {
      await updateComplaintStatus(active.id, status)
      setActive({ ...active, status })
      await load()
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
      <h2 style={styles.title}>Keluhan Client</h2>
      {error && <p style={styles.err}>{error}</p>}

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
              <div style={styles.muted}>
                {c.profile?.full_name || c.profile?.email || 'Client'} · {c.status}
              </div>
            </div>
          ))}
        </div>

        <div style={styles.chat}>
          {!active ? (
            <p style={styles.muted}>Pilih keluhan di kiri.</p>
          ) : (
            <>
              <div style={styles.head}>
                <div>
                  <b>{active.subject}</b>
                  <div style={styles.muted}>
                    {active.profile?.full_name || active.profile?.email || ''}
                  </div>
                </div>
                <select
                  value={active.status}
                  onChange={(e) => handleStatus(e.target.value)}
                  style={styles.select}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
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
                  placeholder="Balas keluhan..."
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
  wrap: { color: '#EDEAE0' },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: 20,
    color: '#C9A24B',
    margin: '0 0 14px',
  },
  err: { color: '#C4735A', fontSize: 13 },
  muted: { color: '#A9B0A8', fontSize: 12 },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(200px, 280px) 1fr',
    gap: 12,
    minHeight: 400,
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
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  select: {
    background: '#16231F',
    color: '#EDEAE0',
    border: '1px solid #2B3E37',
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 12,
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