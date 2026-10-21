import { useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Dialog aksesibel: role="dialog", aria-modal, Esc menutup, fokus terkunci di dalam dialog,
 * fokus awal ke kontrol pertama dan dikembalikan ke pemicu saat ditutup.
 */
export function Dialog({ title, desc, onClose, children, size, busy = false }) {
  const ref = useRef(null)
  const titleId = useId()
  const descId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const prev = document.activeElement
    const el = ref.current
    const first = el?.querySelector('[data-autofocus]') || el?.querySelector(FOCUSABLE)
    ;(first || el)?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (!busy) closeRef.current?.()
        return
      }
      if (e.key !== 'Tab' || !el) return
      const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null)
      if (!items.length) return
      const [a, z] = [items[0], items[items.length - 1]]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (prev && prev.isConnected) prev.focus()
    }
  }, [busy])

  return (
    <div
      className="pt-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.()
      }}
    >
      <div
        ref={ref}
        className={'pt-dialog' + (size === 'sm' ? ' is-sm' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={desc ? descId : undefined}
        tabIndex={-1}
      >
        <h2 id={titleId} className="pt-dialog-title">
          {title}
        </h2>
        {desc && (
          <p id={descId} className="pt-dialog-desc">
            {desc}
          </p>
        )}
        {children}
      </div>
    </div>
  )
}

/** Dialog konfirmasi hapus/aksi berisiko. onConfirm boleh melempar error → ditampilkan di dialog. */
export function ConfirmDialog({ title, body, confirmLabel = 'Hapus', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run() {
    setBusy(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Terjadi kesalahan. Coba lagi.')
      setBusy(false)
    }
  }
  return (
    <Dialog title={title} desc={body} onClose={onClose} size="sm" busy={busy}>
      {error && (
        <div className="pt-error" role="alert">
          <AlertCircle size={13} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      <div className="pt-dialog-actions">
        <button type="button" className="pt-btn" onClick={onClose} disabled={busy} data-autofocus>
          Batal
        </button>
        <button type="button" className="pt-btn pt-btn-danger is-solid" onClick={run} disabled={busy}>
          {busy && <Loader2 size={14} className="pt-spin" aria-hidden="true" />}
          {busy ? 'Memproses…' : confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}

/** Tombol Batal/Simpan di dasar form dalam Dialog + error tingkat form + status busy. */
export function FormActions({ onCancel, busy, submitLabel = 'Simpan', formError }) {
  return (
    <>
      {formError && (
        <div className="pt-error" role="alert" style={{ marginTop: 12 }}>
          <AlertCircle size={13} aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}
      <div className="pt-dialog-actions">
        <button type="button" className="pt-btn" onClick={onCancel} disabled={busy}>
          Batal
        </button>
        <button type="submit" className="pt-btn pt-btn-primary" disabled={busy}>
          {busy && <Loader2 size={14} className="pt-spin" aria-hidden="true" />}
          {busy ? 'Menyimpan…' : submitLabel}
        </button>
      </div>
    </>
  )
}
