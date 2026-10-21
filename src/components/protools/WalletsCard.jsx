import { useState } from 'react'
import { Wallet, Plus, Pencil, Trash2, Landmark, Banknote, Smartphone, TrendingUp, CircleEllipsis } from 'lucide-react'
import { Card, EmptyState, Field, Notice, Tag, pctText, money } from './ui'
import { Dialog, ConfirmDialog, FormActions } from './Dialog'
import { WALLET_TYPES, walletTypeLabel } from '../../lib/proToolsCalc'

const TYPE_ICON = { cash: Banknote, bank: Landmark, ewallet: Smartphone, investment: TrendingUp, other: CircleEllipsis }

function WalletForm({ wallet, onSave, onClose }) {
  const editing = !!wallet
  const [f, setF] = useState(editing ? { name: wallet.name, type: wallet.type || 'cash', balance: String(wallet.balance_start ?? 0) } : { name: '', type: 'cash', balance: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    const errs = {}
    const name = f.name.trim()
    if (!name) errs.name = 'Nama dompet wajib diisi.'
    else if (name.length > 40) errs.name = 'Nama maksimal 40 karakter.'
    const bal = f.balance === '' ? 0 : Number(f.balance)
    if (!Number.isFinite(bal)) errs.balance = 'Saldo harus berupa angka.'
    else if (Math.abs(bal) > 1e13) errs.balance = 'Saldo terlalu besar.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setFormError('')
    try {
      await onSave({ name, type: f.type, balance_start: bal }, wallet?.id)
      onClose()
    } catch (err) {
      console.error(err)
      setFormError(err?.message || 'Gagal menyimpan dompet.')
      setBusy(false)
    }
  }

  return (
    <Dialog size="sm" title={editing ? 'Edit dompet' : 'Tambah dompet'} onClose={onClose} busy={busy}
      desc="Saldo dicatat manual. Ubah saldo di sini kapan pun nilainya berbeda dari kondisi sebenarnya.">
      <form onSubmit={submit} noValidate>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Nama dompet atau rekening" error={errors.name}>
            <input className="pt-input" value={f.name} onChange={set('name')} maxLength={40} placeholder="mis. BCA, Dompet harian" data-autofocus />
          </Field>
          <Field label="Jenis">
            <select className="pt-select" value={f.type} onChange={set('type')}>
              {WALLET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Saldo tercatat" error={errors.balance} hint="Boleh negatif, mis. untuk kartu kredit.">
            <input className="pt-input" type="number" inputMode="decimal" step="any" value={f.balance} onChange={set('balance')} placeholder="0" />
          </Field>
        </div>
        <FormActions onCancel={onClose} busy={busy} formError={formError} submitLabel={editing ? 'Simpan perubahan' : 'Tambah dompet'} />
      </form>
    </Dialog>
  )
}

export default function WalletsCard({ wallets, balances, shares, totals, onSave, onDelete, loadError }) {
  const [dialog, setDialog] = useState(null)
  const close = () => setDialog(null)
  const balanceOf = (id) => balances.find((b) => b.id === id)?.balance ?? 0
  const add = <button type="button" className="pt-btn pt-btn-primary" onClick={() => setDialog({ type: 'form' })}><Plus size={16} aria-hidden="true" /> Tambah dompet</button>
  return (
    <Card id="pt-wallets" title="Multi-wallet" icon={Wallet} desc="Pisahkan uangmu per dompet atau rekening." actions={wallets.length ? add : null}>
      {loadError && <Notice tone="danger">Dompet belum bisa dimuat: {loadError}</Notice>}
      <Notice tone="neutral">
        Saldo dompet dicatat manual dan <strong>tidak berubah otomatis</strong> oleh transaksi. Dompet bukan bagian dari arus kas, dan memindahkan uang antar dompet tidak dihitung sebagai pemasukan atau pengeluaran.
      </Notice>
      {wallets.length === 0 ? (
        <EmptyState icon={Wallet} title="Belum ada dompet" text="Tambahkan dompet atau rekening untuk melihat total saldo dan dana likuidmu." action={add} />
      ) : (
        <>
          <div className="pt-comp-head" style={{ marginBottom: 12 }}>
            <span className="pt-muted">Total saldo tercatat</span>
            <strong className="pt-num">{money(totals.total)}</strong>
          </div>
          <ul className="pt-list" aria-label="Daftar dompet">
            {wallets.map((w) => {
              const bal = balanceOf(w.id)
              const share = shares[w.id]
              const Icon = TYPE_ICON[w.type] || Wallet
              return (
                <li className="pt-row" key={w.id}>
                  <div className="pt-row-main">
                    <div className="pt-row-title">{w.name}</div>
                    <div className="pt-row-meta">
                      <Tag tone="neutral" icon={Icon}>{walletTypeLabel(w.type)}</Tag>
                      {w.type === 'investment' && <span>tidak dihitung sebagai dana likuid</span>}
                    </div>
                    {share != null && (
                      <div style={{ marginTop: 8 }}>
                        <div className="pt-bar" role="progressbar" aria-label={`Porsi ${w.name} dari total saldo`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share)}><span style={{ width: `${share}%` }} /></div>
                        <div className="pt-hint">{pctText(share, 1)} dari total saldo positif</div>
                      </div>
                    )}
                  </div>
                  <div className={'pt-num ' + (bal < 0 ? 'pt-neg' : '')} style={{ fontWeight: 600, flexShrink: 0 }}>
                    {bal < 0 ? '−' : ''}{money(Math.abs(bal))}
                  </div>
                  <div className="pt-row-actions">
                    <button type="button" className="pt-btn pt-btn-icon" aria-label={`Edit dompet ${w.name}`} onClick={() => setDialog({ type: 'form', wallet: w })}><Pencil size={16} aria-hidden="true" /></button>
                    <button type="button" className="pt-btn pt-btn-icon pt-btn-danger" aria-label={`Hapus dompet ${w.name}`} onClick={() => setDialog({ type: 'delete', wallet: w })}><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {dialog?.type === 'form' && <WalletForm wallet={dialog.wallet} onSave={onSave} onClose={close} />}
      {dialog?.type === 'delete' && (
        <ConfirmDialog title={`Hapus dompet "${dialog.wallet.name}"?`}
          body={`Saldo tercatat ${money(balanceOf(dialog.wallet.id))} akan hilang dari ringkasan. Transaksi dan data lainnya tidak terpengaruh.`}
          onConfirm={() => onDelete(dialog.wallet.id)} onClose={close} />
      )}
    </Card>
  )
}
