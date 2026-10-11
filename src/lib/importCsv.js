/**
 * Import transaksi dari file CSV atau Excel (.xlsx).
 *
 * Alur:
 *   readImportFile(file)            → tabel-tabel mentah (1 tabel per sheet; CSV = 1 tabel)
 *   analyzeTable(table, opsi)       → tebak baris header + kolom mana berisi apa
 *   rowsFromTable(table, analisis)  → baris transaksi bersih + daftar error per baris
 *   buildImportPlan(rows, opsi)     → kategori, duplikat, kuota → siap disimpan
 *
 * Pencocokan kolom bekerja dua lapis:
 *   1. dari NAMA kolom ("Tgl", "Nominal (Rp)", "Keterangan", "Debit", "Kredit"…)
 *   2. kalau nama tidak dikenal/tidak ada header, dari ISI kolom
 *      (kolom yang isinya tanggal, angka, kata pemasukan/pengeluaran, nama kategori, teks panjang)
 * Hasil tebakan bisa diubah pengguna di layar sebelum impor.
 */

import { downloadCsv } from './exportCsv'
import { readXlsx } from './xlsxReader'

export const IMPORT_MAX_ROWS = 2000
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024

export const DEFAULT_METHODS = [
  'Tunai',
  'Transfer Bank',
  'E-Wallet',
  'Kartu Debit',
  'Kartu Kredit',
  'Lainnya',
]

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/** Untuk membandingkan nama kolom: huruf kecil, tanpa tanda baca/aksen. */
const normHeader = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/* ------------------------------------------------------------------ */
/* Kamus nama kolom                                                    */
/* ------------------------------------------------------------------ */

export const FIELD_ORDER = [
  'date',
  'amount',
  'type',
  'category',
  'description',
  'note',
  'method',
  'incomeAmt',
  'expenseAmt',
]

const ALIASES = {
  date: ['tanggal', 'tgl', 'date', 'waktu', 'time', 'tanggal transaksi', 'tgl transaksi', 'tanggal trx'],
  amount: ['jumlah', 'nominal', 'amount', 'nilai', 'harga', 'mutasi', 'rp', 'jumlah transaksi', 'nominal transaksi'],
  type: ['tipe', 'jenis', 'type', 'jenis transaksi', 'tipe transaksi', 'kind', 'db cr', 'd k'],
  category: ['kategori', 'category', 'kat', 'golongan', 'pos'],
  description: [
    'deskripsi', 'keterangan', 'ket', 'description', 'desc', 'uraian', 'nama', 'item',
    'detail', 'transaksi', 'berita', 'remark', 'remarks', 'tujuan', 'penerima', 'merchant', 'toko',
  ],
  note: ['catatan', 'note', 'notes', 'memo', 'catatan tambahan', 'komentar', 'comment'],
  method: [
    'metode', 'metode pembayaran', 'method', 'payment', 'pembayaran', 'sumber dana',
    'akun', 'rekening', 'dompet', 'wallet', 'channel', 'bayar via',
  ],
  incomeAmt: ['pemasukan', 'uang masuk', 'masuk', 'income', 'kredit', 'credit', 'cr', 'penerimaan', 'pendapatan'],
  expenseAmt: ['pengeluaran', 'uang keluar', 'keluar', 'expense', 'debit', 'debet', 'db', 'biaya'],
}

/** Kolom yang sengaja diabaikan saat menebak (saldo, nomor urut, dsb). */
const IGNORE_TOKENS = ['saldo', 'balance', 'no', 'nomor', 'id', 'ref', 'referensi', 'kode', 'status', 'cabang', 'cbg']
/** Kolom hasil rumus/rekap (TOTAL, TOTAL BERSIH, TOTAL PENGELUARAN…) tidak boleh dipakai sebagai data. */
const DERIVED_TOKENS = ['total', 'bersih', 'akumulasi', 'subtotal', 'sisa', 'rekap', 'kumulatif']

const isDerived = (h) => h.split(' ').some((t) => DERIVED_TOKENS.includes(t))
const isIgnored = (h) => isDerived(h) || h.split(' ').some((t) => IGNORE_TOKENS.includes(t))

/** Baris ringkasan di dasar tabel, mis. "TOTAL AKUMULASI". */
const SUMMARY_RE = /\b(total|subtotal|akumulasi|grand total|saldo akhir|saldo awal|rekap)\b/i

function matchScore(headerNorm, aliases) {
  if (!headerNorm) return 0
  const toks = headerNorm.split(' ')
  let best = 0
  for (const a of aliases) {
    if (headerNorm === a) return 100
    const at = a.split(' ')
    // seluruh kata alias ada di nama kolom, mis. "tanggal transaksi" ⊃ "tanggal"
    if (at.every((t) => toks.includes(t))) best = Math.max(best, 50 + at.length)
  }
  return best
}

const INCOME_WORDS = ['income', 'pemasukan', 'masuk', 'pendapatan', 'in', 'kredit', 'credit', 'cr', 'k', '+']
const EXPENSE_WORDS = ['expense', 'pengeluaran', 'keluar', 'biaya', 'out', 'debit', 'debet', 'db', 'd', '-']

const MONTHS = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10,
  nov: 11, november: 11,
  des: 12, desember: 12, dec: 12, december: 12,
}

/* ------------------------------------------------------------------ */
/* CSV tokenizer                                                       */
/* ------------------------------------------------------------------ */

function detectDelimiter(text) {
  let inQ = false
  let end = text.length
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') inQ = !inQ
    else if (!inQ && (c === '\n' || c === '\r')) {
      end = i
      break
    }
  }
  const first = text.slice(0, end)
  const counts = [',', ';', '\t'].map((d) => [d, first.split(d).length - 1])
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][1] > 0 ? counts[0][0] : ','
}

/** Parser CSV sesuai RFC 4180 (kutip ganda, newline di dalam field, CRLF). */
export function parseCsvText(input) {
  let text = String(input ?? '').replace(/^\uFEFF/, '')

  // Baris "sep=;" yang ditambahkan Excel
  let delimiter
  const sepMatch = text.match(/^sep=(.)\r?\n/i)
  if (sepMatch) {
    delimiter = sepMatch[1]
    text = text.slice(sepMatch[0].length)
  } else {
    delimiter = detectDelimiter(text)
  }

  const records = []
  let row = []
  let field = ''
  let inQ = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQ = false
      } else field += c
    } else if (c === '"' && field === '') {
      inQ = true
    } else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      records.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    records.push(row)
  }
  return { delimiter, records }
}

/** CSV → tabel { name, records, lines } tanpa baris kosong. */
export function tableFromCsvText(text) {
  const { delimiter, records } = parseCsvText(text)
  const out = { name: 'CSV', records: [], lines: [], delimiter }
  records.forEach((r, i) => {
    if (r.some((v) => String(v).trim() !== '')) {
      out.records.push(r)
      out.lines.push(i + 1)
    }
  })
  return out
}

/* ------------------------------------------------------------------ */
/* Membaca file (csv / xlsx)                                           */
/* ------------------------------------------------------------------ */

function decodeText(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder('windows-1252').decode(buf) // CSV dari Excel versi lama
  }
}

/**
 * Baca File dari <input type="file"> → { kind, tables }
 * Melempar Error berpesan ramah jika formatnya tidak bisa dibaca.
 */
export async function readImportFile(file) {
  if (file.size > IMPORT_MAX_BYTES) {
    throw new Error(`Ukuran file maksimal ${IMPORT_MAX_BYTES / 1024 / 1024} MB.`)
  }
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'ods', 'numbers', 'xlsb'].includes(ext)) {
    throw new Error(`File .${ext} belum didukung. Gunakan .xlsx atau .csv.`)
  }

  const buf = await file.arrayBuffer()
  const h = new Uint8Array(buf, 0, Math.min(8, buf.byteLength))

  if (h[0] === 0xd0 && h[1] === 0xcf) {
    throw new Error(
      'Format .xls (Excel lama) belum didukung. Buka di Excel lalu Save As → Excel Workbook (.xlsx) atau CSV.'
    )
  }
  if (h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46) {
    throw new Error('File PDF belum didukung. Gunakan .xlsx atau .csv.')
  }

  if (h[0] === 0x50 && h[1] === 0x4b) {
    const sheets = await readXlsx(buf)
    return { kind: 'xlsx', tables: sheets }
  }

  const table = tableFromCsvText(decodeText(buf))
  return { kind: 'csv', tables: [table] }
}

/* ------------------------------------------------------------------ */
/* Normalisasi nilai                                                   */
/* ------------------------------------------------------------------ */

function isRealDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  )
}

const pad = (n) => String(n).padStart(2, '0')

/**
 * Terima: 2026-10-03, 03/10/2026, 3-10-26, 3 Okt 2026, Sabtu, 3 Oktober 2026,
 * Oct 3, 2026, 2026-10-03 14:30. Dengan allowSerial, angka serial Excel (mis. 46298) juga diterima.
 * Return "YYYY-MM-DD" atau null.
 */
export function normalizeDate(raw, { allowSerial = false } = {}) {
  let s = String(raw ?? '').trim()
  if (!s) return null

  s = s.replace(/^(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|ahad|mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+/i, '')

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/)
  if (m) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]]
    return isRealDate(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null
  }

  // Format lokal: default Indonesia = HARI/BULAN/TAHUN
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[ T].*)?$/)
  if (m) {
    let d = +m[1]
    let mo = +m[2]
    let y = +m[3]
    if (y < 100) y += 2000
    if (mo > 12 && d <= 12) [d, mo] = [mo, d] // jelas format BULAN/HARI
    return isRealDate(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null
  }

  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/)
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()]
    const [d, y] = [+m[1], +m[3]]
    return mo && isRealDate(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null
  }

  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/)
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()]
    const [d, y] = [+m[2], +m[3]]
    return mo && isRealDate(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null
  }

  if (allowSerial && /^\d{5}(\.\d+)?$/.test(s)) {
    const n = Math.floor(Number(s))
    if (n >= 25569 && n <= 73050) {
      const dt = new Date(Date.UTC(1899, 11, 30) + n * 86400000)
      return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
    }
  }

  return null
}

/**
 * Terima: 25000 | 25.000 | 25,000 | Rp 1.500.000 | 1,500,000.50 | 12,5 | -50000 | (50000)
 *         | 50.000,00 DB | 50.000,00 CR
 * Return null (kosong), { invalid: true }, atau { value, negative }
 */
export function parseAmount(raw) {
  let s = String(raw ?? '').trim()
  if (!s) return null

  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  // Mutasi rekening: "50.000,00 DB" (keluar) / "50.000,00 CR" (masuk)
  const dbcr = s.match(/\s*\b(DB|CR)\s*$/i)
  if (dbcr) {
    if (dbcr[1].toUpperCase() === 'DB') negative = true
    s = s.slice(0, dbcr.index)
  }
  s = s.replace(/rp\.?/gi, '').replace(/idr/gi, '').replace(/\s/g, '')
  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1)
  } else if (s.startsWith('+')) s = s.slice(1)

  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return { invalid: true }

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let decimalSep = null

  if (lastDot !== -1 && lastComma !== -1) {
    decimalSep = lastDot > lastComma ? '.' : ','
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? '.' : ','
    const count = s.split(sep).length - 1
    const tail = s.length - s.lastIndexOf(sep) - 1
    // "1.500" / "1,500" → ribuan; "12,5" / "12.50" → desimal
    if (count === 1 && tail !== 3) decimalSep = sep
  }

  let cleaned
  if (decimalSep) {
    const thousandSep = decimalSep === '.' ? ',' : '.'
    cleaned = s.split(thousandSep).join('').replace(decimalSep, '.')
  } else {
    cleaned = s.replace(/[.,]/g, '')
  }

  const value = Math.round(parseFloat(cleaned) * 100) / 100
  if (!Number.isFinite(value)) return { invalid: true }
  return { value, negative }
}

function normalizeType(raw) {
  const n = norm(raw)
  if (!n) return null
  if (INCOME_WORDS.includes(n)) return 'income'
  if (EXPENSE_WORDS.includes(n)) return 'expense'
  return undefined // terisi tapi tidak dikenali
}

function normalizeMethod(raw, methods) {
  const n = norm(raw)
  if (!n) return { method: '', unknown: false }
  const exact = methods.find((m) => norm(m) === n)
  if (exact) return { method: exact, unknown: false }

  const pick = (name) => methods.find((m) => norm(m) === norm(name))
  let guess = null
  if (/^(cash|tunai|kas)$/.test(n)) guess = pick('Tunai')
  else if (/(transfer|bank|bca|bri|bni|mandiri|rekening)/.test(n)) guess = pick('Transfer Bank')
  else if (/(e-?wallet|gopay|ovo|dana|shopeepay|linkaja|qris)/.test(n)) guess = pick('E-Wallet')
  else if (/debit/.test(n)) guess = pick('Kartu Debit')
  else if (/(kredit|credit)/.test(n)) guess = pick('Kartu Kredit')

  if (guess) return { method: guess, unknown: false }
  return { method: pick('Lainnya') || '', unknown: true }
}

/* ------------------------------------------------------------------ */
/* Analisis tabel: header + kolom                                      */
/* ------------------------------------------------------------------ */

export function columnLetter(i) {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Kandidat field untuk satu nama kolom. "TOTAL" polos hanya dipakai sebagai cadangan lemah. */
function headerCandidates(h) {
  if (!h) return []
  if (h === 'total') return [{ f: 'amount', s: 10, weak: true }]
  if (isIgnored(h)) return []
  const out = []
  for (const f of FIELD_ORDER) {
    const s = matchScore(h, ALIASES[f])
    if (s) out.push({ f, s })
  }
  return out
}

function detectHeaderRow(records, limit = 30) {
  let best = { idx: -1, fields: 0 }
  const n = Math.min(records.length, limit)
  for (let i = 0; i < n; i++) {
    const fields = new Set()
    records[i].forEach((cell) => {
      const c = headerCandidates(normHeader(cell))
      if (c.length) fields.add(c[0].f)
    })
    if (fields.size > best.fields) best = { idx: i, fields: fields.size }
  }
  return best
}

/** Baris yang hanya berisi teks (bukan angka/tanggal) tepat di bawah header = lanjutan header. */
function isHeaderContinuation(rec) {
  const cells = rec.map((v) => String(v ?? '').trim()).filter(Boolean)
  if (!cells.length) return false
  return cells.every((x) => {
    if (normalizeDate(x) !== null) return false
    const pa = parseAmount(x)
    return !pa || pa.invalid
  })
}

function columnStats(values, knownCats) {
  const v = values.filter(Boolean)
  const n = v.length
  if (!n) return { n: 0 }
  let date = 0
  let num = 0
  let type = 0
  let cat = 0
  let len = 0
  const uniq = new Set()
  v.forEach((x) => {
    uniq.add(x.toLowerCase())
    len += x.length
    if (normalizeDate(x) !== null) date++
    const pa = parseAmount(x)
    if (pa && !pa.invalid) num++
    const t = normalizeType(x)
    if (t === 'income' || t === 'expense') type++
    if (knownCats.has(norm(x))) cat++
  })
  return {
    n,
    dateR: date / n,
    numR: num / n,
    typeR: type / n,
    catR: cat / n,
    avgLen: len / n,
    uniq: uniq.size,
    values: v,
  }
}

const isRunningNumber = (values) => {
  const nums = values.map((x) => Number(String(x).replace(/\D/g, '')))
  if (nums.length < 3 || nums.some((x) => !Number.isFinite(x))) return false
  let seq = 0
  for (let i = 1; i < nums.length; i++) if (nums[i] === nums[i - 1] + 1) seq++
  return seq / (nums.length - 1) >= 0.8
}

const SINGLE_FIELDS = ['date', 'amount', 'type', 'category', 'description', 'note', 'method']

/** Apakah sheet punya kolom tanggal + nominal (satu kolom, atau kolom pemasukan/pengeluaran)? */
export function isUsable(a) {
  const m = a.mapping
  return m.date !== null && (m.amount !== null || m.incomeCols.length > 0 || m.expenseCols.length > 0)
}

/**
 * Tebak header dan pemetaan kolom.
 * @returns { headerIdx, dataStart, headers, headerParts, mapping, sources, defaultType, ncols }
 *   mapping.date/amount/type/category/description/note/method = nomor kolom (0-based) atau null
 *   mapping.incomeCols / expenseCols = DAFTAR kolom (boleh banyak: mis. Ojek Online, Gaji, …)
 *   sources[field] = 'header' | 'content' | 'manual'
 *   defaultType    = 'sign' | 'expense' | 'income' (dipakai bila tidak ada kolom Tipe)
 *
 * Header boleh bertingkat (mis. "PEMASUKAN" di atas "OJEK ONLINE" / "GAJI"): baris-baris
 * header digabung per kolom, dan baris data dimulai setelahnya.
 */
export function analyzeTable(table, { categories, forceHeaderLine } = {}) {
  const { records, lines } = table
  const ncols = records.slice(0, 300).reduce((mx, r) => Math.max(mx, r.length), 0)

  // 1. Baris header (+ baris lanjutan di bawahnya)
  let headerIdx
  if (forceHeaderLine != null) {
    if (forceHeaderLine <= 0) headerIdx = -1
    else {
      const found = lines.findIndex((l) => l >= forceHeaderLine)
      headerIdx = found < 0 ? -1 : found
    }
  } else {
    const best = detectHeaderRow(records)
    if (best.fields >= 2) headerIdx = best.idx
    else headerIdx = records[0]?.some((c) => normalizeDate(c) !== null) ? -1 : 0
  }

  let dataStart = headerIdx + 1
  if (headerIdx >= 0) {
    let extra = 0
    while (extra < 3 && dataStart < records.length && isHeaderContinuation(records[dataStart])) {
      dataStart++
      extra++
    }
  }

  // Nama kolom = gabungan semua baris header (tanpa duplikat), mis. "PEMASUKAN – OJEK ONLINE"
  const headerParts = Array.from({ length: ncols }, (_, c) => {
    if (headerIdx < 0) return []
    const parts = []
    for (let r = headerIdx; r < dataStart; r++) {
      const t = String(records[r][c] ?? '').trim()
      if (t && !parts.some((p) => p.toLowerCase() === t.toLowerCase())) parts.push(t)
    }
    return parts
  })
  const headers = headerParts.map((p, c) => (p.length ? p.join(' – ') : `Kolom ${columnLetter(c)}`))
  const headerNorm = headerParts.map((p) => normHeader(p.join(' ')))

  const mapping = {
    date: null, amount: null, type: null, category: null,
    description: null, note: null, method: null,
    incomeCols: [], expenseCols: [],
  }
  const sources = {}
  const used = new Set()

  // 2. Tebak dari nama kolom
  const cands = []
  headerNorm.forEach((h, c) => {
    headerCandidates(h).forEach(({ f, s, weak }) => {
      if (!weak) cands.push({ f, c, s, fi: FIELD_ORDER.indexOf(f) })
    })
  })
  cands.sort((a, b) => b.s - a.s || a.fi - b.fi || a.c - b.c)
  for (const { f, c } of cands) {
    if (used.has(c)) continue
    if (f === 'incomeAmt') {
      mapping.incomeCols.push(c)
      sources.incomeCols = 'header'
    } else if (f === 'expenseAmt') {
      mapping.expenseCols.push(c)
      sources.expenseCols = 'header'
    } else {
      if (mapping[f] !== null) continue
      mapping[f] = c
      sources[f] = 'header'
    }
    used.add(c)
  }
  mapping.incomeCols.sort((a, b) => a - b)
  mapping.expenseCols.sort((a, b) => a - b)

  const hasSplit = () => mapping.incomeCols.length + mapping.expenseCols.length > 0

  // "TOTAL" polos: dipakai sebagai Jumlah hanya jika tidak ada kolom lain yang jelas
  if (mapping.amount === null && !hasSplit()) {
    const c = headerNorm.findIndex((h, i) => h === 'total' && !used.has(i))
    if (c >= 0) {
      mapping.amount = c
      sources.amount = 'header'
      used.add(c)
    }
  }

  // 3. Isi yang belum terpetakan ditebak dari isi kolom
  const dataRows = records.slice(dataStart, dataStart + 300)
  const knownCats = new Set(
    [...(categories?.income || []), ...(categories?.expense || [])].map(norm)
  )
  const stats = {}
  for (let c = 0; c < ncols; c++) {
    if (used.has(c)) continue
    if (headerNorm[c] && isIgnored(headerNorm[c])) continue
    stats[c] = columnStats(dataRows.map((r) => String(r[c] ?? '').trim()), knownCats)
  }
  const free = () => Object.keys(stats).map(Number).filter((c) => !used.has(c) && stats[c].n > 0)
  const take = (field, c) => {
    mapping[field] = c
    used.add(c)
    sources[field] = 'content'
  }
  const bestBy = (cols, score) =>
    cols.reduce((best, c) => (best === null || score(c) > score(best) ? c : best), null)

  if (mapping.date === null) {
    const c = bestBy(free().filter((c) => stats[c].dateR >= 0.7), (c) => stats[c].dateR)
    if (c !== null) take('date', c)
  }
  if (mapping.type === null && !hasSplit()) {
    const c = bestBy(
      free().filter((c) => stats[c].typeR >= 0.8 && stats[c].uniq <= 6),
      (c) => stats[c].typeR
    )
    if (c !== null) take('type', c)
  }
  if (mapping.amount === null && !hasSplit()) {
    const cols = free().filter(
      (c) => stats[c].numR >= 0.7 && stats[c].dateR < 0.5 && !isRunningNumber(stats[c].values)
    )
    if (cols.length) take('amount', cols[0])
  }
  if (mapping.category === null) {
    const c = bestBy(free().filter((c) => stats[c].catR >= 0.5), (c) => stats[c].catR)
    if (c !== null) take('category', c)
  }
  if (mapping.description === null) {
    const c = bestBy(
      free().filter((c) => stats[c].numR < 0.5 && stats[c].dateR < 0.5 && stats[c].typeR < 0.8),
      (c) => stats[c].avgLen
    )
    if (c !== null) take('description', c)
  }

  // 4. Tanpa kolom Tipe: ikut tanda nominal jika ada yang negatif, kalau tidak anggap pengeluaran
  let defaultType = 'sign'
  if (mapping.type === null && mapping.amount !== null) {
    const anyNeg = records
      .slice(dataStart, dataStart + 2000)
      .some((r) => parseAmount(r[mapping.amount])?.negative)
    defaultType = anyNeg ? 'sign' : 'expense'
  }

  return { headerIdx, dataStart, headers, headerParts, mapping, sources, defaultType, ncols }
}

/** Skor kemiripan sheet dengan tabel transaksi (untuk memilih sheet default). */
function sheetScore(t, a) {
  const m = a.mapping
  const mapped =
    SINGLE_FIELDS.filter((f) => m[f] !== null).length + m.incomeCols.length + m.expenseCols.length
  return (isUsable(a) ? 20 : 0) + mapped + Math.min(t.records.length, 1000) / 10000
}

/** Pilih sheet yang paling mirip tabel transaksi. */
export function chooseTable(tables, opts = {}) {
  let bestIdx = 0
  let bestScore = -1
  tables.forEach((t, i) => {
    const sc = sheetScore(t, analyzeTable(t, opts))
    if (sc > bestScore) {
      bestScore = sc
      bestIdx = i
    }
  })
  return bestIdx
}

/**
 * Analisis semua sheet sekaligus.
 * @returns { analyses, selected }  selected = indeks sheet yang otomatis dicentang
 * (semua sheet yang punya kolom tanggal + nominal; kalau tak ada, sheet terbaik saja).
 */
export function analyzeAll(tables, opts = {}) {
  const analyses = tables.map((t) => analyzeTable(t, opts))
  let selected = analyses.map((a, i) => (isUsable(a) ? i : -1)).filter((i) => i >= 0)
  if (!selected.length) selected = [chooseTable(tables, opts)]
  return { analyses, selected }
}

/* ------------------------------------------------------------------ */
/* Tabel + pemetaan → baris transaksi                                  */
/* ------------------------------------------------------------------ */

const GENERIC_LABEL_WORDS = new Set([
  'pemasukan', 'pengeluaran', 'income', 'expense', 'masuk', 'keluar', 'kredit', 'debit', 'credit',
  'uang', 'penerimaan', 'pendapatan', 'biaya', 'rp', 'nominal', 'jumlah', 'cr', 'db', 'debet', 'dana',
])

/** Nama kolom spesifik (mis. "OJEK ONLINE") → dipakai sebagai kategori/deskripsi; yang generik ("PENGELUARAN") tidak. */
function specificLabel(leaf) {
  const n = normHeader(leaf)
  if (!n) return ''
  if (n.split(' ').every((w) => GENERIC_LABEL_WORDS.has(w))) return ''
  const t = String(leaf).trim()
  // "OJEK ONLINE" → "Ojek Online" (hanya kalau semuanya huruf besar)
  if (t !== t.toUpperCase()) return t
  const small = new Set(['dan', 'di', 'ke', 'dari', 'untuk', 'atau', 'yang', 'dengan'])
  return t
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

/**
 * @param analysis  { headerIdx, dataStart, mapping, defaultType, headerParts } dari analyzeTable
 *                  (boleh sudah diubah pengguna)
 * @returns { error } | { missing: ['Tanggal', ...], rows: [] } | { rows, notices, missing: [] }
 * rows[i] = { line, tx: {...}|null, errors: [], warnings: [], skip?: 'alasan' }
 * Satu baris Excel bisa menghasilkan beberapa transaksi (satu per kolom pemasukan/pengeluaran yang terisi).
 */
export function rowsFromTable(table, analysis, { methods = DEFAULT_METHODS } = {}) {
  const { headerIdx, mapping } = analysis
  const dataStart = analysis.dataStart ?? headerIdx + 1
  const defaultType = analysis.defaultType || 'sign'
  const incomeCols = mapping.incomeCols || []
  const expenseCols = mapping.expenseCols || []
  const { records, lines } = table

  const hasSplit = incomeCols.length + expenseCols.length > 0
  const useSplit = mapping.amount == null && hasSplit

  const missing = []
  if (mapping.date == null) missing.push('Tanggal')
  if (mapping.amount == null && !hasSplit) missing.push('Jumlah')
  if (missing.length) return { missing, rows: [], notices: [] }

  const notices = []
  if (mapping.type == null && !useSplit) {
    if (defaultType === 'sign') {
      notices.push(
        'Tidak ada kolom Tipe: tipe ditentukan dari tanda nominal (negatif = pengeluaran, positif = pemasukan).'
      )
    } else {
      notices.push(
        `Tidak ada kolom Tipe dan semua nominal positif: semua baris dianggap ${
          defaultType === 'income' ? 'pemasukan' : 'pengeluaran'
        }. Ubah di pilihan "Tipe transaksi" jika kurang tepat.`
      )
    }
  }
  if (useSplit && incomeCols.length + expenseCols.length > 2) {
    notices.push(
      `Pemasukan dan pengeluaran dibaca dari ${incomeCols.length} kolom pemasukan dan ${expenseCols.length} kolom pengeluaran. Satu baris bisa menjadi beberapa transaksi.`
    )
  }

  const get = (rec, key) =>
    mapping[key] == null ? '' : String(rec[mapping[key]] ?? '').trim()
  const leafOf = (c) => analysis.headerParts?.[c]?.slice(-1)[0] || ''
  const colName = (c) => analysis.headers?.[c] || `kolom ${columnLetter(c)}`

  const rows = []
  let count = 0
  const push = (r) => {
    rows.push(r)
    if (!r.skip) count++
  }

  for (let i = dataStart; i < records.length; i++) {
    const rec = records[i]
    if (!rec.some((v) => String(v).trim() !== '')) continue
    const line = lines[i]

    const dateRaw = get(rec, 'date')
    const date = normalizeDate(dateRaw, { allowSerial: true })
    const desc = get(rec, 'description')
    const dateError = dateRaw ? `Tanggal "${dateRaw}" tidak valid` : 'Tanggal kosong'

    // Baris ringkasan di dasar tabel ("TOTAL AKUMULASI", dsb) tidak diimpor
    if (!date && SUMMARY_RE.test(rec.join(' '))) {
      push({ line, skip: 'Baris total', errors: [], warnings: [], tx: null })
      continue
    }

    const warnings = []
    const { method, unknown: methodUnknown } = normalizeMethod(get(rec, 'method'), methods)
    let note = get(rec, 'note')
    if (methodUnknown) {
      warnings.push(`Metode "${get(rec, 'method')}" tidak dikenali → Lainnya`)
      note = note ? `${note} (metode: ${get(rec, 'method')})` : `Metode: ${get(rec, 'method')}`
    }

    /* ---------- Kolom pemasukan/pengeluaran terpisah (boleh banyak) ---------- */
    if (useSplit) {
      const found = []
      let invalid = null
      const scan = (cols, type) =>
        cols.forEach((c) => {
          const raw = String(rec[c] ?? '').trim()
          const a = parseAmount(raw)
          if (!a) return
          if (a.invalid) invalid = invalid || `Nominal "${raw}" di ${colName(c)} tidak valid`
          else if (a.value > 0) found.push({ type, amount: a.value, c })
        })
      scan(incomeCols, 'income')
      scan(expenseCols, 'expense')

      if (invalid) {
        push({ line, errors: [invalid], warnings, tx: null })
        continue
      }
      if (!found.length) {
        // hari tanpa transaksi (nominal kosong / 0 / "Rp -")
        push({ line, skip: date ? 'Tanpa nominal' : 'Baris kosong', errors: [], warnings: [], tx: null })
        continue
      }
      if (!date) {
        push({ line, errors: [dateError], warnings, tx: null })
        continue
      }

      const hasExpense = found.some((f) => f.type === 'expense')
      for (const f of found) {
        const label = specificLabel(leafOf(f.c))
        let description
        let rowNote = note
        if (f.type === 'expense') {
          description = desc || label || 'Pengeluaran'
        } else {
          description = label || desc || 'Pemasukan'
          if (label && desc && !hasExpense) rowNote = rowNote ? `${rowNote}; ${desc}` : desc
        }
        push({
          line,
          errors: [],
          warnings: [...warnings],
          tx: {
            date,
            type: f.type,
            categoryRaw: get(rec, 'category') || label,
            amount: f.amount,
            description,
            note: rowNote,
            method,
          },
        })
      }
      continue
    }

    /* ---------- Satu kolom Jumlah ---------- */
    const errors = []
    if (!date) errors.push(dateError)

    let amount = null
    let type = null
    let negative = false
    const a = parseAmount(get(rec, 'amount'))
    const zeroOrBlank = !a || (!a.invalid && !(a.value > 0))
    if (zeroOrBlank && (!dateRaw || !desc)) {
      // baris kerangka tanpa nominal (mis. satu baris per hari) → lewati diam-diam
      push({ line, skip: 'Tanpa nominal', errors: [], warnings: [], tx: null })
      continue
    }
    if (!a) errors.push('Jumlah kosong')
    else if (a.invalid) errors.push(`Jumlah "${get(rec, 'amount')}" tidak valid`)
    else if (!(a.value > 0)) errors.push('Jumlah harus lebih dari 0')
    else {
      amount = a.value
      negative = a.negative
    }

    const fallbackType = () =>
      defaultType === 'sign' ? (negative ? 'expense' : 'income') : defaultType

    if (mapping.type != null && get(rec, 'type')) {
      const t = normalizeType(get(rec, 'type'))
      if (t === undefined) {
        errors.push(
          `Tipe "${get(rec, 'type')}" tidak dikenali (gunakan income/expense atau pemasukan/pengeluaran)`
        )
      } else type = t
    } else if (amount !== null) {
      type = fallbackType()
      if (mapping.type != null) {
        warnings.push(`Tipe kosong, dianggap ${type === 'income' ? 'pemasukan' : 'pengeluaran'}`)
      }
    }

    push({
      line,
      errors,
      warnings,
      tx:
        errors.length || !date || !type || amount === null
          ? null
          : {
              date,
              type,
              categoryRaw: get(rec, 'category'),
              amount,
              description: desc,
              note,
              method,
            },
    })

    if (count > IMPORT_MAX_ROWS) break
  }

  if (count > IMPORT_MAX_ROWS) {
    return {
      error: `Maksimal ${IMPORT_MAX_ROWS.toLocaleString('id-ID')} baris per impor. Pecah file menjadi beberapa bagian.`,
    }
  }
  if (!rows.length) return { error: 'Tidak ada baris data di bawah baris header.' }
  return { rows, notices, missing: [] }
}

/**
 * Jalan pintas untuk teks CSV: baca → tebak kolom → baris transaksi.
 * Return { error } atau { rows, notices, delimiter }.
 */
export function parseTransactionsCsv(text, { methods = DEFAULT_METHODS, categories } = {}) {
  const table = tableFromCsvText(text)
  if (table.records.length < 2) {
    return { error: 'File kosong atau hanya berisi baris header.' }
  }
  const analysis = analyzeTable(table, { categories })
  const res = rowsFromTable(table, analysis, { methods })
  if (res.error) return { error: res.error }
  if (res.missing.length) {
    return {
      error:
        `Kolom wajib tidak ditemukan: ${res.missing.join(', ')}. ` +
        'Pastikan ada kolom tanggal dan jumlah, misalnya: Tanggal, Tipe, Kategori, Jumlah, Deskripsi.',
    }
  }
  return { rows: res.rows, notices: res.notices, delimiter: table.delimiter }
}

/* ------------------------------------------------------------------ */
/* Tebak kategori dari kata kunci di deskripsi                         */
/* ------------------------------------------------------------------ */

const CATEGORY_KEYWORDS = {
  expense: {
    Transportasi: ['bensin', 'pertamax', 'pertalite', 'bbm', 'spbu', 'parkir', 'tol', 'etoll', 'e-toll', 'ojek', 'gojek', 'grab', 'servis', 'service', 'oli', 'ban', 'tambal', 'kereta', 'angkot', 'taksi', 'travel', 'stnk', 'bengkel'],
    'Makanan & Minuman': ['makan', 'minum', 'jajan', 'jus', 'kopi', 'sembako', 'buah', 'nasi', 'warteg', 'resto', 'kafe', 'cafe', 'snack', 'roti', 'pisang', 'ayam', 'bakso', 'mie', 'sate', 'galon', 'beras', 'telur', 'sayur', 'lauk', 'gofood', 'grabfood', 'rujak', 'susu', 'dancow', 'telo', 'gorengan', 'sodaqo'],
    Tagihan: ['listrik', 'pln', 'token', 'pdam', 'wifi', 'internet', 'indihome', 'paket data', 'pulsa', 'kuota', 'langganan', 'netflix', 'spotify', 'tagihan'],
    Belanja: ['shope', 'tokopedia', 'lazada', 'tiktok', 'blibli', 'belanja', 'baju', 'sepatu', 'alfamart', 'indomaret', 'bunga', 'toko'],
    Hiburan: ['pantai', 'nonton', 'bioskop', 'game', 'wisata', 'liburan', 'konser', 'rekreasi', 'karaoke', 'jalan-jalan'],
    Kesehatan: ['klinik', 'dokter', 'obat', 'apotek', 'rumah sakit', 'bpjs', 'gigi', 'vitamin', 'medis', 'periksa'],
    Pendidikan: ['sekolah', 'spp', 'kuliah', 'buku', 'kursus', 'les', 'ukt', 'pelatihan'],
    Cicilan: ['cicilan', 'angsuran', 'kpr', 'leasing', 'pinjol', 'paylater', 'kartu kredit'],
    Investasi: ['emas', 'saham', 'reksadana', 'reksa dana', 'crypto', 'kripto', 'deposito', 'obligasi', 'sbn', 'antam'],
  },
  income: {
    Gaji: ['gaji', 'salary', 'upah'],
    Bonus: ['bonus', 'thr', 'lembur'],
    Freelance: ['freelance', 'proyek', 'project'],
    Penjualan: ['jual', 'penjualan'],
    Investasi: ['dividen', 'bunga deposito', 'kupon'],
  },
}

/** Kategori (yang sudah ada di akun) paling cocok dengan deskripsi, atau null. */
export function guessCategory(description, type, existingMap) {
  const text = ` ${String(description || '').toLowerCase()}`
  if (!text.trim()) return null
  let best = null
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS[type] || {})) {
    if (!existingMap.has(norm(cat))) continue
    let hits = 0
    let first = Infinity
    for (const w of words) {
      const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const m = new RegExp(`(?:^|[^a-z0-9])${esc}`).exec(text)
      if (m) {
        hits++
        first = Math.min(first, m.index)
      }
    }
    if (hits && (!best || hits > best.hits || (hits === best.hits && first < best.first))) {
      best = { cat: existingMap.get(norm(cat)), hits, first }
    }
  }
  return best ? best.cat : null
}

/* ------------------------------------------------------------------ */
/* Rencana impor: kategori, duplikat, kuota                            */
/* ------------------------------------------------------------------ */

const txKey = (t) =>
  `${t.date}|${t.type}|${Number(t.amount)}|${String(t.description || '')
    .trim()
    .toLowerCase()}`

/**
 * @param rows        hasil rowsFromTable().rows
 * @param existing    transaksi yang sudah ada (untuk deteksi duplikat & kuota)
 * @param categories  { income: [], expense: [] }
 * @param createCategories  true → kategori tak dikenal dibuat baru; false → jadi "Lainnya"
 * @param skipDuplicates    true → baris yang sudah ada dilewati
 * @param txLimitPerMonth   null/undefined = unlimited
 */
export function buildImportPlan(
  rows,
  {
    existing = [],
    categories = { income: [], expense: [] },
    createCategories = false,
    skipDuplicates = true,
    txLimitPerMonth = null,
  } = {}
) {
  // Hitung kemunculan tiap transaksi yang sudah ada. Baris file yang cocok
  // "memakai" satu slot, jadi dua kopi di hari yang sama tetap lolos jika
  // di database hanya ada satu.
  const existingCount = new Map()
  existing.forEach((t) => {
    const k = txKey(t)
    existingCount.set(k, (existingCount.get(k) || 0) + 1)
  })

  const monthKey = new Date().toISOString().slice(0, 7)
  let quotaLeft =
    txLimitPerMonth == null
      ? Infinity
      : Math.max(
          0,
          txLimitPerMonth -
            existing.filter((t) => String(t.date || '').startsWith(monthKey))
              .length
        )

  const newCategories = { income: [], expense: [] }
  const lowerSets = {
    income: new Set((categories.income || []).map(norm)),
    expense: new Set((categories.expense || []).map(norm)),
  }
  const canonical = {
    income: new Map((categories.income || []).map((c) => [norm(c), c])),
    expense: new Map((categories.expense || []).map((c) => [norm(c), c])),
  }

  const fallbackFor = (type) => {
    const list = categories[type] || []
    return list.find((c) => norm(c) === 'lainnya') || list[list.length - 1] || 'Lainnya'
  }

  const counts = { ok: 0, dup: 0, error: 0, quota: 0, skip: 0, newCats: 0, guessed: 0 }
  const toInsert = []
  const unknownCats = new Map() // kategori di file yang belum ada di akun

  const items = rows.map((r) => {
    const item = { ...r, status: 'error', final: null, warnings: [...r.warnings] }
    if (r.skip) {
      counts.skip++
      item.status = 'skip'
      return item
    }
    if (!r.tx) {
      counts.error++
      return item
    }

    const t = { ...r.tx }
    const type = t.type

    // Kategori
    const catNorm = norm(t.categoryRaw)
    if (!catNorm) {
      const g = guessCategory(t.description, type, canonical[type])
      if (g) {
        t.category = g
        item.guessed = true
        counts.guessed++
      } else t.category = fallbackFor(type)
    } else if (canonical[type].has(catNorm)) {
      t.category = canonical[type].get(catNorm)
    } else if (createCategories) {
      t.category = String(t.categoryRaw).trim()
      unknownCats.set(`${type}|${catNorm}`, t.category)
      if (!lowerSets[type].has(catNorm)) {
        lowerSets[type].add(catNorm)
        canonical[type].set(catNorm, t.category)
        newCategories[type].push(t.category)
        counts.newCats++
      }
    } else {
      t.category = fallbackFor(type)
      unknownCats.set(`${type}|${catNorm}`, String(t.categoryRaw).trim())
      item.warnings.push(`Kategori "${t.categoryRaw}" tidak ada → ${t.category}`)
    }

    if (!t.description) t.description = t.category
    delete t.categoryRaw

    // Duplikat
    const k = txKey(t)
    if ((existingCount.get(k) || 0) > 0) {
      existingCount.set(k, existingCount.get(k) - 1)
      if (skipDuplicates) {
        item.status = 'dup'
        item.final = t
        counts.dup++
        return item
      }
      item.warnings.push('Mirip transaksi yang sudah ada')
    }

    // Kuota paket gratis (dihitung per bulan berjalan)
    if (t.date.startsWith(monthKey)) {
      if (quotaLeft <= 0) {
        item.status = 'quota'
        item.final = t
        counts.quota++
        return item
      }
      quotaLeft--
    }

    item.status = 'ok'
    item.final = t
    counts.ok++
    toInsert.push(t)
    return item
  })

  return {
    items,
    toInsert,
    newCategories,
    counts,
    unknownCategories: [...new Set(unknownCats.values())],
  }
}

/* ------------------------------------------------------------------ */
/* Template                                                            */
/* ------------------------------------------------------------------ */

export function downloadImportTemplate() {
  const today = new Date().toISOString().slice(0, 10)
  const lines = [
    'Tanggal,Tipe,Kategori,Jumlah,Deskripsi,Catatan,Metode',
    `${today},income,Gaji,5000000,Gaji bulanan,,Transfer Bank`,
    `${today},expense,Makanan & Minuman,25000,Makan siang,,Tunai`,
    `${today},expense,Transportasi,50000,Bensin,,E-Wallet`,
  ]
  downloadCsv('template-import-transaksi.csv', '\uFEFF' + lines.join('\n'))
}
