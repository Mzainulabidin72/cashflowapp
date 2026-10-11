import { useEffect, useState } from 'react'
import {
  User,
  Palette,
  Database,
  SlidersHorizontal,
  Sun,
  Moon,
  Download,
  Trash2,
  Lock,
  Check,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'
import {
  usePrefs,
  updatePrefs,
  resetPrefs,
  DATE_FORMATS,
  NUMBER_FORMATS,
  START_PAGES,
  formatMoney,
  formatDate,
  monthRange,
  periodLabel,
} from '../lib/prefs'
import { buildBackup, downloadJson, backupFileName } from '../lib/backupService'

const SECTIONS = [
  { id: 'set-profil', label: 'Profil & akun', Icon: User },
  { id: 'set-tampilan', label: 'Tampilan', Icon: Palette },
  { id: 'set-data', label: 'Data', Icon: Database },
  { id: 'set-transaksi', label: 'Preferensi transaksi', Icon: SlidersHorizontal },
]

const muted = { color: 'var(--ink-dim)' }

/** Pesan error dari Supabase Edge Function (isi body-nya kalau ada). */
async function functionErrorMessage(error) {
  try {
    if (error?.context?.status === 404) {
      return 'Fitur hapus akun belum aktif di server (edge function "delete-account" belum di-deploy).'
    }
    const body = await error?.context?.json?.()
    if (body?.error) return body.error
  } catch (_) {}
  return error?.message || 'Gagal menghapus akun.'
}

/**
 * Props:
 * - user, profile, planInfo
 * - transactions, categories, saldoAwal, paymentMethods
 * - onSaveSaldoAwal(value) → Promise
 * - onClearTransactions() → Promise   (hapus semua transaksi saja)
 * - onResetAll() → Promise            (transaksi + kategori bawaan + saldo awal 0)
 * - onGoTab(key), onToast(msg), onLogout()
 * - exportTransactionsCsv(list)
 */
export default function SettingsPage({
  user,
  profile,
  planInfo,
  transactions = [],
  categories = { income: [], expense: [] },
  saldoAwal = 0,
  paymentMethods = [],
  onSaveSaldoAwal,
  onClearTransactions,
  onResetAll,
  onGoTab,
  onToast,
  onLogout,
  exportTransactionsCsv,
}) {
  const prefs = usePrefs()
  const { mode, setMode } = useTheme()
  const toast = (m) => onToast?.(m)

  /* ---------------- Profil ---------------- */
  const [name, setName] = useState(profile?.full_name || '')
  const [nameMsg, setNameMsg] = useState(null)
  const [nameBusy, setNameBusy] = useState(false)
  useEffect(() => {
    setName(profile?.full_name || '')
  }, [profile?.full_name])

  async function saveName() {
    const v = name.trim()
    if (!v) return setNameMsg({ err: true, text: 'Nama tidak boleh kosong.' })
    if (v.length > 80) return setNameMsg({ err: true, text: 'Nama maksimal 80 karakter.' })
    setNameBusy(true)
    setNameMsg(null)
    try {
      const { error } = await supabase.from('profiles').update({ full_name: v }).eq('id', user.id)
      if (error) throw error
      // Memicu AuthContext memuat ulang profil sehingga nama di sidebar ikut berubah
      await supabase.auth.updateUser({ data: { full_name: v } })
      setNameMsg({ text: 'Nama diperbarui.' })
    } catch (e) {
      console.error(e)
      setNameMsg({ err: true, text: e?.message || 'Gagal menyimpan nama.' })
    } finally {
      setNameBusy(false)
    }
  }

  /* ---------------- Password ---------------- */
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState(null)
  const [pwBusy, setPwBusy] = useState(false)

  async function changePassword() {
    setPwMsg(null)
    if (!pw.current) return setPwMsg({ err: true, text: 'Isi password saat ini.' })
    if (pw.next.length < 8) return setPwMsg({ err: true, text: 'Password baru minimal 8 karakter.' })
    if (pw.next !== pw.confirm) return setPwMsg({ err: true, text: 'Konfirmasi password tidak sama.' })
    if (pw.next === pw.current) return setPwMsg({ err: true, text: 'Password baru harus berbeda dari yang lama.' })
    setPwBusy(true)
    try {
      // Pastikan yang mengganti benar pemilik akun
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: pw.current,
      })
      if (authErr) {
        setPwMsg({ err: true, text: 'Password saat ini salah.' })
        return
      }
      const { error } = await supabase.auth.updateUser({ password: pw.next })
      if (error) throw error
      setPw({ current: '', next: '', confirm: '' })
      setPwMsg({ text: 'Password berhasil diganti.' })
    } catch (e) {
      console.error(e)
      setPwMsg({ err: true, text: e?.message || 'Gagal mengganti password.' })
    } finally {
      setPwBusy(false)
    }
  }

  /* ---------------- Data ---------------- */
  const [backupBusy, setBackupBusy] = useState(false)

  async function backupAll() {
    setBackupBusy(true)
    try {
      const data = await buildBackup({ user, profile, transactions, categories, saldoAwal })
      downloadJson(backupFileName(), data)
      toast('Backup diunduh.')
    } catch (e) {
      console.error(e)
      toast('Gagal membuat backup.')
    } finally {
      setBackupBusy(false)
    }
  }

  function exportCsv() {
    if (!planInfo?.canUseExport) {
      toast('Export CSV tersedia di paket Basic dan Pro.')
      return
    }
    if (!transactions.length) {
      toast('Belum ada transaksi untuk diexport.')
      return
    }
    exportTransactionsCsv?.(transactions)
  }

  const [confirm, setConfirm] = useState(null) // 'clear' | 'reset' | 'delete'

  async function deleteAccount() {
    const { error } = await supabase.functions.invoke('delete-account', { body: {} })
    if (error) throw new Error(await functionErrorMessage(error))
    await onLogout?.()
  }

  /* ---------------- Preferensi transaksi ---------------- */
  const [saldo, setSaldo] = useState(String(saldoAwal ?? 0))
  const [saldoBusy, setSaldoBusy] = useState(false)
  useEffect(() => {
    setSaldo(String(saldoAwal ?? 0))
  }, [saldoAwal])

  async function saveSaldo() {
    const v = Number(saldo)
    if (!Number.isFinite(v)) return toast('Saldo awal harus berupa angka.')
    setSaldoBusy(true)
    try {
      await onSaveSaldoAwal?.(v)
      toast('Saldo awal disimpan.')
    } catch (e) {
      console.error(e)
      toast('Gagal menyimpan saldo awal.')
    } finally {
      setSaldoBusy(false)
    }
  }

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const today = new Date().toISOString().slice(0, 10)
  const range = monthRange(prefs.monthStartDay)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <h2 className="bk-serif" style={{ fontSize: 24, margin: '0 0 4px' }}>
        Pengaturan
      </h2>
      <p style={{ ...muted, fontSize: 13, margin: '0 0 14px' }}>
        Pengaturan tampilan dan preferensi tersimpan otomatis di perangkat ini.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {SECTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="bk-btn bk-btn-ghost"
            style={{ fontSize: 12.5, padding: '6px 12px' }}
            onClick={() => scrollTo(id)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ============ PROFIL & AKUN ============ */}
      <Section id="set-profil" title="Profil & akun">
        <Field label="Email">
          <input className="bk-input" value={user?.email || ''} disabled aria-label="Email" />
          <Hint>
            Paket: {planInfo?.planName || '—'}
            {profile?.role ? ` · peran: ${profile.role}` : ''}
          </Hint>
        </Field>

        <Field label="Nama lengkap">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="bk-input"
              style={{ flex: '1 1 220px' }}
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              aria-label="Nama lengkap"
            />
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              onClick={saveName}
              disabled={nameBusy || name.trim() === (profile?.full_name || '')}
            >
              {nameBusy ? 'Menyimpan…' : 'Simpan nama'}
            </button>
          </div>
          <Msg msg={nameMsg} />
        </Field>

        <div style={{ borderTop: '1px solid var(--paper-line)', margin: '16px 0 14px' }} />
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Ganti password</div>
        <div style={{ display: 'grid', gap: 10, maxWidth: 360 }}>
          <input
            className="bk-input"
            type="password"
            autoComplete="current-password"
            placeholder="Password saat ini"
            aria-label="Password saat ini"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
          />
          <input
            className="bk-input"
            type="password"
            autoComplete="new-password"
            placeholder="Password baru (min. 8 karakter)"
            aria-label="Password baru"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
          />
          <input
            className="bk-input"
            type="password"
            autoComplete="new-password"
            placeholder="Ulangi password baru"
            aria-label="Ulangi password baru"
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
          />
          <div>
            <button type="button" className="bk-btn bk-btn-primary" onClick={changePassword} disabled={pwBusy}>
              {pwBusy ? 'Memproses…' : 'Ganti password'}
            </button>
          </div>
          <Msg msg={pwMsg} />
        </div>

        <div style={{ borderTop: '1px solid var(--paper-line)', margin: '18px 0 14px' }} />
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--clay)', marginBottom: 4 }}>Hapus akun</div>
        <p style={{ ...muted, fontSize: 12.5, lineHeight: 1.5, margin: '0 0 10px' }}>
          Menghapus akun beserta seluruh transaksi, kategori, dan data lainnya secara permanen. Tindakan
          ini tidak bisa dibatalkan, jadi unduh backup dulu di bagian Data. Kalau punya langganan
          berbayar, hubungi admin lewat Chat Admin sebelum menghapus akun.
        </p>
        <button type="button" className="bk-btn bk-btn-ghost" style={{ color: 'var(--clay)' }} onClick={() => setConfirm('delete')}>
          <Trash2 size={14} /> Hapus akun saya
        </button>
      </Section>

      {/* ============ TAMPILAN ============ */}
      <Section id="set-tampilan" title="Tampilan">
        <Field label="Tema">
          <div role="group" aria-label="Tema" style={{ display: 'inline-flex', gap: 8 }}>
            {[
              ['light', 'Siang', Sun],
              ['dark', 'Malam', Moon],
            ].map(([m, label, Icon]) => (
              <button
                key={m}
                type="button"
                className={'bk-btn ' + (mode === m ? 'bk-btn-primary' : 'bk-btn-ghost')}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Format tanggal">
          <select
            className="bk-select"
            value={prefs.dateFormat}
            onChange={(e) => updatePrefs({ dateFormat: e.target.value })}
            aria-label="Format tanggal"
          >
            {DATE_FORMATS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Hint>Contoh: {formatDate(today)}</Hint>
        </Field>

        <Field label="Format angka">
          <select
            className="bk-select"
            value={prefs.numberFormat}
            onChange={(e) => updatePrefs({ numberFormat: e.target.value })}
            aria-label="Format angka"
          >
            {NUMBER_FORMATS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={prefs.showSymbol}
              onChange={(e) => updatePrefs({ showSymbol: e.target.checked })}
              style={{ accentColor: 'var(--brass)' }}
            />
            Tampilkan simbol "Rp"
          </label>
          <Hint>Contoh: {formatMoney(1500000)}</Hint>
        </Field>

        <Field label="Halaman awal">
          <select
            className="bk-select"
            value={prefs.startPage}
            onChange={(e) => updatePrefs({ startPage: e.target.value })}
            aria-label="Halaman awal"
          >
            {START_PAGES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Hint>Halaman yang dibuka pertama kali setiap masuk ke aplikasi.</Hint>
        </Field>

        <button type="button" className="bk-btn bk-btn-ghost" style={{ fontSize: 12.5 }} onClick={() => { resetPrefs(); toast('Pengaturan tampilan dikembalikan ke bawaan.') }}>
          Kembalikan ke bawaan
        </button>
      </Section>

      {/* ============ DATA ============ */}
      <Section id="set-data" title="Data">
        <Field label="Backup semua data">
          <p style={{ ...muted, fontSize: 12.5, lineHeight: 1.5, margin: '0 0 8px' }}>
            Unduh satu file JSON berisi transaksi, kategori, saldo awal, anggaran, dompet, dan utang.
          </p>
          <button type="button" className="bk-btn bk-btn-primary" onClick={backupAll} disabled={backupBusy}>
            <Download size={14} /> {backupBusy ? 'Menyiapkan…' : 'Unduh backup (JSON)'}
          </button>
        </Field>

        <Field label="Export transaksi">
          <p style={{ ...muted, fontSize: 12.5, lineHeight: 1.5, margin: '0 0 8px' }}>
            {transactions.length.toLocaleString('id-ID')} transaksi sebagai file CSV yang bisa dibuka di
            Excel. Untuk memasukkan data dari CSV atau Excel, pakai tombol Import di halaman Transaksi.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="bk-btn bk-btn-ghost" onClick={exportCsv} style={{ opacity: planInfo?.canUseExport ? 1 : 0.75 }}>
              {planInfo?.canUseExport ? <Download size={14} /> : <Lock size={14} />} Export CSV
              {!planInfo?.canUseExport && <span style={{ fontSize: 10, marginLeft: 4 }}>Basic</span>}
            </button>
            <button type="button" className="bk-btn bk-btn-ghost" onClick={() => onGoTab?.('transactions')}>
              Ke halaman Transaksi
            </button>
          </div>
        </Field>

        <div style={{ borderTop: '1px solid var(--paper-line)', margin: '16px 0 14px' }} />
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--clay)', marginBottom: 8 }}>Zona berbahaya</div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <button type="button" className="bk-btn bk-btn-ghost" style={{ color: 'var(--clay)' }} onClick={() => setConfirm('clear')} disabled={!transactions.length}>
              <Trash2 size={14} /> Hapus semua transaksi
            </button>
            <Hint>Kategori, saldo awal, dan anggaran tetap ada.</Hint>
          </div>
          <div>
            <button type="button" className="bk-btn bk-btn-ghost" style={{ color: 'var(--clay)' }} onClick={() => setConfirm('reset')}>
              <Trash2 size={14} /> Reset data
            </button>
            <Hint>Menghapus semua transaksi, mengembalikan kategori ke bawaan, dan mengatur saldo awal ke 0.</Hint>
          </div>
        </div>
      </Section>

      {/* ============ PREFERENSI TRANSAKSI ============ */}
      <Section id="set-transaksi" title="Preferensi transaksi">
        <Field label="Metode pembayaran bawaan">
          <select
            className="bk-select"
            value={prefs.defaultMethod}
            onChange={(e) => updatePrefs({ defaultMethod: e.target.value })}
            aria-label="Metode pembayaran bawaan"
          >
            <option value="">Tidak ada (pilih manual)</option>
            {paymentMethods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Hint>Terisi otomatis saat menambah transaksi baru.</Hint>
        </Field>

        <Field label="Tanggal mulai bulan">
          <select
            className="bk-select"
            style={{ maxWidth: 200 }}
            value={prefs.monthStartDay}
            onChange={(e) => updatePrefs({ monthStartDay: Number(e.target.value) })}
            aria-label="Tanggal mulai bulan"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d === 1 ? 'Tanggal 1 (bulan kalender)' : `Tanggal ${d}`}
              </option>
            ))}
          </select>
          <Hint>
            Berguna kalau kamu gajian di tengah bulan. Dipakai untuk filter "Bulan ini" dan anggaran
            bulanan. Periode sekarang: {formatDate(range.from)} sampai {formatDate(range.to)}
            {prefs.monthStartDay > 1 ? ` (${periodLabel(prefs.monthStartDay)})` : ''}. Grafik bulanan di
            Ringkasan tetap per bulan kalender.
          </Hint>
        </Field>

        <Field label="Saldo awal">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="bk-input bk-mono"
              style={{ flex: '1 1 180px', maxWidth: 260 }}
              type="number"
              inputMode="decimal"
              value={saldo}
              onChange={(e) => setSaldo(e.target.value)}
              aria-label="Saldo awal"
            />
            <button type="button" className="bk-btn bk-btn-primary" onClick={saveSaldo} disabled={saldoBusy || Number(saldo) === Number(saldoAwal)}>
              {saldoBusy ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
          <Hint>Saldo saat kamu mulai mencatat. Dipakai di hitungan saldo Dashboard.</Hint>
        </Field>

        <Field label="Kategori">
          <p style={{ ...muted, fontSize: 12.5, margin: '0 0 8px' }}>
            {categories.income?.length || 0} kategori pemasukan, {categories.expense?.length || 0} kategori
            pengeluaran.
          </p>
          <button type="button" className="bk-btn bk-btn-ghost" onClick={() => onGoTab?.('categories')}>
            Kelola kategori
          </button>
        </Field>
      </Section>

      {/* ============ KONFIRMASI ============ */}
      {confirm === 'clear' && (
        <ConfirmModal
          title="Hapus semua transaksi?"
          body={`${transactions.length.toLocaleString('id-ID')} transaksi akan dihapus permanen. Kategori dan saldo awal tidak berubah.`}
          word="HAPUS"
          actionLabel="Hapus transaksi"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await onClearTransactions?.()
            setConfirm(null)
          }}
        />
      )}
      {confirm === 'reset' && (
        <ConfirmModal
          title="Reset semua data?"
          body="Semua transaksi dihapus, kategori kembali ke bawaan, dan saldo awal jadi 0. Data contoh tidak dikembalikan."
          word="RESET"
          actionLabel="Reset data"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await onResetAll?.()
            setConfirm(null)
          }}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmModal
          title="Hapus akun secara permanen?"
          body={`Akun ${user?.email || ''} dan seluruh datanya akan dihapus dan tidak bisa dipulihkan.`}
          word="HAPUS AKUN"
          actionLabel="Hapus akun"
          onClose={() => setConfirm(null)}
          onConfirm={deleteAccount}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Komponen kecil                                                      */
/* ------------------------------------------------------------------ */

function Section({ id, title, children }) {
  return (
    <section id={id} className="bk-card" style={{ padding: 20, marginBottom: 16, scrollMarginTop: 12 }}>
      <h3 className="bk-serif" style={{ fontSize: 17, margin: '0 0 14px' }}>
        {title}
      </h3>
      {children}
    </section>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="bk-label" style={{ marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Hint({ children }) {
  return <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 5, lineHeight: 1.5 }}>{children}</div>
}

function Msg({ msg }) {
  if (!msg) return null
  return (
    <div
      role={msg.err ? 'alert' : 'status'}
      style={{
        display: 'flex',
        gap: 6,
        alignItems: 'flex-start',
        fontSize: 12.5,
        marginTop: 8,
        color: msg.err ? 'var(--clay)' : 'var(--brass)',
      }}
    >
      {msg.err ? <AlertCircle size={14} style={{ marginTop: 1 }} /> : <Check size={14} style={{ marginTop: 1 }} />}
      {msg.text}
    </div>
  )
}

/** Dialog konfirmasi untuk tindakan yang menghapus data: pengguna harus mengetik kata pengaman. */
function ConfirmModal({ title, body, word, actionLabel, onConfirm, onClose }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ok = typed.trim().toUpperCase() === word

  async function run() {
    setBusy(true)
    setError('')
    try {
      await onConfirm()
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Terjadi kesalahan.')
      setBusy(false)
    }
  }

  return (
    <div
      className="bk-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="bk-card" style={{ width: '100%', maxWidth: 420, padding: 22 }}>
        <h3 id="confirm-title" className="bk-serif" style={{ fontSize: 18, margin: '0 0 8px' }}>
          {title}
        </h3>
        <p style={{ ...muted, fontSize: 13.5, lineHeight: 1.5, margin: '0 0 14px' }}>{body}</p>
        <label style={{ fontSize: 12.5, display: 'block' }}>
          <div style={{ ...muted, marginBottom: 4 }}>
            Ketik <b>{word}</b> untuk melanjutkan
          </div>
          <input
            className="bk-input"
            style={{ width: '100%' }}
            value={typed}
            autoFocus
            disabled={busy}
            onChange={(e) => setTyped(e.target.value)}
            aria-label={`Ketik ${word}`}
          />
        </label>
        {error && <Msg msg={{ err: true, text: error }} />}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="bk-btn bk-btn-ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button
            type="button"
            className="bk-btn bk-btn-primary"
            style={{ background: 'var(--clay)', opacity: ok && !busy ? 1 : 0.5 }}
            onClick={run}
            disabled={!ok || busy}
          >
            {busy ? 'Memproses…' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
