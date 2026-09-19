import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getOrCreateMyConversation,
  listMessages,
  sendMessage,
  subscribeMessages,
} from '../lib/chatService'

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const time = d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
  if (sameDay) return time
  const date = d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  })
  return `${date}, ${time}`
}

function dateKey(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dateLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return 'Hari ini'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return 'Kemarin'
  }
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function ClientChat() {
  const { user } = useAuth()
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [stickBottom, setStickBottom] = useState(true)
  const [hasNew, setHasNew] = useState(false)
  const bottomRef = useRef(null)
  const listRef = useRef(null)
  const taRef = useRef(null)

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
          if (!stickBottom) setHasNew(true)
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
    if (stickBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setHasNew(false)
    }
  }, [messages, stickBottom])

  function onScrollList() {
    const el = listRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setStickBottom(nearBottom)
    if (nearBottom) setHasNew(false)
  }

  function autoGrow() {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }

  async function handleSend(e) {
    e?.preventDefault?.()
    if (!conversation || !text.trim() || sending) return
    setSending(true)
    setError('')
    setStickBottom(true)
    try {
      await sendMessage(conversation.id, user.id, text)
      setText('')
      if (taRef.current) {
        taRef.current.style.height = 'auto'
      }
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal kirim pesan')
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

  return (
    <div className="cs-page">
      <div className="cs-shell">
        <div className="cs-nav">
          <Link to="/dashboard" className="cs-back">
            ← Dashboard
          </Link>
        </div>

        <header className="cs-header">
          <div className="cs-avatar" aria-hidden="true">
            BK
          </div>
          <div className="cs-header-text">
            <div className="cs-title">Buku Kas Support</div>
            <div className="cs-sub">Customer Support · Biasanya membalas dalam beberapa menit</div>
          </div>
        </header>

        {error && (
          <div className="cs-error" role="alert">
            {error}
          </div>
        )}

        <div
          className="cs-messages"
          ref={listRef}
          onScroll={onScrollList}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {loading && (
            <div className="cs-empty">
              <p>Memuat percakapan...</p>
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="cs-empty">
              <div className="cs-empty-icon" aria-hidden="true">
                💬
              </div>
              <h3>Butuh bantuan?</h3>
              <p>
                Tim Buku Kas Support siap membantu. Tuliskan pertanyaan atau kendala
                kamu di bawah.
              </p>
            </div>
          )}

          {!loading &&
            messages.map((m, i) => {
              const mine = m.sender_id === user?.id
              const prev = messages[i - 1]
              const showDate =
                !prev || dateKey(prev.created_at) !== dateKey(m.created_at)
              const sameSender = prev && prev.sender_id === m.sender_id
              const tight = sameSender && !showDate

              return (
                <div key={m.id}>
                  {showDate && (
                    <div className="cs-date">
                      <span>{dateLabel(m.created_at)}</span>
                    </div>
                  )}
                  <div
                    className={
                      'cs-row ' +
                      (mine ? 'cs-row-me' : 'cs-row-them') +
                      (tight ? ' cs-tight' : '')
                    }
                  >
                    <div className={'cs-bubble ' + (mine ? 'cs-bubble-me' : 'cs-bubble-them')}>
                      <div className="cs-text">{m.message}</div>
                      <div className="cs-meta">{formatTime(m.created_at)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          <div ref={bottomRef} />
        </div>

        {hasNew && (
          <button
            type="button"
            className="cs-new"
            onClick={() => {
              setStickBottom(true)
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
              setHasNew(false)
            }}
          >
            ↓ Pesan baru
          </button>
        )}

        <form className="cs-composer" onSubmit={handleSend}>
          <textarea
            ref={taRef}
            className="cs-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              autoGrow()
            }}
            onKeyDown={onKeyDown}
            placeholder="Tulis pesan..."
            disabled={!conversation || sending}
            rows={1}
            aria-label="Tulis pesan"
          />
          <button
            className="cs-send"
            type="submit"
            disabled={!conversation || sending || !text.trim()}
            aria-label="Kirim pesan"
          >
            {sending ? '...' : 'Kirim'}
          </button>
        </form>

        <p className="cs-powered">Powered by Lanila · Buku Kas Support</p>
      </div>

      <style>{`
        .cs-page {
          min-height: 100vh;
          min-height: 100dvh;
          background: var(--paper, #16231f);
          color: var(--ink, #edeae0);
          padding: 16px;
          box-sizing: border-box;
          display: flex;
          justify-content: center;
          align-items: stretch;
        }
        .cs-shell {
          width: 100%;
          max-width: 840px;
          display: flex;
          flex-direction: column;
          background: var(--paper-raised, #1d2e28);
          border: 1px solid var(--paper-line, #2b3e37);
          border-radius: 16px;
          overflow: hidden;
          height: calc(100vh - 32px);
          height: calc(100dvh - 32px);
          min-height: 420px;
          position: relative;
        }
        .cs-nav {
          padding: 10px 16px 0;
        }
        .cs-back {
          color: var(--brass, #c9a24b);
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
        }
        .cs-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px 14px;
          border-bottom: 1px solid var(--paper-line, #2b3e37);
        }
        .cs-avatar {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: var(--brass-soft, rgba(201,162,75,0.14));
          color: var(--brass, #c9a24b);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
          flex-shrink: 0;
        }
        .cs-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--ink, #edeae0);
        }
        .cs-sub {
          font-size: 12px;
          color: var(--ink-dim, #a9b0a8);
          margin-top: 2px;
        }
        .cs-error {
          margin: 8px 16px 0;
          padding: 8px 12px;
          border-radius: 8px;
          background: var(--clay-soft, rgba(196,115,90,0.14));
          color: var(--clay, #c4735a);
          font-size: 13px;
        }
        .cs-messages {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px 8px;
          display: flex;
          flex-direction: column;
        }
        .cs-empty {
          margin: auto;
          text-align: center;
          padding: 32px 20px;
          color: var(--ink-dim, #a9b0a8);
          max-width: 320px;
        }
        .cs-empty-icon { font-size: 28px; margin-bottom: 8px; }
        .cs-empty h3 {
          margin: 0 0 8px;
          color: var(--ink, #edeae0);
          font-size: 16px;
        }
        .cs-empty p { margin: 0; font-size: 13px; line-height: 1.5; }
        .cs-date {
          display: flex;
          justify-content: center;
          margin: 12px 0 8px;
        }
        .cs-date span {
          font-size: 11px;
          color: var(--ink-dim, #a9b0a8);
          background: var(--paper, #16231f);
          padding: 4px 10px;
          border-radius: 999px;
        }
        .cs-row {
          display: flex;
          margin-bottom: 10px;
        }
        .cs-row.cs-tight { margin-bottom: 4px; }
        .cs-row-me { justify-content: flex-end; }
        .cs-row-them { justify-content: flex-start; }
        .cs-bubble {
          max-width: min(78%, 420px);
          padding: 10px 12px;
          border-radius: 14px;
          font-size: 14px;
          line-height: 1.45;
          word-break: break-word;
        }
        .cs-bubble-me {
          background: var(--brass, #c9a24b);
          color: var(--btn-primary-text, #1b160a);
          border-bottom-right-radius: 4px;
        }
        .cs-bubble-them {
          background: var(--paper, #16231f);
          color: var(--ink, #edeae0);
          border: 1px solid var(--paper-line, #2b3e37);
          border-bottom-left-radius: 4px;
        }
        .cs-meta {
          font-size: 11px;
          margin-top: 4px;
          opacity: 0.75;
        }
        .cs-bubble-me .cs-meta { text-align: right; }
        .cs-composer {
          display: flex;
          gap: 8px;
          padding: 12px 14px;
          border-top: 1px solid var(--paper-line, #2b3e37);
          align-items: flex-end;
          background: var(--paper-raised, #1d2e28);
        }
        .cs-input {
          flex: 1;
          resize: none;
          min-height: 42px;
          max-height: 140px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--paper-line, #2b3e37);
          background: var(--paper, #16231f);
          color: var(--ink, #edeae0);
          font-size: 14px;
          font-family: inherit;
          line-height: 1.4;
        }
        .cs-input:focus {
          outline: none;
          border-color: var(--brass, #c9a24b);
          box-shadow: 0 0 0 3px var(--brass-soft, rgba(201,162,75,0.14));
        }
        .cs-send {
          background: var(--brass, #c9a24b);
          color: var(--btn-primary-text, #1b160a);
          border: none;
          border-radius: 10px;
          padding: 0 16px;
          min-height: 42px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          flex-shrink: 0;
        }
        .cs-send:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .cs-new {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: 88px;
          border: 1px solid var(--paper-line, #2b3e37);
          background: var(--paper-raised, #1d2e28);
          color: var(--brass, #c9a24b);
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        }
        .cs-powered {
          margin: 0;
          padding: 6px 16px 10px;
          font-size: 11px;
          color: var(--ink-dim, #a9b0a8);
          text-align: center;
        }
        @media (max-width: 640px) {
          .cs-page { padding: 0; }
          .cs-shell {
            border-radius: 0;
            border: none;
            height: 100vh;
            height: 100dvh;
            max-width: none;
          }
        }
      `}</style>
    </div>
  )
}
