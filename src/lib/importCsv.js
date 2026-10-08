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
  amount: ['jumlah', 'nominal', 'amount', 'nilai', 'total', 'harga', 'mutasi', 'rp', 'jumlah transaksi', 'nominal transaksi'],
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

/** Kolom yang sengaja diabaikan saat menebak dari isi (saldo, nomor urut, dsb). */
const IGNORE_TOKENS = ['saldo', 'balance', 'no', 'nomor', 'id', 'ref', 'referensi', 'kode', 'status', 'cabang', 'cbg']

const isIgnored = (h) => h.split(' ').some((t) => IGNORE_TOKENS.includes(t))

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

function detectHeaderRow(records, limit = 30) {
  let best = { idx: -1, fields: 0 }
  const n = Math.min(records.length, limit)
  for (let i = 0; i < n; i++) {
    const fields = new Set()
    records[i].forEach((cell) => {
      const h = normHeader(cell)
      if (!h || isIgnored(h)) return
      for (const f of FIELD_ORDER) {
        if (matchScore(h, ALIASES[f]) > 0) {
          fields.add(f)
          break
        }
      }
    })
    if (fields.size > best.fields) best = { idx: i, fields: fields.size }
  }
  return best
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

/**
 * Tebak header dan pemetaan kolom.
 * @returns { headerIdx, headers, mapping, sources, defaultType, ncols }
 *   mapping[field] = nomor kolom (0-based) atau null
 *   sources[field] = 'header' | 'content'
 *   defaultType    = 'sign' | 'expense' | 'income' (dipakai bila tidak ada kolom Tipe)
 */
export function analyzeTable(table, { categories, forceHeaderLine } = {}) {
  const { records, lines } = table
  const ncols = records.slice(0, 300).reduce((mx, r) => Math.max(mx, r.length), 0)

  // 1. Baris header
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

  const headerNorm = headerIdx >= 0 ? records[headerIdx].map(normHeader) : []
  const headers = Array.from({ length: ncols }, (_, c) => {
    const t = headerIdx >= 0 ? String(records[headerIdx][c] ?? '').trim() : ''
    return t || `Kolom ${columnLetter(c)}`
  })

  const mapping = Object.fromEntries(FIELD_ORDER.map((f) => [f, null]))
  const sources = {}
  const used = new Set()

  // 2. Tebak dari nama kolom
  const cands = []
  headerNorm.forEach((h, c) => {
    if (!h || isIgnored(h)) return
    FIELD_ORDER.forEach((f, fi) => {
      const s = matchScore(h, ALIASES[f])
      if (s) cands.push({ f, c, s, fi })
    })
  })
  cands.sort((a, b) => b.s - a.s || a.fi - b.fi || a.c - b.c)
  for (const { f, c } of cands) {
    if (mapping[f] !== null || used.has(c)) continue
    mapping[f] = c
    used.add(c)
    sources[f] = 'header'
  }

  // 3. Isi yang belum terpetakan ditebak dari isi kolom
  const dataRows = records.slice(headerIdx + 1, headerIdx + 1 + 300)
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
  if (mapping.type === null && mapping.incomeAmt === null && mapping.expenseAmt === null) {
    const c = bestBy(
      free().filter((c) => stats[c].typeR >= 0.8 && stats[c].uniq <= 6),
      (c) => stats[c].typeR
    )
    if (c !== null) take('type', c)
  }
  if (mapping.amount === null && mapping.incomeAmt === null && mapping.expenseAmt === null) {
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
      .slice(headerIdx + 1, headerIdx + 1 + 2000)
      .some((r) => parseAmount(r[mapping.amount])?.negative)
    defaultType = anyNeg ? 'sign' : 'expense'
  }

  return { headerIdx, headers, mapping, sources, defaultType, ncols }
}

/** Pilih sheet yang paling mirip tabel transaksi. */
export function chooseTable(tables, opts = {}) {
  let bestIdx = 0
  let bestScore = -1
  tables.forEach((t, i) => {
    const a = analyzeTable(t, opts)
    const hasAmt = a.mapping.amount !== null || a.mapping.incomeAmt !== null || a.mapping.expenseAmt !== null
    const mapped = FIELD_ORDER.filter((f) => a.mapping[f] !== null).length
    const score =
      (a.mapping.date !== null ? 10 : 0) +
      (hasAmt ? 10 : 0) +
      mapped +
      Math.min(t.records.length, 1000) / 10000
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  })
  return bestIdx
}

/* ------------------------------------------------------------------ */
/* Tabel + pemetaan → baris transaksi                                  */
/* ------------------------------------------------------------------ */

/**
 * @param analysis  { headerIdx, mapping, defaultType } dari analyzeTable (boleh sudah diubah pengguna)
 * @returns { error } | { missing: ['Tanggal', ...], rows: [] } | { rows, notices, missing: [] }
 * rows[i] = { line, tx: {...}|null, errors: [], warnings: [] }
 */
export function rowsFromTable(table, analysis, { methods = DEFAULT_METHODS } = {}) {
  const { headerIdx, mapping } = analysis
  const defaultType = analysis.defaultType || 'sign'
  const { records, lines } = table

  const hasSplit = mapping.incomeAmt != null || mapping.expenseAmt != null
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

  const get = (rec, key) =>
    mapping[key] == null ? '' : String(rec[mapping[key]] ?? '').trim()

  const rows = []
  for (let i = headerIdx + 1; i < records.length; i++) {
    const rec = records[i]
    if (!rec.some((v) => String(v).trim() !== '')) continue

    const errors = []
    const warnings = []

    const date = normalizeDate(get(rec, 'date'), { allowSerial: true })
    if (!date) {
      errors.push(
        get(rec, 'date') ? `Tanggal "${get(rec, 'date')}" tidak valid` : 'Tanggal kosong'
      )
    }

    let amount = null
    let type = null
    let negative = false

    if (useSplit) {
      const inc = mapping.incomeAmt != null ? parseAmount(get(rec, 'incomeAmt')) : null
      const exp = mapping.expenseAmt != null ? parseAmount(get(rec, 'expenseAmt')) : null
      if (inc?.invalid || exp?.invalid) errors.push('Nominal tidak valid')
      else {
        const incV = inc?.value > 0 ? inc.value : 0
        const expV = exp?.value > 0 ? exp.value : 0
        if (incV && expV) errors.push('Pemasukan dan pengeluaran terisi bersamaan')
        else if (incV) [amount, type] = [incV, 'income']
        else if (expV) [amount, type] = [expV, 'expense']
        else errors.push('Nominal kosong atau 0')
      }
    } else {
      const a = parseAmount(get(rec, 'amount'))
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
          warnings.push(
            `Tipe kosong, dianggap ${type === 'income' ? 'pemasukan' : 'pengeluaran'}`
          )
        }
      }
    }

    const categoryRaw = get(rec, 'category')
    const { method, unknown: methodUnknown } = normalizeMethod(get(rec, 'method'), methods)
    let note = get(rec, 'note')
    if (methodUnknown) {
      warnings.push(`Metode "${get(rec, 'method')}" tidak dikenali → Lainnya`)
      note = note ? `${note} (metode: ${get(rec, 'method')})` : `Metode: ${get(rec, 'method')}`
    }

    rows.push({
      line: lines[i],
      errors,
      warnings,
      tx:
        errors.length || !date || !type || amount === null
          ? null
          : {
              date,
              type,
              categoryRaw,
              amount,
              description: get(rec, 'description'),
              note,
              method,
            },
    })

    if (rows.length > IMPORT_MAX_ROWS) {
      return {
        error: `Maksimal ${IMPORT_MAX_ROWS.toLocaleString('id-ID')} baris per impor. Pecah file menjadi beberapa bagian.`,
      }
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

  const counts = { ok: 0, dup: 0, error: 0, quota: 0, newCats: 0 }
  const toInsert = []
  const unknownCats = new Map() // kategori di file yang belum ada di akun

  const items = rows.map((r) => {
    const item = { ...r, status: 'error', final: null, warnings: [...r.warnings] }
    if (!r.tx) {
      counts.error++
      return item
    }

    const t = { ...r.tx }
    const type = t.type

    // Kategori
    const catNorm = norm(t.categoryRaw)
    if (!catNorm) {
      t.category = fallbackFor(type)
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
