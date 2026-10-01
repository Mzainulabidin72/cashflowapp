import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import AdminShell from '../components/admin/AdminShell'
import {
  listConversations,
  listMessages,
  sendMessage,
  subscribeMessages,
} from '../lib/chatService'
import { getAdminBadges } from '../lib/adminStatsService'
import { runExpiryJobs, isOlderThan24h } from '../lib/expiryService'

export default function AdminChat() {
  const { user } = useAuth()
  const [convs, setConvs] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [badges, setBadges] = useState({})
  const [expiryNote, setExpiryNote] = useState('')
  const bottomRef = useRef(null)

  async function loadConvs() {
    try {
      const exp = await runExpiryJobs()
      if (exp.chats?.closed > 0) {
        setExpiryNote(
          `${exp.chats.closed} chat ditutup otomatis (>24 jam tidak aktif).`
        )
      }
      if (exp.payments?.expiredPayments > 0) {
        setExpiryNote((n) =>
          (n ? n + ' ' : '') +
          `${exp.payments.expiredPayments} pembayaran pending dibatalkan (>24 jam).`
        )
      }
      const data = await listConversations()
      // prioritaskan open; closed di bawah
      const sorted = [...(data || [])].sort((a, b) => {
        const ac = a.status === 'closed' ? 1 : 0
        const bc = b.status === 'closed' ? 1 : 0
        if (ac !== bc) return ac - bc
        return 0
      })
      setConvs(sorted)
      getAdminBadges().then(setBadges).catch(() => {})
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
            return [...prev, row]
          })
          loadConvs()
        })
      } catch (e) {
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

  const selected = convs.find((c) => c.id === selectedId)
  const closed =
    selected?.status === 'closed' ||
    selected?.status === 'CLOSED' ||
    (selected &&
      isOlderThan24h(selected.last_message_at || selected.created_at))

  async function handleSend(e) {
    e.preventDefault()
    if (!selectedId || !text.trim() || sending || closed) return
    setSending(true)
    setError('')
    try {
      await sendMessage(selectedId, user.id, text)
      setText('')
      await loadConvs()
    } catch (e) {
      setError(e.message || 'Gagal kirim')
    } finally {
      setSending(false)
    }
  }

  return (
    <AdminShell title="Chat / Support" badges={badges}>
      {error && <p className="ad-err">{error}</p>}
      {expiryNote && <p className="ad-muted">{expiryNote}</p>}
      <p className="ad-muted" style={{ marginBottom: 12 }}>
        Chat tanpa aktivitas 24 jam ditutup otomatis. Pembayaran pending &gt;24 jam
        dibatalkan otomatis.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 300px) 1fr',
          gap: 12,
          minHeight: 420,
        }}
        className="ad-chat-grid"
      >
        <div className="ad-card" style={{ margin: 0, overflow: 'auto' }}>
          <h2>Percakapan</h2>
          {loading && <p className="ad-muted">Memuat...</p>}
          {!loading && convs.length === 0 && (
            <p className="ad-muted">Belum ada percakapan</p>
          )}
          {convs.map((c) => {
            const isClosed = c.status === 'closed' || c.status === 'CLOSED'
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: 10,
                  marginBottom: 4,
                  borderRadius: 8,
                  border:
                    selectedId === c.id
                      ? '1px solid var(--ad-accent)'
                      : '1px solid transparent',
                  background:
                    selectedId === c.id
                      ? 'rgba(91,124,250,0.12)'
                      : 'transparent',
                  color: 'var(--ad-text)',
                  cursor: 'pointer',
                  opacity: isClosed ? 0.65 : 1,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {c.profile?.full_name || c.profile?.email || 'User'}
                </div>
                <div className="ad-muted" style={{ fontSize: 11 }}>
                  {isClosed ? 'Ditutup' : 'Open'}
                  {c.last_message_at
                    ? ` · ${new Date(c.last_message_at).toLocaleString('id-ID')}`
                    : ''}
                </div>
              </button>
            )
          })}
        </div>

        <div
          className="ad-card"
          style={{ margin: 0, display: 'flex', flexDirection: 'column' }}
        >
          {!selectedId && (
            <p className="ad-muted">Pilih percakapan di kiri.</p>
          )}
          {selectedId && (
            <>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>
                {selected?.profile?.full_name || selected?.profile?.email || 'User'}
                {closed && (
                  <span className="ad-muted"> · ditutup (24 jam / manual)</span>
                )}
              </div>
              <div style={{ flex: 1, overflow: 'auto', maxHeight: 360 }}>
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: mine ? 'flex-end' : 'flex-start',
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '75%',
                          padding: '8px 12px',
                          borderRadius: 12,
                          background: mine
                            ? 'linear-gradient(135deg,#5b7cfa,#8b5cf6)'
                            : 'var(--ad-bg)',
                          color: mine ? '#fff' : 'var(--ad-text)',
                          fontSize: 13,
                        }}
                      >
                        {m.message}
                        <div
                          style={{
                            fontSize: 10,
                            opacity: 0.75,
                            marginTop: 4,
                            textAlign: 'right',
                          }}
                        >
                          {m.created_at
                            ? new Date(m.created_at).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
              {!closed ? (
                <form
                  onSubmit={handleSend}
                  style={{ display: 'flex', gap: 8, marginTop: 10 }}
                >
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Balas..."
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid var(--ad-border)',
                      background: 'var(--ad-bg)',
                      color: 'var(--ad-text)',
                    }}
                  />
                  <button className="ad-btn ad-btn-primary" type="submit" disabled={sending}>
                    {sending ? '...' : 'Kirim'}
                  </button>
                </form>
              ) : (
                <p className="ad-muted" style={{ marginTop: 10 }}>
                  Percakapan ditutup. User perlu mulai chat baru untuk sesi baru.
                </p>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`
        @media (max-width: 800px) {
          .ad-chat-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </AdminShell>
  )
}
