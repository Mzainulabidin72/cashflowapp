import { useMemo, useRef, useState } from 'react'
import { Landmark, Plus, Pencil, Trash2, HandCoins, CheckCircle2, AlertTriangle, Clock, CalendarClock, Minus, Banknote } from 'lucide-react'
import { Card, EmptyState, Field, NumInput, Notice, Tag, money, txt } from './ui'
import { Dialog, ConfirmDialog, FormActions } from './Dialog'
import { remainingOf, isSettled, dueInfo, debtSummary, validateDebt, applyPayment } from '../../lib/proToolsCalc'
import { formatDate } from '../../lib/prefs'

const KIND = {
  debt: { tab: 'Utang saya', add: 'Tambah utang', who: 'Kepada siapa atau institusi', pay: 'Catat pembayaran', payTitle: 'Catat pembayaran', amountLabel: 'Jumlah utang awal', empty: 'Belum ada utang', emptyText: 'Catat utang agar jatuh temponya terpantau dan bebanmu terlihat di kesehatan keuangan.' },
  receivable: { tab: 'Piutang saya', add: 'Tambah piutang', who: 'Dari siapa', pay: 'Catat penerimaan', payTitle: 'Catat penerimaan', amountLabel: 'Jumlah piutang awal', empty: 'Belum ada piutang', emptyText: 'Catat uang yang dipinjam orang lain agar tidak terlupa menagih.' },
}

function DueTag({ debt, today }) {
  if (isSettled(debt)) return <Tag tone="ok" icon={CheckCircle2}>Lunas</Tag>
  const d = dueInfo(debt.due_date, today)
  if (d.status === 'overdue') return <Tag tone="danger" icon={AlertTriangle}>{d.label}</Tag>
  if (d.status === 'today') return <Tag tone="danger" icon={Clock}>{d.label}</Tag>
  if (d.status === 'soon') return <Tag tone="warn" icon={Clock}>{d.label}</Tag>
  if (d.status === 'ok') return <Tag tone="neutral" icon={CalendarClock}>{d.label}</Tag>
  return <Tag tone="neutral" icon={Minus}>{d.label}</Tag>
}

function DebtForm({ kind, debt, onSave, onClose }) {
  const editing = !!debt
  const K = KIND[kind]
  const [f, setF] = useState(editing ? { person: debt.person, amount: String(debt.amount), due_date: debt.due_date || '', note: debt.note || '' } : { person: '', amount: '', due_date: '', note: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  async function submit(e) {
    e.preventDefault()
    const v = validateDebt(f, { minAmount: editing ? Number(debt.paid) || 0 : 0 })
    setErrors(v.errors)
    if (Object.keys(v.errors).length) return
    setBusy(true)
    setFormError('')
    try {
      await onSave(v.value, debt)
      onClose()
    } catch (err) {
      console.error(err)
      setFormError(err?.message || 'Gagal menyimpan.')
      setBusy(false)
    }
  }
  return (
    <Dialog size="sm" title={editing ? `Edit ${kind === 'debt' ? 'utang' : 'piutang'}` : K.add} onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label={K.who} error={errors.person}>
            <input className="pt-input" value={f.person} onChange={set('person')} maxLength={80} data-autofocus />
          </Field>
          <Field label={K.amountLabel} error={errors.amount ? txt(errors.amount) : undefined} hint={editing && debt.paid > 0 ? `Sudah dibayar ${money(debt.paid)}.` : undefined}>
            <NumInput value={f.amount} onChange={set('amount')} placeholder="0" />
          </Field>
          <Field label="Jatuh tempo" error={errors.due_date} hint="Opsional">
            <input className="pt-input" type="date" value={f.due_date} onChange={set('due_date')} />
          </Field>
          <Field label="Catatan" error={errors.note} hint="Opsional">
            <input className="pt-input" value={f.note} onChange={set('note')} maxLength={200} />
          </Field>
        </div>
        <FormActions onCancel={onClose} busy={busy} formError={formError} submitLabel={editing ? 'Simpan perubahan' : K.add} />
      </form>
    </Dialog>
  )
}

function PayForm({ kind, debt, onPay, onClose }) {
  const K = KIND[kind]
  const left = remainingOf(debt)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    if (amount === '') return setError('Isi nominal dengan angka.')
    const r = applyPayment(debt, amount)
    if (r.error) return setError(txt(r.error))
    setBusy(true)
    setError('')
    try {
      await onPay(debt, Number(amount))
      onClose()
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Gagal menyimpan.')
      setBusy(false)
    }
  }
  return (
    <Dialog size="sm" title={`${K.payTitle}: ${debt.person}`} onClose={onClose} busy={busy}
      desc={`Sisa saat ini ${money(left)}. Ini hanya memperbarui sisa ${kind === 'debt' ? 'utang' : 'piutang'}; tidak mencatat transaksi dan tidak mengubah saldo dompet.`}>
      <form onSubmit={submit} noValidate>
        <Field label="Nominal" error={error}>
          <NumInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" data-autofocus />
        </Field>
        <button type="button" className="pt-btn pt-btn-sm" style={{ marginTop: 8 }} onClick={() => { setAmount(String(left)); setError('') }}>Isi sisa penuh ({money(left)})</button>
        <FormActions onCancel={onClose} busy={busy} submitLabel={K.pay} />
      </form>
    </Dialog>
  )
}

export default function DebtsCard({ debts, today, onSave, onPay, onDelete, loadError }) {
  const [kind, setKind] = useState('debt')
  const [dialog, setDialog] = useState(null)
  const [showSettled, setShowSettled] = useState(false)
  const tabRefs = useRef({})
  const close = () => setDialog(null)
  const K = KIND[kind]
  const sum = useMemo(() => debtSummary(debts, kind, today), [debts, kind, today])
  const rows = useMemo(() => {
    const all = debts.filter((d) => d.kind === kind)
    const open = all.filter((d) => !isSettled(d)).sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
    const settled = all.filter(isSettled)
    return { open, settled }
  }, [debts, kind])

  const onTabKey = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const next = kind === 'debt' ? 'receivable' : 'debt'
    setKind(next)
    setTimeout(() => tabRefs.current[next]?.focus(), 0)
  }
  const add = <button type="button" className="pt-btn pt-btn-primary" onClick={() => setDialog({ type: 'form' })}><Plus size={16} aria-hidden="true" /> {K.add}</button>
  const list = showSettled ? [...rows.open, ...rows.settled] : rows.open

  return (
    <Card id="pt-debts" title="Utang dan piutang" icon={Landmark} desc="Pantau kewajiban dan tagihanmu beserta jatuh temponya." actions={rows.open.length || rows.settled.length ? add : null}>
      {loadError && <Notice tone="danger">Utang dan piutang belum bisa dimuat: {loadError}</Notice>}
      <div className="pt-seg" role="tablist" aria-label="Jenis catatan" onKeyDown={onTabKey} style={{ marginBottom: 16 }}>
        {['debt', 'receivable'].map((k) => (
          <button key={k} ref={(el) => (tabRefs.current[k] = el)} type="button" role="tab" id={`pt-tab-${k}`} aria-selected={kind === k} aria-controls="pt-debt-panel" tabIndex={kind === k ? 0 : -1} onClick={() => setKind(k)}>
            {KIND[k].tab}
          </button>
        ))}
      </div>

      <div id="pt-debt-panel" role="tabpanel" aria-labelledby={`pt-tab-${kind}`}>
        <div className="pt-comp-head" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <span><span className="pt-muted">Total sisa</span> <strong className="pt-num">{money(sum.outstanding)}</strong></span>
          <span className="pt-small pt-muted">
            {sum.active} aktif
            {sum.overdue ? ` · ${sum.overdue} terlambat (${money(sum.overdueAmount)})` : ''}
            {sum.soon ? ` · ${sum.soon} ≤ 14 hari (${money(sum.soonAmount)})` : ''}
          </span>
        </div>

        {rows.open.length === 0 && rows.settled.length === 0 ? (
          <EmptyState icon={kind === 'debt' ? Landmark : HandCoins} title={K.empty} text={K.emptyText} action={add} />
        ) : (
          <>
            {rows.open.length === 0 && <p className="pt-small pt-muted" style={{ margin: '0 0 12px' }}>Semua {kind === 'debt' ? 'utang' : 'piutang'} sudah lunas.</p>}
            <ul className="pt-list" aria-label={`Daftar ${K.tab.toLowerCase()}`}>
              {list.map((d) => {
                const settled = isSettled(d)
                const left = remainingOf(d)
                return (
                  <li className="pt-row" key={d.id} style={settled ? { opacity: 0.75 } : undefined}>
                    <div className="pt-row-main">
                      <div className="pt-row-title">{d.person}</div>
                      <div className="pt-row-meta">
                        <DueTag debt={d} today={today} />
                        {d.due_date && <span>Jatuh tempo {formatDate(d.due_date)}</span>}
                      </div>
                      <div className="pt-row-meta">
                        <span>Awal {money(d.amount)}</span><span aria-hidden="true">·</span><span>Dibayar {money(d.paid || 0)}</span>
                      </div>
                      {d.note && <div className="pt-row-meta">Catatan: {d.note}</div>}
                    </div>
                    <div className="pt-num" style={{ flexShrink: 0 }}>
                      <div className="pt-hint">Sisa</div>
                      <div style={{ fontWeight: 600 }}>{money(left)}</div>
                    </div>
                    <div className="pt-row-actions">
                      {!settled && <button type="button" className="pt-btn pt-btn-icon" aria-label={`${K.pay} ${d.person}`} title={K.pay} onClick={() => setDialog({ type: 'pay', debt: d })}><Banknote size={16} aria-hidden="true" /></button>}
                      <button type="button" className="pt-btn pt-btn-icon" aria-label={`Edit ${d.person}`} onClick={() => setDialog({ type: 'form', debt: d })}><Pencil size={16} aria-hidden="true" /></button>
                      <button type="button" className="pt-btn pt-btn-icon pt-btn-danger" aria-label={`Hapus ${d.person}`} onClick={() => setDialog({ type: 'delete', debt: d })}><Trash2 size={16} aria-hidden="true" /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
            {rows.settled.length > 0 && (
              <button type="button" className="pt-btn pt-btn-sm" style={{ marginTop: 12 }} onClick={() => setShowSettled((v) => !v)} aria-pressed={showSettled}>
                {showSettled ? 'Sembunyikan yang lunas' : `Tampilkan yang lunas (${rows.settled.length})`}
              </button>
            )}
          </>
        )}
      </div>

      {dialog?.type === 'form' && <DebtForm kind={dialog.debt?.kind || kind} debt={dialog.debt} onSave={(v, debt) => onSave(v, dialog.debt?.kind || kind, debt)} onClose={close} />}
      {dialog?.type === 'pay' && <PayForm kind={kind} debt={dialog.debt} onPay={onPay} onClose={close} />}
      {dialog?.type === 'delete' && (
        <ConfirmDialog title={`Hapus catatan "${dialog.debt.person}"?`} body={`Sisa ${money(remainingOf(dialog.debt))} dari ${money(dialog.debt.amount)} akan dihapus permanen. Transaksi dan dompet tidak terpengaruh.`}
          onConfirm={() => onDelete(dialog.debt.id)} onClose={close} />
      )}
    </Card>
  )
}
