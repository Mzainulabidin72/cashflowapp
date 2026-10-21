import { useMemo, useState } from 'react'
import { Target, Plus, Pencil, Trash2, PiggyBank, CheckCircle2, AlertTriangle, CalendarClock } from 'lucide-react'
import { Card, EmptyState, Field, NumInput, Tag, money } from './ui'
import { Dialog, ConfirmDialog, FormActions } from './Dialog'
import { goalProgress, timeLeftLabel, validateGoal, monthName } from '../../lib/proToolsCalc'
import { formatDate } from '../../lib/prefs'

const EMPTY = { name: '', target: '', current: '', monthly: '', targetDate: '' }

function GoalForm({ goal, today, onSave, onClose }) {
  const editing = !!goal
  const [f, setF] = useState(
    editing
      ? { name: goal.name, target: String(goal.target), current: String(goal.current || ''), monthly: String(goal.monthly || ''), targetDate: goal.targetDate || '' }
      : EMPTY
  )
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  // pratinjau hanya bila isian sudah valid
  const live = useMemo(() => {
    const v = validateGoal(f, today, { allowPastDate: true })
    return Object.keys(v.errors).length ? null : goalProgress(v.value, today)
  }, [f, today])

  async function submit(e) {
    e.preventDefault()
    // tanggal lampau hanya boleh dipertahankan saat mengedit goal yang memang sudah lewat
    const keepOld = editing && f.targetDate === (goal.targetDate || '')
    const v = validateGoal(f, today, { allowPastDate: keepOld })
    setErrors(v.errors)
    if (Object.keys(v.errors).length) return
    setBusy(true)
    setFormError('')
    try {
      await onSave({ ...(goal || {}), ...v.value })
      onClose()
    } catch (err) {
      console.error(err)
      setFormError(err?.message || 'Gagal menyimpan goal.')
      setBusy(false)
    }
  }

  return (
    <Dialog title={editing ? 'Edit goal' : 'Tambah goal'} desc="Goal disimpan di perangkat ini. Rencana setoran tidak otomatis memotong saldo dompet." onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="pt-form-grid">
          <Field label="Nama tujuan" error={errors.name} wide>
            <input className="pt-input" value={f.name} onChange={set('name')} maxLength={60} placeholder="mis. Dana darurat, Laptop baru" data-autofocus />
          </Field>
          <Field label="Target nominal" error={errors.target}>
            <NumInput value={f.target} onChange={set('target')} placeholder="0" />
          </Field>
          <Field label="Target tanggal" error={errors.targetDate} hint="Opsional">
            <input className="pt-input" type="date" value={f.targetDate} onChange={set('targetDate')} />
          </Field>
          <Field label="Nominal terkumpul" error={errors.current} hint="Uang yang benar-benar sudah kamu sisihkan.">
            <NumInput value={f.current} onChange={set('current')} placeholder="0" />
          </Field>
          <Field label="Rencana setoran per bulan" error={errors.monthly} hint="Rencana, bukan uang yang sudah disetor.">
            <NumInput value={f.monthly} onChange={set('monthly')} placeholder="0" />
          </Field>
        </div>
        {live && (
          <p className="pt-small pt-muted" style={{ margin: '12px 0 0' }} aria-live="polite">
            {live.done
              ? 'Nominal terkumpul sudah mencapai target.'
              : live.eta
              ? `Dengan setoran rutin sesuai rencana, perkiraan tercapai sekitar ${monthName(live.eta)} (${live.etaMonths} bulan lagi).`
              : live.neededMonthly != null
              ? `Agar tercapai tepat waktu, butuh sekitar ${money(live.neededMonthly)} per bulan.`
              : 'Isi rencana setoran atau target tanggal untuk melihat estimasi.'}
          </p>
        )}
        <FormActions onCancel={onClose} busy={busy} formError={formError} submitLabel={editing ? 'Simpan perubahan' : 'Tambah goal'} />
      </form>
    </Dialog>
  )
}

function DepositForm({ goal, onSave, onClose }) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    const v = Number(amount)
    if (amount === '' || !Number.isFinite(v)) return setError('Isi nominal setoran dengan angka.')
    if (v <= 0) return setError('Setoran harus lebih dari 0.')
    setBusy(true)
    setError('')
    try {
      await onSave(goal.id, v)
      onClose()
    } catch (err) {
      setError(err?.message || 'Gagal menyimpan setoran.')
      setBusy(false)
    }
  }
  return (
    <Dialog size="sm" title={`Catat setoran: ${goal.name}`} desc="Mencatat uang yang sudah kamu sisihkan untuk goal ini. Saldo dompet tidak berubah." onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <Field label="Nominal setoran" error={error}>
          <NumInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" data-autofocus />
        </Field>
        <FormActions onCancel={onClose} busy={busy} submitLabel="Catat setoran" />
      </form>
    </Dialog>
  )
}

function GoalCard({ goal, today, onEdit, onDelete, onDeposit }) {
  const p = goalProgress(goal, today)
  const status = p.done
    ? <Tag tone="ok" icon={CheckCircle2}>Tercapai</Tag>
    : p.overdue
    ? <Tag tone="danger" icon={AlertTriangle}>Lewat target</Tag>
    : p.onTrack === true
    ? <Tag tone="ok" icon={CheckCircle2}>On track</Tag>
    : p.onTrack === false
    ? <Tag tone="warn" icon={AlertTriangle}>Belum on track</Tag>
    : <Tag tone="neutral" icon={CalendarClock}>{timeLeftLabel(p)}</Tag>
  return (
    <article className="pt-goal" aria-label={`Goal ${goal.name}`}>
      <div className="pt-goal-head">
        <div style={{ minWidth: 0 }}>
          <div className="pt-goal-name">{goal.name}</div>
          <div style={{ marginTop: 4 }}>{status}</div>
        </div>
        <div className="pt-row-actions">
          <button type="button" className="pt-btn pt-btn-icon" aria-label={`Edit goal ${goal.name}`} onClick={() => onEdit(goal)}><Pencil size={16} aria-hidden="true" /></button>
          <button type="button" className="pt-btn pt-btn-icon pt-btn-danger" aria-label={`Hapus goal ${goal.name}`} onClick={() => onDelete(goal)}><Trash2 size={16} aria-hidden="true" /></button>
        </div>
      </div>

      <div>
        <div className="pt-comp-head" style={{ marginBottom: 6 }}>
          <span className="pt-muted">Progres</span>
          <strong>{Math.floor(p.pct)}%</strong>
        </div>
        <div className={'pt-bar' + (p.done ? ' is-pos' : '')} role="progressbar" aria-label={`Progres ${goal.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(p.pct)}>
          <span style={{ width: `${p.pct}%` }} />
        </div>
      </div>

      <dl className="pt-kv">
        <dt>Target</dt><dd>{money(goal.target)}</dd>
        <dt>Terkumpul</dt><dd>{money(goal.current)}</dd>
        <dt>Sisa</dt><dd>{money(p.remaining)}</dd>
        <dt>Target tanggal</dt><dd>{goal.targetDate ? `${formatDate(goal.targetDate)} · ${timeLeftLabel(p)}` : 'Tidak ditentukan'}</dd>
        <dt>Rencana setoran</dt><dd>{goal.monthly > 0 ? `${money(goal.monthly)}/bln` : 'Belum diisi'}</dd>
        {p.eta && <><dt>Estimasi selesai</dt><dd>{monthName(p.eta)}{p.onTrack === false ? ' (setelah target)' : ''}</dd></>}
        {!p.done && p.neededMonthly != null && !p.overdue && <><dt>Dibutuhkan</dt><dd>{money(p.neededMonthly)}/bln</dd></>}
      </dl>

      {!p.done && (
        <button type="button" className="pt-btn pt-btn-sm" onClick={() => onDeposit(goal)}>
          <PiggyBank size={15} aria-hidden="true" /> Catat setoran
        </button>
      )}
    </article>
  )
}

export default function GoalsSection({ goals, today, onSave, onDelete, onDeposit }) {
  const [dialog, setDialog] = useState(null) // {type:'form'|'deposit'|'delete', goal?}
  const close = () => setDialog(null)
  const sorted = goals.slice().sort((a, b) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999'))
  return (
    <Card id="pt-goals" title="Financial goals" icon={Target}
      desc="Target tabungan dengan progres dan estimasi. Nominal terkumpul adalah yang kamu catat sendiri."
      actions={<button type="button" className="pt-btn pt-btn-primary" onClick={() => setDialog({ type: 'form' })}><Plus size={16} aria-hidden="true" /> Tambah goal</button>}>
      {sorted.length === 0 ? (
        <EmptyState icon={Target} title="Belum ada goal" text="Buat goal pertamamu, mis. dana darurat atau liburan, lalu pantau progresnya di sini."
          action={<button type="button" className="pt-btn" onClick={() => setDialog({ type: 'form' })}><Plus size={16} aria-hidden="true" /> Tambah goal</button>} />
      ) : (
        <div className="pt-goals">
          {sorted.map((g) => (
            <GoalCard key={g.id} goal={g} today={today}
              onEdit={(goal) => setDialog({ type: 'form', goal })}
              onDelete={(goal) => setDialog({ type: 'delete', goal })}
              onDeposit={(goal) => setDialog({ type: 'deposit', goal })} />
          ))}
        </div>
      )}
      {dialog?.type === 'form' && <GoalForm goal={dialog.goal} today={today} onSave={onSave} onClose={close} />}
      {dialog?.type === 'deposit' && <DepositForm goal={dialog.goal} onSave={onDeposit} onClose={close} />}
      {dialog?.type === 'delete' && (
        <ConfirmDialog title={`Hapus goal "${dialog.goal.name}"?`} body={`Terkumpul ${money(dialog.goal.current)} dari ${money(dialog.goal.target)}. Goal dihapus dari perangkat ini; transaksi dan dompetmu tidak terpengaruh.`}
          onConfirm={() => onDelete(dialog.goal.id)} onClose={close} />
      )}
    </Card>
  )
}
