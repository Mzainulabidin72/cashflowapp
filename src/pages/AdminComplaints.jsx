
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import AdminShell from '../components/admin/AdminShell'
import {
  listAllComplaints,
  listComplaintMessages,
  sendComplaintMessage,
  updateComplaintStatus,
  subscribeComplaintMessages,
} from '../lib/complaintService'
import { getAdminBadges } from '../lib/adminStatsService'
import { runExpiryJobs } from '../lib/expiryService'

export default function AdminComplaints() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [badges, setBadges] = useState({})
  const bottomRef = useRef(null)

  async function loadList() {
    const data = await listAllComplaints()
    setItems(data || [])
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await runExpiryJobs()
        await loadList()
        const b = await getAdminBadges()
        if (!cancelled) setBadges(b)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Gagal memuat')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedId) { setMessages([]); return }
    let unsub = null
    let cancelled = false
    ;(async () => {
      try {
        const msgs = await listComplaintMessages(selectedId)
        if (cancelled) return
        setMessages(msgs || [])
        unsub = subscribeComplaintMessages(selectedId, (row) => {
          setMessages((prev) => prev.some((m) => m.id === row.id) ? prev : [...prev, row])
        })
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    })()
    return () => { cancelled = true; if (unsub) unsub() }
  }, [selectedId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selected = items.find((c) => c.id === selectedId)

  async function handleSend(e) {
    e.preventDefault()
    if (!selectedId || !text.trim()) return
    try {
      await sendComplaintMessage(selectedId, user.id, text)
      setText('')
    } catch (e) {
      setError(e.message)
    }
  }

  async function setStatus(status) {
    try {
      await updateComplaintStatus(selectedId, status)
      await loadList()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <AdminShell title="Keluhan" badges={badges}>
      {error && <p className="ad-err">{error}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) 1fr', gap: 12 }} className="ad-chat-grid">
        <div className="ad-card" style={{ margin: 0 }}>
          <h2>Daftar keluhan</h2>
          {loading && <p className="ad-muted">Memuat...</p>}
          {items.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: 10, marginBottom: 4,
                borderRadius: 8,
                border: selectedId === c.id ? '1px solid var(--ad-accent)' : '1px solid transparent',
                background: selectedId === c.id ? 'rgba(91,124,250,0.12)' : 'transparent',
                color: 'var(--ad-text)', cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.subject}</div>
              <div className="ad-muted" style={{ fontSize: 11 }}>
                {c.status} · {c.profile?.email || c.user_id?.slice(0, 8)}
              </div>
            </button>
          ))}
        </div>
        <div className="ad-card" style={{ margin: 0 }}>
          {!selected && <p className="ad-muted">Pilih keluhan.</p>}
          {selected && (
            <>
              <h2>{selected.subject}</h2>
              <p className="ad-muted">{selected.profile?.full_name || selected.profile?.email} · {selected.status}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {['OPEN', 'IN_PROGRESS', 'CLOSED'].map((s) => (
                  <button key={s} type="button" className="ad-btn ad-btn-ghost" onClick={() => setStatus(s)}>{s}</button>
                ))}
              </div>
              <div style={{ maxHeight: 320, overflow: 'auto' }}>
                {messages.map((m) => (
                  <div key={m.id} style={{ marginBottom: 8, fontSize: 13 }}>
                    <span className="ad-muted">{m.sender_id === user?.id ? 'Anda' : 'User'} · </span>
                    {m.message}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Balas..."
                  style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--ad-border)', background: 'var(--ad-bg)', color: 'var(--ad-text)' }} />
                <button className="ad-btn ad-btn-primary" type="submit">Kirim</button>
              </form>
            </>
          )}
        </div>
      </div>
      <style>{`@media (max-width:800px){ .ad-chat-grid{grid-template-columns:1fr!important} }`}</style>
    </AdminShell>
  )
}
