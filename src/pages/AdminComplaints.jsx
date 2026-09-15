import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  listAllComplaints,
  updateComplaintStatus,
  listComplaintMessages,
  sendComplaintMessage,
  subscribeComplaintMessages,
} from '../lib/complaintService'

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

export default function AdminComplaints() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  async function loadList() {
    const data = await listAllComplaints()
    setItems(data)
  }

  useEffect(() => {
    let cancelled = false
    async function init() {
      setLoading(true)
      try {
        await loadList()
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e.message || 'Gagal memuat')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => {
      cancelled = true
    }
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

  async function handleStatus(status) {
    if (!selectedId) return
    try {
      await updateComplaintStatus(selectedId, status)
      await loadList()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal update status')
    }
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!selectedId || !text.trim() || sending) return
    setSending(true)
    try {
      await sendComplaintMessage(selectedId, user.id, text)
      setText('')
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal kirim')
    } finally {
      setSending(false)
    }
  }

  const selected = items.find((c) => c.id === selectedId)

  return (
    <div style={styles.wrap}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/admin" style={styles.back}>
          ← Kembali ke Admin
        </Link>
      </div>
      <h2 style={styles.title}>Keluhan Client</h2>
      {error && <p style={styles.err}>{error}</p>}

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
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                {c.profile?.full_name || c.profile?.email || 'User'}
              </div>
              <div style={{ fontSize: 12, marginTop: 2 }}>{c.subject}</div>
              <div style={{ fontSize: 11, color: '#A9B0A8', marginTop: 4 }}>
                {c.status}
              </div>
            </button>
          ))}
        </div>

        <div style={styles.pane}>
          {!selectedId ? (
            <p style={{ ...styles.muted, padding: 16 }}>Pilih keluhan</p>
          ) : (
            <>
              <div style={styles.head}>
                <div>
                  {selected?.subject}
                  <div style={{ fontSize: 12, color: '#A9B0A8', fontWeight: 400 }}>
                    {selected?.profile?.full_name || selected?.profile?.email}
                  </div>
                </div>
                <select
                  style={styles.select}
                  value={selected?.status || 'OPEN'}
                  onChange={(e) => handleStatus(e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
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
                  placeholder="Balas keluhan..."
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
    margin: '0 0 14px',
  },
  muted: { color: '#A9B0A8', fontSize: 13 },
  err: { color: '#C4735A', fontSize: 13 },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(180px, 280px) 1fr',
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  select: {
    background: '#16231F',
    color: '#EDEAE0',
    border: '1px solid #2B3E37',
    borderRadius: 6,
    padding: '6px 8px',
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
