/**
 * Preferensi pengguna (tampilan + transaksi).
 *
 * Disimpan di localStorage per akun (kunci `lanila-prefs:<userId>`), sama seperti tema
 * yang sudah ada, jadi berlaku per perangkat. Modul ini singleton: setelah
 * setActiveUser(userId) dipanggil, fungsi format di bawah langsung memakai preferensi
 * akun itu, dan komponen yang memanggil usePrefs() otomatis render ulang saat berubah.
 */

import { useSyncExternalStore } from 'react'

export const DEFAULT_PREFS = {
  dateFormat: 'short', //   short: 03 Okt 2026 | long: 3 Oktober 2026 | numeric: 03/10/2026 | iso: 2026-10-03
  numberFormat: 'id', //    id: 1.500.000 | en: 1,500,000 | space: 1 500 000
  showSymbol: true, //      tampilkan "Rp"
  startPage: 'dashboard', // dashboard | transactions | summary
  defaultMethod: '', //     metode pembayaran bawaan transaksi baru ('' = kosong)
  monthStartDay: 1, //      tanggal mulai "bulan" (mis. 25 untuk tanggal gajian), 1–28
}

export const DATE_FORMATS = [
  { value: 'short', label: 'Singkat' },
  { value: 'long', label: 'Lengkap' },
  { value: 'numeric', label: 'Angka (hari/bulan/tahun)' },
  { value: 'iso', label: 'ISO (tahun-bulan-hari)' },
]
export const NUMBER_FORMATS = [
  { value: 'id', label: 'Titik (1.500.000)' },
  { value: 'en', label: 'Koma (1,500,000)' },
  { value: 'space', label: 'Spasi (1 500 000)' },
]
export const START_PAGES = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'transactions', label: 'Transaksi' },
  { value: 'summary', label: 'Ringkasan' },
]

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const MONTHS_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/* ------------------------------------------------------------------ */
/* State + penyimpanan                                                 */
/* ------------------------------------------------------------------ */

const storageKey = (userId) => `lanila-prefs:${userId}`

let activeUserId = null
let current = { ...DEFAULT_PREFS }
const listeners = new Set()

function sanitize(raw) {
  const p = { ...DEFAULT_PREFS }
  if (!raw || typeof raw !== 'object') return p
  if (DATE_FORMATS.some((o) => o.value === raw.dateFormat)) p.dateFormat = raw.dateFormat
  if (NUMBER_FORMATS.some((o) => o.value === raw.numberFormat)) p.numberFormat = raw.numberFormat
  if (typeof raw.showSymbol === 'boolean') p.showSymbol = raw.showSymbol
  if (START_PAGES.some((o) => o.value === raw.startPage)) p.startPage = raw.startPage
  if (typeof raw.defaultMethod === 'string') p.defaultMethod = raw.defaultMethod.slice(0, 40)
  const d = Math.round(Number(raw.monthStartDay))
  if (Number.isFinite(d) && d >= 1 && d <= 28) p.monthStartDay = d
  return p
}

function emit() {
  listeners.forEach((fn) => fn())
}

/** Muat preferensi milik akun ini. Aman dipanggil berulang (tidak melakukan apa-apa jika akun sama). */
export function setActiveUser(userId) {
  if (userId === activeUserId) return
  activeUserId = userId || null
  let raw = null
  if (activeUserId) {
    try {
      raw = JSON.parse(localStorage.getItem(storageKey(activeUserId)) || 'null')
    } catch (_) {}
  }
  current = sanitize(raw)
  // Ditunda: fungsi ini dipanggil saat render App, dan React melarang memperbarui komponen lain di waktu itu
  queueMicrotask(emit)
}

export function getPrefs() {
  return current
}

export function getActiveUserId() {
  return activeUserId
}

/** Ubah sebagian preferensi, simpan, dan beri tahu komponen yang berlangganan. */
export function updatePrefs(patch) {
  current = sanitize({ ...current, ...patch })
  if (activeUserId) {
    try {
      localStorage.setItem(storageKey(activeUserId), JSON.stringify(current))
    } catch (_) {}
  }
  emit()
  return current
}

export function resetPrefs() {
  return updatePrefs({ ...DEFAULT_PREFS })
}

export function usePrefs() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => current,
    () => current
  )
}

/* ------------------------------------------------------------------ */
/* Format angka & uang                                                 */
/* ------------------------------------------------------------------ */

const SEPARATORS = { id: '.', en: ',', space: '\u00a0' }

/** 1500000 → "1.500.000" sesuai preferensi (pembulatan ke bilangan bulat). */
export function formatNumber(n, prefs = current) {
  const v = Math.round(Math.abs(Number(n) || 0))
  const sep = SEPARATORS[prefs.numberFormat] ?? '.'
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, sep)
}

/** 1500000 → "Rp 1.500.000" · -50000 → "-Rp 50.000" */
export function formatMoney(n, prefs = current) {
  const num = Number(n) || 0
  const neg = Math.round(num) < 0
  return `${neg ? '-' : ''}${prefs.showSymbol ? 'Rp ' : ''}${formatNumber(num, prefs)}`
}

/* ------------------------------------------------------------------ */
/* Format tanggal (input: "YYYY-MM-DD")                                */
/* ------------------------------------------------------------------ */

function parseIso(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null
}

export function formatDate(iso, prefs = current) {
  const p = parseIso(iso)
  if (!p) return String(iso || '')
  const dd = String(p.d).padStart(2, '0')
  const mm = String(p.m).padStart(2, '0')
  switch (prefs.dateFormat) {
    case 'long':
      return `${p.d} ${MONTHS_LONG[p.m - 1]} ${p.y}`
    case 'numeric':
      return `${dd}/${mm}/${p.y}`
    case 'iso':
      return `${p.y}-${mm}-${dd}`
    default:
      return `${dd} ${MONTHS_SHORT[p.m - 1]} ${p.y}`
  }
}

/** "2026-10-03" → "03 Okt" (label grafik; tidak ikut preferensi karena ruangnya sempit). */
export function formatDayMonth(iso) {
  const p = parseIso(iso)
  return p ? `${String(p.d).padStart(2, '0')} ${MONTHS_SHORT[p.m - 1]}` : String(iso || '')
}

/* ------------------------------------------------------------------ */
/* "Bulan" dengan tanggal mulai sendiri (mis. gajian tanggal 25)       */
/* ------------------------------------------------------------------ */

const localIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Rentang "bulan ini" berdasarkan tanggal mulai. startDay = 1 → bulan kalender biasa.
 * Contoh startDay = 25, hari ini 10 Okt → { from: '2026-09-25', to: '2026-10-24' }.
 * Memakai tanggal lokal perangkat.
 */
export function monthRange(startDay = current.monthStartDay, ref = new Date()) {
  const sd = Math.min(28, Math.max(1, Math.round(Number(startDay)) || 1))
  const startMonth = ref.getDate() >= sd ? ref.getMonth() : ref.getMonth() - 1
  const from = new Date(ref.getFullYear(), startMonth, sd)
  const to = new Date(ref.getFullYear(), startMonth + 1, sd - 1) // sd=1 → hari terakhir bulan itu
  return { from: localIso(from), to: localIso(to) }
}

/** Apakah tanggal ISO ini termasuk "bulan ini" menurut tanggal mulai pilihan pengguna? */
export function inCurrentPeriod(iso, startDay = current.monthStartDay, ref = new Date()) {
  const d = String(iso || '').slice(0, 10)
  if (!d) return false
  const { from, to } = monthRange(startDay, ref)
  return d >= from && d <= to
}

/** "25 Sep – 24 Okt" (kosong jika memakai bulan kalender biasa). */
export function periodLabel(startDay = current.monthStartDay, ref = new Date()) {
  if (Math.round(Number(startDay)) <= 1) return ''
  const { from, to } = monthRange(startDay, ref)
  return `${formatDayMonth(from)} – ${formatDayMonth(to)}`
}
