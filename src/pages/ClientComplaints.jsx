import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  listMyComplaints,
  createComplaint,
  listComplaintMessages,
  sendComplaintMessage,
  subscribeComplaintMessages,
} from '../lib/complaintService'

function ticketCode(id) {
  if (!id) return '#KB-----'
  const s = String(id).replace(/-/g, '').slice(-4).toUpperCase()
  return `#KB-${s}`
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function statusMeta(status) {
  const s = String(status || 'OPEN').toUpperCase()
  if (s === 'CLOSED' || s === 'DONE' || s === 'RESOLVED') {
    return { key: 'closed', label: 'Selesai', cls: 'st-closed' }
  }
  if (s === 'PENDING' || s === 'WAITING') {
    return { key: 'waiting', label: 'Menunggu', cls: 'st-wait' }
  }
  if (s === 'IN_PROGRESS' || s === 'PROCESS') {
    return { key: 'process', label: 'Diproses', cls: 'st-process' }
  }
  return { key: 'open', label: 'Baru', cls: 'st-open' }
}

export default function ClientComplaints() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filter, setFilter] = useState('all') // all | open | closed
  const [showForm, setShowForm] = useState(false)
  const [formSubject, setFormSubject] = useState('')
  const [formBody, setFormBody] = useState('')
  const [mobileDetail, setMobileDetail] = useState(false)
  const bottomRef = useRef(null)

  const selected = useMemo(
    () => items.find((c) => c.id === selectedId) || null,
    [items, selectedId]
  )

  const filtered = useMemo(() => {
    if (filter === 'open') {
      return items.filter((c) => {
        const s = String(c.status || '').toUpperCase()
        return s !== 'CLOSED' && s !== 'DONE' && s !== 'RESOLVED'
      })
    }
    if (filter === 'closed') {
      return items.filter((c) => {
        const s = String(c.status || '').toUpperCase()
        return s === 'CLOSED' || s === 'DONE' || s === 'RESOLVED'
      })
    }
    return items
  }, [items, filter])

  async function loadList() {
    const data = await listMyComplaints(user.id)
    setItems(data || [])
    return data || []
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await loadList()
        if (cancelled) return
        if (data.length && !selectedId) {
          setSelectedId(data[0].id)
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e.message || 'Gagal memuat keluhan')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
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
    ;(async () => {
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
    })()
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
    if (!formSubject.trim() || creating) return
    setCreating(true)
    setError('')
    setSuccess('')
    try {
      const row = await createComplaint(user.id, formSubject.trim())
      // Deskripsi → pesan pertama (backend belum punya kolom description)
      if (formBody.trim()) {
        await sendComplaintMessage(row.id, user.id, formBody.trim())
      }
      setFormSubject('')
      setFormBody('')
      setShowForm(false)
      setSuccess(`Keluhan ${ticketCode(row.id)} berhasil dikirim.`)
      const data = await loadList()
      setSelectedId(row.id)
      setMobileDetail(true)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal membuat keluhan')
    } finally {
      setCreating(false)
    }
  }

  async function handleSend(e) {
    e?.preventDefault?.()
    if (!selectedId || !text.trim() || sending) return
    const st = String(selected?.status || '').toUpperCase()
    if (st === 'CLOSED' || st === 'DONE' || st === 'RESOLVED') {
      setError('Keluhan sudah ditutup. Buat keluhan baru jika masih ada kendala.')
      return
    }
    setSending(true)
    setError('')
    try {
      await sendComplaintMessage(selectedId, user.id, text)
      setText('')
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal kirim balasan')
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function selectComplaint(id) {
    setSelectedId(id)
    setMobileDetail(true)
    setSuccess('')
  }

  const closed =
    selected &&
    ['CLOSED', 'DONE', 'RESOLVED'].includes(
      String(selected.status || '').toUpperCase()
    )

  return (
    <div className="cp-page">
      <div className="cp-shell">
        <div className="cp-top">
          <Link to="/dashboard" className="cp-back">
            ← Dashboard
          </Link>
          <div className="cp-head-row">
            <div>
              <h1 className="cp-h1">Keluhan &amp; Bantuan</h1>
              <p className="cp-lead">
                Laporkan kendala dan pantau penanganannya di sini. Untuk pertanyaan
                umum, gunakan Chat Admin.
              </p>
            </div>
            <button
              type="button"
              className="cp-btn-primary"
              onClick={() => setShowForm(true)}
            >
              + Buat Keluhan
            </button>
          </div>
        </div>

        {error && (
          <div className="cp-alert cp-alert-err" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="cp-alert cp-alert-ok" role="status">
            {success}
          </div>
        )}

        <div className={'cp-grid' + (mobileDetail ? ' cp-show-detail' : '')}>
          {/* LIST */}
          <aside className="cp-list-panel">
            <div className="cp-filters">
              {[
                ['all', 'Semua'],
                ['open', 'Aktif'],
                ['closed', 'Selesai'],
              ].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={'cp-chip' + (filter === k ? ' is-on' : '')}
                  onClick={() => setFilter(k)}
                >
                  {label}
                </button>
              ))}
            </div>

            {loading && <p className="cp-muted">Memuat keluhan...</p>}

            {!loading && filtered.length === 0 && (
              <div className="cp-empty-list">
                <p className="cp-empty-title">Belum ada keluhan</p>
                <p className="cp-muted">
                  Jika mengalami kendala, buat keluhan baru agar tim support bisa
                  menanganinya.
                </p>
                <button
                  type="button"
                  className="cp-btn-primary"
                  onClick={() => setShowForm(true)}
                >
                  + Buat Keluhan
                </button>
              </div>
            )}

            <div className="cp-list">
              {filtered.map((c) => {
                const st = statusMeta(c.status)
                const active = c.id === selectedId
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={'cp-item' + (active ? ' is-active' : '')}
                    onClick={() => selectComplaint(c.id)}
                  >
                    <div className="cp-item-top">
                      <span className="cp-item-subject">{c.subject || '(Tanpa subjek)'}</span>
                      <span className={'cp-badge ' + st.cls}>{st.label}</span>
                    </div>
                    <div className="cp-item-meta">
                      <span>{ticketCode(c.id)}</span>
                      <span>·</span>
                      <span>{formatDate(c.created_at)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          {/* DETAIL */}
          <section className="cp-detail-panel">
            {!selected && !loading && (
              <div className="cp-empty-detail">
                <h3>Pilih keluhan</h3>
                <p className="cp-muted">
                  Pilih salah satu keluhan di daftar untuk melihat status, detail, dan
                  balasan support.
                </p>
              </div>
            )}

            {selected && (
              <>
                <div className="cp-detail-head">
                  <button
                    type="button"
                    className="cp-mobile-back"
                    onClick={() => setMobileDetail(false)}
                  >
                    ← Daftar
                  </button>
                  <div className="cp-detail-title-row">
                    <div>
                      <h2 className="cp-h2">{selected.subject}</h2>
                      <div className="cp-item-meta">
                        <button
                          type="button"
                          className="cp-ticket"
                          title="Salin kode"
                          onClick={() => {
                            try {
                              navigator.clipboard?.writeText(ticketCode(selected.id))
                              setSuccess('Kode keluhan disalin')
                            } catch (_) {}
                          }}
                        >
                          {ticketCode(selected.id)}
                        </button>
                        <span>·</span>
                        <span>Dibuat {formatDate(selected.created_at)}</span>
                      </div>
                    </div>
                    <span className={'cp-badge ' + statusMeta(selected.status).cls}>
                      {statusMeta(selected.status).label}
                    </span>
                  </div>
                </div>

                {closed && (
                  <div className="cp-resolved">
                    ✓ Keluhan ini telah ditandai selesai / ditutup.
                  </div>
                )}

                <div className="cp-thread">
                  <div className="cp-system">
                    Keluhan dibuat · {formatDate(selected.created_at)}{' '}
                    {formatTime(selected.created_at)}
                  </div>

                  {messages.length === 0 && (
                    <p className="cp-muted" style={{ textAlign: 'center', padding: 16 }}>
                      Belum ada balasan. Tim support akan merespons di sini.
                    </p>
                  )}

                  {messages.map((m) => {
                    const mine = m.sender_id === user?.id
                    return (
                      <div
                        key={m.id}
                        className={'cp-msg-row ' + (mine ? 'is-me' : 'is-them')}
                      >
                        <div className={'cp-msg ' + (mine ? 'me' : 'them')}>
                          {!mine && (
                            <div className="cp-msg-who">Buku Kas Support</div>
                          )}
                          <div className="cp-msg-body">{m.message}</div>
                          <div className="cp-msg-time">{formatTime(m.created_at)}</div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>

                {!closed ? (
                  <form className="cp-composer" onSubmit={handleSend}>
                    <textarea
                      className="cp-ta"
                      rows={2}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={onKeyDown}
                      placeholder="Tulis balasan atau informasi tambahan..."
                      disabled={sending}
                      aria-label="Balasan"
                    />
                    <button
                      type="submit"
                      className="cp-btn-primary"
                      disabled={sending || !text.trim()}
                    >
                      {sending ? '...' : 'Kirim'}
                    </button>
                  </form>
                ) : (
                  <div className="cp-composer closed">
                    <p className="cp-muted">
                      Tidak dapat membalas keluhan yang sudah ditutup. Buat keluhan baru
                      jika masih ada masalah.
                    </p>
                    <button
                      type="button"
                      className="cp-btn-primary"
                      onClick={() => setShowForm(true)}
                    >
                      + Buat Keluhan Baru
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* MODAL CREATE */}
      {showForm && (
        <div className="cp-modal-bg" role="dialog" aria-modal="true">
          <div className="cp-modal">
            <h3 className="cp-h2">Buat Keluhan</h3>
            <p className="cp-muted">
              Jelaskan kendala secara singkat. Tim support akan menindaklanjuti.
            </p>
            <form onSubmit={handleCreate}>
              <label className="cp-label" htmlFor="cp-sub">
                Subjek
              </label>
              <input
                id="cp-sub"
                className="cp-input"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="Contoh: Aplikasi terasa lambat"
                required
                maxLength={120}
              />
              <label className="cp-label" htmlFor="cp-body">
                Deskripsi (opsional)
              </label>
              <textarea
                id="cp-body"
                className="cp-ta"
                rows={4}
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Jelaskan apa yang terjadi, kapan, dan langkah yang sudah dicoba..."
              />
              <div className="cp-modal-actions">
                <button
                  type="button"
                  className="cp-btn-ghost"
                  onClick={() => setShowForm(false)}
                  disabled={creating}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="cp-btn-primary"
                  disabled={creating || !formSubject.trim()}
                >
                  {creating ? 'Mengirim...' : 'Kirim Keluhan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .cp-page {
          min-height: 100vh;
          background: var(--paper, #16231f);
          color: var(--ink, #edeae0);
          padding: 16px;
          box-sizing: border-box;
        }
        .cp-shell {
          max-width: 1100px;
          margin: 0 auto;
        }
        .cp-back {
          color: var(--brass, #c9a24b);
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
        }
        .cp-head-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin: 10px 0 16px;
          flex-wrap: wrap;
        }
        .cp-h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .cp-h2 {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
        }
        .cp-lead {
          margin: 6px 0 0;
          font-size: 13px;
          color: var(--ink-dim, #a9b0a8);
          max-width: 520px;
          line-height: 1.45;
        }
        .cp-alert {
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .cp-alert-err {
          background: var(--clay-soft, rgba(196,115,90,0.14));
          color: var(--clay, #c4735a);
        }
        .cp-alert-ok {
          background: var(--brass-soft, rgba(201,162,75,0.14));
          color: var(--brass, #c9a24b);
        }
        .cp-grid {
          display: grid;
          grid-template-columns: minmax(280px, 340px) 1fr;
          gap: 14px;
          min-height: calc(100vh - 160px);
        }
        .cp-list-panel, .cp-detail-panel {
          background: var(--paper-raised, #1d2e28);
          border: 1px solid var(--paper-line, #2b3e37);
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 420px;
        }
        .cp-filters {
          display: flex;
          gap: 6px;
          padding: 12px;
          border-bottom: 1px solid var(--paper-line, #2b3e37);
          flex-wrap: wrap;
        }
        .cp-chip {
          border: 1px solid var(--paper-line, #2b3e37);
          background: transparent;
          color: var(--ink-dim, #a9b0a8);
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 12px;
          cursor: pointer;
        }
        .cp-chip.is-on {
          background: var(--brass-soft, rgba(201,162,75,0.14));
          color: var(--brass, #c9a24b);
          border-color: var(--brass, #c9a24b);
        }
        .cp-list {
          overflow-y: auto;
          padding: 8px;
          flex: 1;
        }
        .cp-item {
          width: 100%;
          text-align: left;
          border: 1px solid transparent;
          background: transparent;
          color: inherit;
          border-radius: 10px;
          padding: 12px;
          cursor: pointer;
          margin-bottom: 4px;
        }
        .cp-item:hover { background: var(--paper, #16231f); }
        .cp-item.is-active {
          background: var(--brass-soft, rgba(201,162,75,0.12));
          border-color: var(--paper-line, #2b3e37);
        }
        .cp-item-top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: flex-start;
        }
        .cp-item-subject {
          font-size: 13.5px;
          font-weight: 600;
          line-height: 1.35;
        }
        .cp-item-meta {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          font-size: 11.5px;
          color: var(--ink-dim, #a9b0a8);
          margin-top: 6px;
          align-items: center;
        }
        .cp-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 999px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .st-open { background: var(--brass-soft); color: var(--brass); }
        .st-process { background: rgba(122,155,184,0.2); color: #7a9bb8; }
        .st-wait { background: rgba(201,162,75,0.2); color: var(--brass); }
        .st-closed { background: rgba(127,175,159,0.2); color: var(--sage, #7faf9f); }
        .cp-detail-head { padding: 14px 16px 8px; border-bottom: 1px solid var(--paper-line); }
        .cp-detail-title-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }
        .cp-ticket {
          border: none;
          background: transparent;
          color: var(--brass);
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          padding: 0;
        }
        .cp-resolved {
          margin: 12px 16px 0;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(127,175,159,0.15);
          color: var(--sage, #7faf9f);
          font-size: 13px;
        }
        .cp-thread {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px;
        }
        .cp-system {
          text-align: center;
          font-size: 11px;
          color: var(--ink-dim);
          margin: 8px 0 14px;
        }
        .cp-msg-row { display: flex; margin-bottom: 10px; }
        .cp-msg-row.is-me { justify-content: flex-end; }
        .cp-msg-row.is-them { justify-content: flex-start; }
        .cp-msg {
          max-width: min(80%, 420px);
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 13.5px;
          line-height: 1.45;
        }
        .cp-msg.me {
          background: var(--brass);
          color: var(--btn-primary-text, #1b160a);
          border-bottom-right-radius: 4px;
        }
        .cp-msg.them {
          background: var(--paper);
          border: 1px solid var(--paper-line);
          color: var(--ink);
          border-bottom-left-radius: 4px;
        }
        .cp-msg-who {
          font-size: 11px;
          font-weight: 700;
          color: var(--brass);
          margin-bottom: 4px;
        }
        .cp-msg-time {
          font-size: 11px;
          opacity: 0.7;
          margin-top: 4px;
          text-align: right;
        }
        .cp-composer {
          display: flex;
          gap: 8px;
          padding: 12px;
          border-top: 1px solid var(--paper-line);
          align-items: flex-end;
        }
        .cp-composer.closed {
          flex-direction: column;
          align-items: stretch;
        }
        .cp-input, .cp-ta {
          width: 100%;
          box-sizing: border-box;
          border-radius: 10px;
          border: 1px solid var(--paper-line);
          background: var(--paper);
          color: var(--ink);
          padding: 10px 12px;
          font-size: 14px;
          font-family: inherit;
        }
        .cp-ta { resize: vertical; min-height: 44px; }
        .cp-label {
          display: block;
          font-size: 12px;
          color: var(--ink-dim);
          margin: 12px 0 6px;
        }
        .cp-btn-primary {
          background: var(--brass);
          color: var(--btn-primary-text, #1b160a);
          border: none;
          border-radius: 10px;
          padding: 10px 16px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          white-space: nowrap;
        }
        .cp-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
        .cp-btn-ghost {
          background: transparent;
          border: 1px solid var(--paper-line);
          color: var(--ink);
          border-radius: 10px;
          padding: 10px 16px;
          cursor: pointer;
        }
        .cp-muted { color: var(--ink-dim); font-size: 13px; line-height: 1.45; }
        .cp-empty-list, .cp-empty-detail {
          padding: 28px 18px;
          text-align: center;
          margin: auto;
        }
        .cp-empty-title { font-weight: 700; margin: 0 0 8px; }
        .cp-mobile-back {
          display: none;
          border: none;
          background: transparent;
          color: var(--brass);
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 8px;
          cursor: pointer;
          padding: 0;
        }
        .cp-modal-bg {
          position: fixed;
          inset: 0;
          background: rgba(8,12,10,0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 80;
          padding: 16px;
        }
        .cp-modal {
          width: 100%;
          max-width: 440px;
          background: var(--paper-raised);
          border: 1px solid var(--paper-line);
          border-radius: 14px;
          padding: 20px;
        }
        .cp-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 16px;
        }
        @media (max-width: 800px) {
          .cp-grid {
            grid-template-columns: 1fr;
            min-height: auto;
          }
          .cp-detail-panel { display: none; }
          .cp-grid.cp-show-detail .cp-list-panel { display: none; }
          .cp-grid.cp-show-detail .cp-detail-panel {
            display: flex;
            min-height: calc(100vh - 120px);
          }
          .cp-mobile-back { display: inline-block; }
        }
      `}</style>
    </div>
  )
}
