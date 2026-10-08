import { useMemo, useRef, useState } from 'react'
import { Upload, Download, X, Check, Lock, AlertCircle } from 'lucide-react'
import {
  readImportFile,
  analyzeTable,
  chooseTable,
  rowsFromTable,
  buildImportPlan,
  downloadImportTemplate,
  IMPORT_MAX_ROWS,
} from '../lib/importCsv'

function rupiah(n) {
  return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID')
}

const STATUS_META = {
  ok: { label: 'Siap', color: 'var(--brass)' },
  dup: { label: 'Duplikat', color: 'var(--ink-dim)' },
  quota: { label: 'Melebihi kuota', color: 'var(--clay)' },
  error: { label: 'Error', color: 'var(--clay)' },
}
const STATUS_ORDER = { error: 0, quota: 1, dup: 2, ok: 3 }
const PREVIEW_LIMIT = 100

const MAP_FIELDS = [
  { key: 'date', label: 'Tanggal', required: true },
  { key: 'amount', label: 'Jumlah', required: true },
  { key: 'type', label: 'Tipe (pemasukan/pengeluaran)' },
  { key: 'category', label: 'Kategori' },
  { key: 'description', label: 'Deskripsi' },
  { key: 'note', label: 'Catatan' },
  { key: 'method', label: 'Metode pembayaran' },
]
const SPLIT_FIELDS = [
  { key: 'incomeAmt', label: 'Kolom pemasukan' },
  { key: 'expenseAmt', label: 'Kolom pengeluaran' },
]

/**
 * Props:
 * - existing: transaksi yang sudah ada (deteksi duplikat & kuota)
 * - categories: { income, expense }
 * - planInfo: info paket (txLimitPerMonth, canUseCustomCategory)
 * - onImport(list, newCategories) → Promise<number>  (simpan ke database)
 * - onClose()
 */
export default function ImportTransactionsModal({
  existing = [],
  categories,
  planInfo,
  onImport,
  onClose,
}) {
  const [step, setStep] = useState('pick') // pick | preview | importing | done
  const [fileName, setFileName] = useState('')
  const [tables, setTables] = useState([])
  const [tableIdx, setTableIdx] = useState(0)
  const [analysis, setAnalysis] = useState(null)
  const [showMap, setShowMap] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [createCategories, setCreateCategories] = useState(false)
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)

  const canCreateCats = planInfo?.canUseCustomCategory ?? true
  const txLimit = planInfo?.txLimitPerMonth ?? null
  const table = tables[tableIdx] || null

  // Baris transaksi hasil pemetaan kolom saat ini
  const parsed = useMemo(
    () => (table && analysis ? rowsFromTable(table, analysis) : null),
    [table, analysis]
  )

  const plan = useMemo(() => {
    if (!parsed?.rows?.length) return null
    return buildImportPlan(parsed.rows, {
      existing,
      categories,
      createCategories: canCreateCats && createCategories,
      skipDuplicates,
      txLimitPerMonth: txLimit,
    })
  }, [parsed, existing, categories, createCategories, skipDuplicates, canCreateCats, txLimit])

  const previewRows = useMemo(() => {
    if (!plan) return []
    // Baris bermasalah ditaruh di atas supaya langsung kelihatan
    return plan.items
      .map((it, i) => ({ ...it, _i: i }))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a._i - b._i)
  }, [plan])

  // Label tiap kolom + contoh isinya, untuk dropdown pemetaan
  const colOptions = useMemo(() => {
    if (!table || !analysis) return []
    const rows = table.records.slice(analysis.headerIdx + 1, analysis.headerIdx + 40)
    return analysis.headers.map((h, c) => {
      const sample = rows.map((r) => String(r[c] ?? '').trim()).find(Boolean) || ''
      const short = sample.length > 16 ? sample.slice(0, 15) + '…' : sample
      return { value: c, label: short ? `${h} · ${short}` : h }
    })
  }, [table, analysis])

  // Kolom yang ditebak dari isi data (bukan dari nama kolom) → diberi tahu ke pengguna
  const guessedLabels = useMemo(() => {
    if (!analysis) return []
    return [...MAP_FIELDS, ...SPLIT_FIELDS]
      .filter((f) => analysis.sources[f.key] === 'content' && analysis.mapping[f.key] !== null)
      .map((f) => f.label.replace(/ \(.*\)$/, '').toLowerCase())
  }, [analysis])

  function runAnalysis(t, opts = {}) {
    const a = analyzeTable(t, { categories, ...opts })
    const hasAmt = a.mapping.amount !== null || a.mapping.incomeAmt !== null || a.mapping.expenseAmt !== null
    setAnalysis(a)
    setShowMap(a.mapping.date === null || !hasAmt)
  }

  async function handleFile(file) {
    setError('')
    if (!file) return
    try {
      const { tables: tbs } = await readImportFile(file)
      const idx = chooseTable(tbs, { categories })
      setTables(tbs)
      setTableIdx(idx)
      setFileName(file.name)
      setCreateCategories(false)
      runAnalysis(tbs[idx])
      setStep('preview')
    } catch (e) {
      console.error(e)
      setError(e?.message || 'File tidak bisa dibaca. Coba simpan ulang sebagai .xlsx atau CSV.')
    }
  }

  function changeSheet(i) {
    setTableIdx(i)
    runAnalysis(tables[i])
  }

  function changeMapping(key, value) {
    setAnalysis((a) => ({
      ...a,
      mapping: { ...a.mapping, [key]: value === '' ? null : Number(value) },
      sources: { ...a.sources, [key]: 'manual' },
    }))
  }

  async function handleImport() {
    if (!plan || !plan.toInsert.length) return
    setError('')
    setStep('importing')
    try {
      const count = await onImport(plan.toInsert, plan.newCategories)
      setResult({ count, failed: false })
      setStep('done')
    } catch (e) {
      console.error(e)
      const partial = e?.partial?.length || 0
      if (partial) {
        setResult({ count: partial, failed: true, message: e.message })
        setStep('done')
      } else {
        setError(e?.message || 'Gagal mengimpor transaksi.')
        setStep('preview')
      }
    }
  }

  function reset() {
    setTables([])
    setAnalysis(null)
    setFileName('')
    setError('')
    setCreateCategories(false)
    setSkipDuplicates(true)
    setStep('pick')
  }

  const busy = step === 'importing'
  const counts = plan?.counts || { ok: 0, dup: 0, error: 0, quota: 0, newCats: 0 }
  const unknownCats = plan?.unknownCategories || []

  return (
    <div
      className="bk-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="bk-card"
        style={{
          width: '100%',
          maxWidth: step === 'preview' ? 720 : 480,
          padding: 22,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <h3 id="import-title" className="bk-serif" style={{ fontSize: 18, margin: 0 }}>
            Import transaksi
          </h3>
          <button
            type="button"
            className="bk-btn bk-btn-ghost"
            style={{ padding: 6 }}
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* ---------- Langkah 1: pilih file ---------- */}
        {step === 'pick' && (
          <>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
              Pilih file Excel (<b>.xlsx</b>) atau <b>CSV</b> berisi transaksi. Kolom dicocokkan
              otomatis dari nama dan isinya, dan kamu bisa mengubahnya sebelum impor.
            </p>

            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                handleFile(e.dataTransfer.files?.[0])
              }}
              style={{
                border: `1.5px dashed ${dragOver ? 'var(--brass)' : 'var(--paper-line)'}`,
                background: dragOver ? 'var(--brass-soft)' : 'transparent',
                borderRadius: 12,
                padding: '26px 16px',
                textAlign: 'center',
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xlsm,.csv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                style={{ display: 'none' }}
                onChange={(e) => {
                  handleFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={() => inputRef.current?.click()}
              >
                <Upload size={15} /> Pilih file Excel / CSV
              </button>
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-dim)' }}>
                atau seret file ke sini · maks {IMPORT_MAX_ROWS.toLocaleString('id-ID')} baris, 5 MB
              </div>
            </div>

            {error && <ErrorLine msg={error} />}

            <ul
              style={{
                margin: '14px 0 0',
                paddingLeft: 18,
                fontSize: 12.5,
                color: 'var(--ink-dim)',
                lineHeight: 1.6,
              }}
            >
              <li>
                Cukup ada kolom <b>tanggal</b> dan <b>nominal</b>. Nama kolom bebas (Tgl, Keterangan,
                Debit/Kredit, dll) dan judul di atas tabel dilewati otomatis.
              </li>
              <li>File hasil Export CSV dari aplikasi ini bisa diimpor kembali.</li>
              <li>File .xls lama: buka di Excel, lalu simpan sebagai .xlsx atau CSV.</li>
            </ul>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button type="button" className="bk-btn bk-btn-ghost" onClick={downloadImportTemplate}>
                <Download size={14} /> Template CSV
              </button>
              <button type="button" className="bk-btn bk-btn-ghost" onClick={onClose}>
                Batal
              </button>
            </div>
          </>
        )}

        {/* ---------- Langkah 2: preview ---------- */}
        {(step === 'preview' || step === 'importing') && analysis && table && (
          <>
            <p style={{ margin: '0 0 4px', fontSize: 13.5 }}>
              <span style={{ wordBreak: 'break-all' }}>{fileName}</span>
              {tables.length > 1 && <span style={{ color: 'var(--ink-dim)' }}> · sheet "{table.name}"</span>}
              {parsed?.rows?.length > 0 && (
                <>
                  {': '}
                  <b>{counts.ok.toLocaleString('id-ID')}</b> dari{' '}
                  {parsed.rows.length.toLocaleString('id-ID')} baris siap diimpor.
                </>
              )}
            </p>
            {plan && (
              <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--ink-dim)' }}>
                {[
                  counts.dup ? `${counts.dup} duplikat dilewati` : null,
                  counts.error ? `${counts.error} baris error` : null,
                  counts.quota ? `${counts.quota} melebihi kuota` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Tidak ada baris bermasalah.'}
              </p>
            )}

            {/* ---- Pengaturan kolom ---- */}
            <div style={{ marginBottom: 10 }}>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                style={{ fontSize: 12.5, padding: '6px 10px' }}
                onClick={() => setShowMap((v) => !v)}
                disabled={busy}
                aria-expanded={showMap}
              >
                {showMap ? 'Sembunyikan pengaturan kolom' : 'Atur kolom'}
              </button>
              {!showMap && (
                <span style={{ fontSize: 12, color: 'var(--ink-dim)', marginLeft: 8 }}>
                  Kolom dicocokkan otomatis
                </span>
              )}
            </div>

            {showMap && (
              <div
                style={{
                  border: '1px solid var(--paper-line)',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  {tables.length > 1 && (
                    <label style={{ fontSize: 12.5, flex: '1 1 160px' }}>
                      <div style={{ color: 'var(--ink-dim)', marginBottom: 4 }}>Sheet</div>
                      <select
                        className="bk-select"
                        style={{ width: '100%' }}
                        value={tableIdx}
                        disabled={busy}
                        onChange={(e) => changeSheet(Number(e.target.value))}
                      >
                        {tables.map((t, i) => (
                          <option key={i} value={i}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label style={{ fontSize: 12.5, flex: '0 1 200px' }}>
                    <div style={{ color: 'var(--ink-dim)', marginBottom: 4 }}>
                      Nomor baris header (0 = tanpa header)
                    </div>
                    <input
                      className="bk-input"
                      type="number"
                      min="0"
                      style={{ width: '100%' }}
                      disabled={busy}
                      value={analysis.headerIdx >= 0 ? table.lines[analysis.headerIdx] : 0}
                      onChange={(e) =>
                        runAnalysis(table, {
                          forceHeaderLine: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                    />
                  </label>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: 10,
                  }}
                >
                  {MAP_FIELDS.map((f) => (
                    <MapSelect
                      key={f.key}
                      field={f}
                      analysis={analysis}
                      options={colOptions}
                      disabled={busy}
                      onChange={changeMapping}
                    />
                  ))}
                </div>

                <div style={{ fontSize: 12, color: 'var(--ink-dim)', margin: '12px 0 8px' }}>
                  Kalau pemasukan dan pengeluaran ada di dua kolom terpisah (misalnya Debit dan
                  Kredit), pilih keduanya di bawah dan kosongkan "Jumlah".
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: 10,
                  }}
                >
                  {SPLIT_FIELDS.map((f) => (
                    <MapSelect
                      key={f.key}
                      field={f}
                      analysis={analysis}
                      options={colOptions}
                      disabled={busy}
                      onChange={changeMapping}
                    />
                  ))}
                </div>

              </div>
            )}

            {parsed?.missing?.length > 0 && (
              <ErrorLine
                msg={`Pilih kolom untuk: ${parsed.missing.join(' dan ')}. Buka "Atur kolom" di atas.`}
              />
            )}
            {parsed?.error && <ErrorLine msg={parsed.error} />}

            {guessedLabels.length > 0 && !parsed?.missing?.length && (
              <Notice
                text={`Kolom ${guessedLabels.join(', ')} ditebak dari isi data karena nama kolomnya tidak dikenali. Periksa lewat "Atur kolom" jika ada yang keliru.`}
              />
            )}
            {parsed?.notices?.map((n) => (
              <Notice key={n} text={n} />
            ))}
            {counts.quota > 0 && (
              <Notice
                tone="warn"
                text={`Paket Gratis dibatasi ${txLimit} transaksi per bulan. Baris di bulan ini yang melebihi kuota tidak diimpor. Upgrade ke Basic untuk transaksi unlimited.`}
              />
            )}

            {analysis.mapping.type === null &&
              analysis.mapping.amount !== null &&
              analysis.mapping.incomeAmt === null &&
              analysis.mapping.expenseAmt === null &&
              parsed?.rows?.length > 0 && (
                <label style={{ fontSize: 12.5, display: 'block', margin: '0 0 12px' }}>
                  <div style={{ color: 'var(--ink-dim)', marginBottom: 4 }}>
                    Tipe transaksi (karena tidak ada kolom Tipe)
                  </div>
                  <select
                    className="bk-select"
                    style={{ width: '100%', maxWidth: 360 }}
                    value={analysis.defaultType}
                    disabled={busy}
                    onChange={(e) => setAnalysis((a) => ({ ...a, defaultType: e.target.value }))}
                  >
                    <option value="sign">Ikuti tanda nominal (minus = pengeluaran)</option>
                    <option value="expense">Semua pengeluaran</option>
                    <option value="income">Semua pemasukan</option>
                  </select>
                </label>
              )}

            {plan && (<>
            <div style={{ display: 'grid', gap: 8, margin: '10px 0 12px' }}>
              <Check2
                checked={skipDuplicates}
                onChange={setSkipDuplicates}
                disabled={busy}
                label="Lewati transaksi yang sudah ada (tanggal, tipe, nominal, dan deskripsi sama)"
              />
              {unknownCats.length > 0 && (
                <div>
                  <Check2
                    checked={canCreateCats && createCategories}
                    onChange={setCreateCategories}
                    disabled={busy || !canCreateCats}
                    label={`Buat kategori baru dari file: ${unknownCats.slice(0, 4).join(', ')}${
                      unknownCats.length > 4 ? ` +${unknownCats.length - 4} lainnya` : ''
                    }`}
                  />
                  <div style={{ fontSize: 12, color: 'var(--ink-dim)', margin: '3px 0 0 26px' }}>
                    {canCreateCats ? (
                      createCategories
                        ? 'Kategori baru akan ditambahkan ke daftar kategorimu.'
                        : 'Tanpa ini, baris dengan kategori asing masuk ke "Lainnya".'
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Lock size={11} /> Kategori custom khusus paket Basic/Pro. Baris dengan
                        kategori asing masuk ke "Lainnya".
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div
              className="bk-scroll"
              style={{
                overflowX: 'auto',
                border: '1px solid var(--paper-line)',
                borderRadius: 10,
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 560 }}>
                <thead>
                  <tr>
                    <th style={th}>Baris</th>
                    <th style={th}>Tanggal</th>
                    <th style={th}>Deskripsi</th>
                    <th style={th}>Kategori</th>
                    <th style={{ ...th, textAlign: 'right' }}>Nominal</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, PREVIEW_LIMIT).map((r) => {
                    const meta = STATUS_META[r.status]
                    const t = r.final
                    const msgs = [...r.errors, ...r.warnings]
                    return (
                      <tr key={r._i} style={{ opacity: r.status === 'ok' ? 1 : 0.85 }}>
                        <td style={td}>{r.line}</td>
                        <td style={td}>{t?.date || '—'}</td>
                        <td style={td}>{t?.description || '—'}</td>
                        <td style={td}>{t?.category || '—'}</td>
                        <td
                          className="bk-mono"
                          style={{
                            ...td,
                            textAlign: 'right',
                            color: t
                              ? t.type === 'income'
                                ? 'var(--brass)'
                                : 'var(--clay)'
                              : 'var(--ink-dim)',
                          }}
                        >
                          {t ? `${t.type === 'income' ? '+' : '−'}${rupiah(t.amount)}` : '—'}
                        </td>
                        <td style={td}>
                          <span style={{ fontWeight: 600, color: meta.color }}>{meta.label}</span>
                          {msgs.length > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--ink-dim)', lineHeight: 1.35 }}>
                              {msgs.join('; ')}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {previewRows.length > PREVIEW_LIMIT && (
              <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 6 }}>
                Menampilkan {PREVIEW_LIMIT} dari {previewRows.length} baris (baris bermasalah
                ditampilkan lebih dulu).
              </div>
            )}

            </>)}

            {error && <ErrorLine msg={error} />}

            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="button" className="bk-btn bk-btn-ghost" onClick={reset} disabled={busy}>
                Pilih file lain
              </button>
              <div style={{ flex: 1 }} />
              <button type="button" className="bk-btn bk-btn-ghost" onClick={onClose} disabled={busy}>
                Batal
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={handleImport}
                disabled={busy || counts.ok === 0}
                style={{ opacity: busy || counts.ok === 0 ? 0.6 : 1 }}
              >
                <Check size={15} />{' '}
                {busy ? 'Mengimpor…' : `Impor ${counts.ok.toLocaleString('id-ID')} transaksi`}
              </button>
            </div>
          </>
        )}

        {/* ---------- Langkah 3: selesai ---------- */}
        {step === 'done' && result && (
          <>
            {result.failed ? (
              <>
                <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>
                  Impor terhenti di tengah jalan.
                </p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
                  {result.count.toLocaleString('id-ID')} transaksi sudah tersimpan. Sisanya gagal
                  disimpan ({result.message}). Untuk melanjutkan, impor file yang sama lagi:
                  transaksi yang sudah masuk akan dilewati sebagai duplikat.
                </p>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                <b>{result.count.toLocaleString('id-ID')} transaksi</b> berhasil diimpor.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
              <button type="button" className="bk-btn bk-btn-primary" onClick={onClose}>
                Selesai
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const th = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid var(--paper-line)',
  color: 'var(--ink-dim)',
  fontWeight: 600,
  fontSize: 12,
  position: 'sticky',
  top: 0,
  background: 'var(--paper-raised, var(--paper))',
}
const td = {
  padding: '7px 10px',
  borderBottom: '1px solid var(--paper-line)',
  verticalAlign: 'top',
}

function MapSelect({ field, analysis, options, onChange, disabled }) {
  const value = analysis.mapping[field.key]
  const guessed = analysis.sources[field.key] === 'content'
  return (
    <label style={{ fontSize: 12.5 }}>
      <div style={{ color: 'var(--ink-dim)', marginBottom: 4 }}>
        {field.label}
        {field.required && ' (wajib)'}
      </div>
      <select
        className="bk-select"
        style={{ width: '100%' }}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(field.key, e.target.value)}
      >
        <option value="">— tidak ada —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {guessed && value !== null && (
        <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 3 }}>
          ditebak dari isi kolom
        </div>
      )}
    </label>
  )
}

function ErrorLine({ msg }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        gap: 6,
        alignItems: 'flex-start',
        color: 'var(--clay)',
        fontSize: 12.5,
        marginTop: 10,
        lineHeight: 1.45,
      }}
    >
      <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {msg}
    </div>
  )
}

function Notice({ text, tone }) {
  return (
    <div
      style={{
        fontSize: 12.5,
        lineHeight: 1.45,
        padding: '8px 10px',
        borderRadius: 8,
        marginBottom: 8,
        background: tone === 'warn' ? 'var(--clay-soft)' : 'var(--brass-soft)',
        color: 'var(--ink)',
      }}
    >
      {text}
    </div>
  )
}

function Check2({ checked, onChange, label, disabled }) {
  return (
    <label
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        lineHeight: 1.4,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, width: 16, height: 16, accentColor: 'var(--brass)' }}
      />
      <span>{label}</span>
    </label>
  )
}
