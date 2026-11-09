import { useEffect, useState } from 'react'
import { Check, Copy, Eye, EyeOff, RefreshCw, Save } from 'lucide-react'
import AdminShell from '../components/admin/AdminShell'
import { getMaintenance, setMaintenance } from '../lib/adminService'
import { getPaymentAccount, setPaymentAccount } from '../lib/paymentAccountService'
import { useLocation } from 'react-router-dom'

const EMPTY_ACCOUNT = { bank_name: '', account_number: '', account_name: '', notes: '' }
const EMPTY_MAINTENANCE = {
  enabled: false,
  title: 'Maintenance',
  message: 'Sistem sedang dalam perbaikan.',
  estimated_end: '',
}

export default function SuperAdminSettings() {
  const { pathname } = useLocation()
  const showMaintenance = pathname !== '/super-admin/bank-accounts'
  const showBank = pathname !== '/super-admin/maintenance'
  const title = pathname === '/super-admin/maintenance'
    ? 'Maintenance Mode'
    : pathname === '/super-admin/bank-accounts'
      ? 'Bank Account Settings'
      : 'System Configuration'
  const [maintenance, setMaintenanceState] = useState(EMPTY_MAINTENANCE)
  const [account, setAccount] = useState(EMPTY_ACCOUNT)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState(false)
  const [showAccountNumber, setShowAccountNumber] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [maintenanceValue, accountValue] = await Promise.all([
        getMaintenance(),
        getPaymentAccount(),
      ])
      setMaintenanceState({
        ...EMPTY_MAINTENANCE,
        ...maintenanceValue,
        enabled: !!maintenanceValue.enabled,
        estimated_end: maintenanceValue.estimated_end || '',
      })
      setAccount({ ...EMPTY_ACCOUNT, ...accountValue })
    } catch (e) {
      setError(e.message || 'Gagal memuat konfigurasi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function saveMaintenance() {
    setBusy('maintenance')
    setError('')
    setMessage('')
    try {
      await setMaintenance({
        enabled: !!maintenance.enabled,
        title: maintenance.title.trim() || EMPTY_MAINTENANCE.title,
        message: maintenance.message.trim() || EMPTY_MAINTENANCE.message,
        estimated_end: maintenance.estimated_end.trim() || null,
      })
      setMessage('Pengaturan maintenance berhasil disimpan.')
    } catch (e) {
      setError(e.message || 'Gagal menyimpan maintenance.')
    } finally {
      setBusy('')
    }
  }

  async function saveAccount() {
    setBusy('account')
    setError('')
    setMessage('')
    try {
      await setPaymentAccount(account)
      setMessage('Rekening pembayaran berhasil disimpan.')
    } catch (e) {
      setError(e.message || 'Gagal menyimpan rekening pembayaran.')
    } finally {
      setBusy('')
    }
  }

  async function copyAccountNumber() {
    try {
      await navigator.clipboard.writeText(account.account_number)
      setMessage('Nomor rekening disalin.')
      setError('')
    } catch (e) {
      setError(e.message || 'Tidak dapat menyalin nomor rekening.')
    }
  }

  return (
    <AdminShell title={title}>
      <div className="sa-settings-intro">
        <div>
          <h2>System settings</h2>
          <p>Konfigurasi platform yang digunakan oleh seluruh pengguna Lanila.</p>
        </div>
        <button type="button" className="ad-btn ad-btn-ghost" onClick={load} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      {message && <div className="sa-alert is-success" role="status"><Check size={16} />{message}</div>}
      {error && <div className="sa-alert is-error" role="alert">{error}<button type="button" onClick={load}>Coba lagi</button></div>}

      {loading ? (
        <div className="ad-card sa-skeleton-stack" aria-label="Memuat konfigurasi">
          <span /><span /><span /><span />
        </div>
      ) : (
        <div className="sa-settings-grid">
          {showMaintenance && <section className="ad-card sa-settings-card">
            <div className="sa-card-heading">
              <div><h2>Maintenance Mode</h2><p>Batasi akses pengguna selama pemeliharaan.</p></div>
              <label className="sa-switch">
                <input type="checkbox" checked={maintenance.enabled} onChange={(e) => setMaintenanceState((prev) => ({ ...prev, enabled: e.target.checked }))} />
                <span>{maintenance.enabled ? 'Aktif' : 'Nonaktif'}</span>
              </label>
            </div>
            <label className="sa-field">Judul
              <input maxLength={120} value={maintenance.title} onChange={(e) => setMaintenanceState((prev) => ({ ...prev, title: e.target.value }))} />
            </label>
            <label className="sa-field">Pesan maintenance
              <textarea maxLength={2000} rows={4} value={maintenance.message} onChange={(e) => setMaintenanceState((prev) => ({ ...prev, message: e.target.value }))} />
            </label>
            <label className="sa-field">Perkiraan selesai
              <input maxLength={120} placeholder="Contoh: 10 Nov 2026, 18:00 WIB" value={maintenance.estimated_end} onChange={(e) => setMaintenanceState((prev) => ({ ...prev, estimated_end: e.target.value }))} />
            </label>
            <div className="sa-actions-row">
              <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setPreview(true)}><Eye size={15} /> Preview</button>
              <button type="button" className="ad-btn ad-btn-primary" onClick={saveMaintenance} disabled={!!busy}><Save size={15} />{busy === 'maintenance' ? 'Menyimpan…' : 'Simpan perubahan'}</button>
            </div>
          </section>}

          {showBank && <section className="ad-card sa-settings-card">
            <div className="sa-card-heading">
              <div><h2>Bank Account Settings</h2><p>Informasi transfer manual yang ditampilkan pada halaman langganan.</p></div>
            </div>
            <label className="sa-field">Nama bank
              <input maxLength={120} value={account.bank_name} onChange={(e) => setAccount((prev) => ({ ...prev, bank_name: e.target.value }))} placeholder="BCA / Mandiri / BRI" />
            </label>
            <label className="sa-field">Nomor rekening
              <div className="sa-input-action">
                <input maxLength={80} type={showAccountNumber ? 'text' : 'password'} value={account.account_number} onChange={(e) => setAccount((prev) => ({ ...prev, account_number: e.target.value }))} autoComplete="off" />
                <button type="button" className="sa-icon-btn" onClick={() => setShowAccountNumber((value) => !value)} aria-label={showAccountNumber ? 'Sembunyikan nomor rekening' : 'Tampilkan nomor rekening'}>{showAccountNumber ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                <button type="button" className="sa-icon-btn" onClick={copyAccountNumber} disabled={!account.account_number} aria-label="Salin nomor rekening"><Copy size={16} /></button>
              </div>
            </label>
            <label className="sa-field">Atas nama
              <input maxLength={160} value={account.account_name} onChange={(e) => setAccount((prev) => ({ ...prev, account_name: e.target.value }))} />
            </label>
            <label className="sa-field">Instruksi pembayaran
              <textarea maxLength={2000} rows={4} value={account.notes} onChange={(e) => setAccount((prev) => ({ ...prev, notes: e.target.value }))} />
            </label>
            <div className="sa-actions-row">
              <span className="ad-muted">Nomor rekening hanya ditampilkan pada pengaturan ini.</span>
              <button type="button" className="ad-btn ad-btn-primary" onClick={saveAccount} disabled={!!busy}><Save size={15} />{busy === 'account' ? 'Menyimpan…' : 'Simpan rekening'}</button>
            </div>
          </section>}
        </div>
      )}

      {preview && <div className="sa-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreview(false) }}>
        <section className="sa-maintenance-preview" role="dialog" aria-modal="true" aria-labelledby="sa-preview-title">
          <span className="sa-preview-mark">LANILA</span>
          <h2 id="sa-preview-title">{maintenance.title || 'Maintenance'}</h2>
          <p>{maintenance.message || 'Sistem sedang dalam perbaikan.'}</p>
          {maintenance.estimated_end && <small>Perkiraan selesai: {maintenance.estimated_end}</small>}
          <button type="button" className="ad-btn ad-btn-primary" onClick={() => setPreview(false)}>Tutup preview</button>
        </section>
      </div>}
    </AdminShell>
  )
}
