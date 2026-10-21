/**
 * Perhitungan Tools Pro — fungsi murni (tanpa React/Supabase) supaya mudah diuji.
 *
 * Konsep penting
 * ─────────────
 * • PERIODE = "bulan" menurut tanggal mulai di Pengaturan (startDay 1–28). startDay = 1 → bulan
 *   kalender biasa. Periode diberi kunci "YYYY-MM" dari bulan tempat ia DIMULAI
 *   (startDay 25: periode "2026-09" = 25 Sep – 24 Okt).
 * • Riwayat hanya memakai periode yang SUDAH SELESAI. Periode berjalan belum lengkap sehingga
 *   tidak ikut rata-rata (itu yang membuat prakiraan lama selalu terlalu rendah).
 * • Tidak ada angka karangan: kalau data tidak cukup, hasilnya null / status 'unavailable'.
 * • Semua tanggal berupa string "YYYY-MM-DD" (tanggal lokal). "today" selalu dioper sebagai Date.
 * • Teks yang memuat nominal memakai token {{angka}}; UI yang memformatnya (Rp, titik/koma
 *   mengikuti Pengaturan) lewat fillMoney() — modul ini sengaja tidak bergantung pada preferensi.
 */

const pad = (n) => String(n).padStart(2, '0')
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const MONTHS_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/* ------------------------------------------------------------------ */
/* Tanggal & periode                                                   */
/* ------------------------------------------------------------------ */

export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** "YYYY-MM-DD" valid → { y, m, d } ; selain itu null */
export function parseIso(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const [y, mo, d] = [+m[1], +m[2], +m[3]]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return { y, m: mo, d }
}

const utcDay = (iso) => {
  const p = parseIso(iso)
  return p ? Date.UTC(p.y, p.m - 1, p.d) : NaN
}

export function addDaysIso(iso, n) {
  const t = utcDay(iso)
  if (Number.isNaN(t)) return iso
  const d = new Date(t + n * 86400000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Selisih hari (b − a), bilangan bulat. */
export function daysBetween(aIso, bIso) {
  return Math.round((utcDay(bIso) - utcDay(aIso)) / 86400000)
}

/** Geser kunci bulan: addMonthsKey('2026-11', 3) → '2027-02' */
export function addMonthsKey(key, n) {
  const [y, m] = key.split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`
}

const sd = (startDay) => clamp(Math.round(num(startDay)) || 1, 1, 28)

/** Kunci periode yang memuat tanggal ini. */
export function periodKeyOf(iso, startDay = 1) {
  const p = parseIso(iso)
  if (!p) return null
  const key = `${p.y}-${pad(p.m)}`
  return p.d >= sd(startDay) ? key : addMonthsKey(key, -1)
}

/** { from, to } (inklusif) untuk satu periode. */
export function periodRange(key, startDay = 1) {
  const s = sd(startDay)
  const from = `${key}-${pad(s)}`
  const next = addMonthsKey(key, 1)
  return { from, to: addDaysIso(`${next}-${pad(s)}`, -1) }
}

export function periodLabel(key, startDay = 1) {
  const [y, m] = key.split('-').map(Number)
  const s = sd(startDay)
  if (s === 1) return `${MONTHS_SHORT[m - 1]} ${y}`
  const { from, to } = periodRange(key, s)
  const f = parseIso(from)
  const t = parseIso(to)
  return `${f.d} ${MONTHS_SHORT[f.m - 1]} – ${t.d} ${MONTHS_SHORT[t.m - 1]} ${t.y}`
}

/** Label singkat untuk sumbu grafik: "Okt" / "Okt 26" bila lintas tahun. */
export function periodShort(key, withYear = false) {
  const [y, m] = key.split('-').map(Number)
  return withYear ? `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}` : MONTHS_SHORT[m - 1]
}

export function monthName(key) {
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS_LONG[m - 1]} ${y}`
}

export function currentPeriodKey(today, startDay = 1) {
  return periodKeyOf(isoOf(today), startDay)
}

/* ------------------------------------------------------------------ */
/* Agregasi transaksi                                                  */
/* ------------------------------------------------------------------ */

/** Jumlahkan transaksi pada rentang tanggal inklusif. */
export function sumRange(txs, from, to) {
  const out = { income: 0, expense: 0, count: 0 }
  for (const t of txs || []) {
    const d = String(t.date || '').slice(0, 10)
    if (d < from || d > to) continue
    const a = num(t.amount)
    if (t.type === 'income') out.income += a
    else if (t.type === 'expense') out.expense += a
    else continue
    out.count += 1
  }
  out.net = out.income - out.expense
  return out
}

export function aggregateByPeriod(txs, startDay = 1) {
  const map = new Map()
  for (const t of txs || []) {
    if (t.type !== 'income' && t.type !== 'expense') continue
    const key = periodKeyOf(String(t.date || '').slice(0, 10), startDay)
    if (!key) continue
    const r = map.get(key) || { income: 0, expense: 0, count: 0 }
    if (t.type === 'income') r.income += num(t.amount)
    else r.expense += num(t.amount)
    r.count += 1
    map.set(key, r)
  }
  return map
}

/**
 * Riwayat periode SELESAI (urut lama → baru), maksimal `window` periode terakhir sejak
 * periode pertama yang ada transaksinya. Periode tanpa transaksi dicatat di `missing`
 * dan tidak ikut rata-rata.
 */
export function history(txs, today, startDay = 1, window = 6) {
  const agg = aggregateByPeriod(txs, startDay)
  const currentKey = currentPeriodKey(today, startDay)
  const keys = [...agg.keys()].sort()
  const firstKey = keys[0] || null
  const periods = []
  const missing = []
  if (firstKey) {
    for (let i = window; i >= 1; i--) {
      const k = addMonthsKey(currentKey, -i)
      if (k < firstKey) continue
      const r = agg.get(k)
      if (r) {
        periods.push({ key: k, label: periodLabel(k, startDay), income: r.income, expense: r.expense, net: r.income - r.expense, count: r.count })
      } else missing.push(k)
    }
  }
  return { periods, missing, firstKey, currentKey, current: agg.get(currentKey) || { income: 0, expense: 0, count: 0 } }
}

/** Rata-rata dari riwayat. status: none (0 periode) | limited (1–2) | ok (≥3). */
export function baseline(h) {
  const p = h.periods
  const n = p.length
  if (!n) return { n: 0, status: 'none', avgIncome: 0, avgExpense: 0, avgNet: 0, minNet: 0, maxNet: 0 }
  const avgIncome = p.reduce((s, r) => s + r.income, 0) / n
  const avgExpense = p.reduce((s, r) => s + r.expense, 0) / n
  const nets = p.map((r) => r.net)
  return {
    n,
    status: n >= 3 ? 'ok' : 'limited',
    avgIncome,
    avgExpense,
    avgNet: avgIncome - avgExpense,
    minNet: Math.min(...nets),
    maxNet: Math.max(...nets),
  }
}

/** Rata-rata pengeluaran dari n periode selesai terakhir. */
export function recentAvgExpense(h, n = 3) {
  const last = h.periods.slice(-n)
  if (!last.length) return { avg: 0, n: 0 }
  return { avg: last.reduce((s, r) => s + r.expense, 0) / last.length, n: last.length }
}

/**
 * Periode berjalan sampai hari ini vs periode sebelumnya pada jumlah hari yang sama.
 * Perbandingan "sampai tanggal yang sama" adil, tidak membandingkan bulan penuh dengan bulan setengah.
 */
export function periodToDate(txs, today, startDay = 1) {
  const key = currentPeriodKey(today, startDay)
  const { from, to } = periodRange(key, startDay)
  const todayIso = isoOf(today)
  const toNow = todayIso < to ? todayIso : to
  const elapsed = daysBetween(from, toNow) + 1
  const prevKey = addMonthsKey(key, -1)
  const prevR = periodRange(prevKey, startDay)
  const prevToCandidate = addDaysIso(prevR.from, elapsed - 1)
  const prevTo = prevToCandidate < prevR.to ? prevToCandidate : prevR.to
  const cur = sumRange(txs, from, toNow)
  const prev = sumRange(txs, prevR.from, prevTo)
  const agg = aggregateByPeriod(txs, startDay)
  // pembanding hanya bermakna bila periode sebelumnya punya transaksi
  const hasPrev = (agg.get(prevKey)?.count || 0) > 0
  return { key, from, to: toNow, fullTo: to, elapsed, cur, prev, prevFrom: prevR.from, prevTo, hasPrev }
}

/** Perubahan persen; null bila pembanding 0/tidak ada. */
export function pctChange(cur, prev) {
  if (!(prev > 0)) return null
  return ((cur - prev) / prev) * 100
}

/* ------------------------------------------------------------------ */
/* Kategori pengeluaran                                                */
/* ------------------------------------------------------------------ */

const catKey = (c) => String(c ?? '').trim().replace(/\s+/g, ' ').toLowerCase() || 'tanpa kategori'
const catLabel = (c) => String(c ?? '').trim().replace(/\s+/g, ' ') || 'Tanpa kategori'

/**
 * Total pengeluaran per kategori pada rentang. Variasi huruf/spasi ("Makanan " / "makanan")
 * digabung. Urut dari terbesar. pct memakai total SEMUA kategori sebagai penyebut.
 */
export function categoryTotals(txs, from, to) {
  const map = new Map()
  let total = 0
  for (const t of txs || []) {
    if (t.type !== 'expense') continue
    const d = String(t.date || '').slice(0, 10)
    if (d < from || d > to) continue
    const a = num(t.amount)
    total += a
    const k = catKey(t.category)
    const r = map.get(k) || { amount: 0, count: 0, labels: new Map() }
    r.amount += a
    r.count += 1
    const lb = catLabel(t.category)
    r.labels.set(lb, (r.labels.get(lb) || 0) + 1)
    map.set(k, r)
  }
  const rows = [...map.entries()].map(([key, r]) => ({
    key,
    name: [...r.labels.entries()].sort((a, b) => b[1] - a[1])[0][0],
    amount: r.amount,
    count: r.count,
    pct: total > 0 ? (r.amount / total) * 100 : 0,
  }))
  rows.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  return { total, rows }
}

/**
 * Analisis pengeluaran untuk n periode (1 = periode berjalan sampai hari ini) beserta pembanding
 * pada panjang yang sama tepat sebelumnya.
 */
export function expenseAnalysis(txs, today, startDay = 1, nPeriods = 1) {
  const key = currentPeriodKey(today, startDay)
  const todayIso = isoOf(today)
  const startKey = addMonthsKey(key, -(nPeriods - 1))
  const from = periodRange(startKey, startDay).from
  const curRange = periodRange(key, startDay)
  const to = todayIso < curRange.to ? todayIso : curRange.to

  let prevFrom, prevTo
  if (nPeriods === 1) {
    const p = periodToDate(txs, today, startDay)
    prevFrom = p.prevFrom
    prevTo = p.prevTo
  } else {
    prevFrom = periodRange(addMonthsKey(startKey, -nPeriods), startDay).from
    prevTo = addDaysIso(from, -1)
  }

  const cur = categoryTotals(txs, from, to)
  const prev = categoryTotals(txs, prevFrom, prevTo)
  const prevMap = new Map(prev.rows.map((r) => [r.key, r.amount]))
  const hasPrev = prev.total > 0
  const rows = cur.rows.map((r) => ({
    ...r,
    prevAmount: prevMap.get(r.key) || 0,
    change: hasPrev ? pctChange(r.amount, prevMap.get(r.key) || 0) : null,
    isNew: hasPrev && !(prevMap.get(r.key) > 0),
  }))
  return { from, to, prevFrom, prevTo, total: cur.total, prevTotal: prev.total, hasPrev, rows, totalChange: hasPrev ? pctChange(cur.total, prev.total) : null }
}

/* ------------------------------------------------------------------ */
/* Dompet                                                              */
/* ------------------------------------------------------------------ */

export const WALLET_TYPES = [
  { value: 'cash', label: 'Tunai' },
  { value: 'bank', label: 'Rekening bank' },
  { value: 'ewallet', label: 'E-Wallet' },
  { value: 'investment', label: 'Investasi' },
  { value: 'other', label: 'Lainnya' },
]
export const walletTypeLabel = (t) => WALLET_TYPES.find((x) => x.value === t)?.label || 'Lainnya'

/** Dompet investasi tidak dihitung sebagai dana likuid (tidak langsung bisa dipakai). */
export const isLiquidType = (t) => t !== 'investment'

/** balances: [{ id, type, balance }] */
export function walletTotals(balances) {
  let total = 0
  let liquid = 0
  for (const b of balances || []) {
    const v = num(b.balance)
    total += v
    if (isLiquidType(b.type)) liquid += v
  }
  return { total, liquid, illiquid: total - liquid, count: (balances || []).length }
}

/** Porsi tiap dompet terhadap total saldo POSITIF (null bila tidak bermakna). */
export function walletShares(balances) {
  const positive = (balances || []).reduce((s, b) => s + Math.max(0, num(b.balance)), 0)
  const map = {}
  for (const b of balances || []) map[b.id] = positive > 0 && num(b.balance) > 0 ? (num(b.balance) / positive) * 100 : null
  return map
}

/* ------------------------------------------------------------------ */
/* Utang & piutang                                                     */
/* ------------------------------------------------------------------ */

export const remainingOf = (d) => Math.max(0, num(d.amount) - num(d.paid))
export const isSettled = (d) => d.status === 'paid' || remainingOf(d) <= 0

/** status: none | overdue | today | soon (≤14 hari) | ok */
export function dueInfo(dueIso, today) {
  if (!dueIso || !parseIso(dueIso)) return { status: 'none', days: null, label: 'Tanpa jatuh tempo' }
  const days = daysBetween(isoOf(today), String(dueIso).slice(0, 10))
  if (days < 0) return { status: 'overdue', days, label: `Terlambat ${-days} hari` }
  if (days === 0) return { status: 'today', days, label: 'Jatuh tempo hari ini' }
  if (days <= 14) return { status: 'soon', days, label: `${days} hari lagi` }
  return { status: 'ok', days, label: `${days} hari lagi` }
}

export function debtSummary(debts, kind, today) {
  const rows = (debts || []).filter((d) => d.kind === kind && !isSettled(d))
  const s = { outstanding: 0, active: rows.length, overdue: 0, overdueAmount: 0, soon: 0, soonAmount: 0 }
  for (const d of rows) {
    const r = remainingOf(d)
    s.outstanding += r
    const info = dueInfo(d.due_date, today)
    if (info.status === 'overdue') { s.overdue += 1; s.overdueAmount += r }
    else if (info.status === 'today' || info.status === 'soon') { s.soon += 1; s.soonAmount += r }
  }
  return s
}

/** Validasi form utang/piutang. Mengembalikan { errors, value }. */
export function validateDebt(f, { minAmount = 0 } = {}) {
  const errors = {}
  const person = String(f.person ?? '').trim()
  if (!person) errors.person = 'Nama wajib diisi.'
  else if (person.length > 80) errors.person = 'Nama maksimal 80 karakter.'
  const amount = Number(f.amount)
  if (f.amount === '' || f.amount == null || !Number.isFinite(amount)) errors.amount = 'Jumlah wajib diisi dengan angka.'
  else if (amount <= 0) errors.amount = 'Jumlah harus lebih dari 0.'
  else if (amount > 1e13) errors.amount = 'Jumlah terlalu besar.'
  else if (amount < minAmount) errors.amount = `Jumlah tidak boleh kurang dari yang sudah dibayar ({{${minAmount}}}).`
  if (f.due_date && !parseIso(f.due_date)) errors.due_date = 'Tanggal tidak valid.'
  const note = String(f.note ?? '').trim()
  if (note.length > 200) errors.note = 'Catatan maksimal 200 karakter.'
  return { errors, value: { person, amount, due_date: f.due_date || null, note } }
}

/** Hasil pembayaran: paid baru + status. Pembayaran tidak boleh melebihi sisa. */
export function applyPayment(debt, payment) {
  const p = Number(payment)
  const left = remainingOf(debt)
  if (!Number.isFinite(p) || p <= 0) return { error: 'Jumlah pembayaran harus lebih dari 0.' }
  if (p > left + 0.0001) return { error: `Pembayaran melebihi sisa ({{${left}}}).` }
  const paid = Math.min(num(debt.amount), num(debt.paid) + p)
  return { paid, status: paid >= num(debt.amount) ? 'paid' : 'open' }
}

/* ------------------------------------------------------------------ */
/* Goal                                                                */
/* ------------------------------------------------------------------ */

export function validateGoal(f, today, { allowPastDate = false } = {}) {
  const errors = {}
  const name = String(f.name ?? '').trim()
  if (!name) errors.name = 'Nama tujuan wajib diisi.'
  else if (name.length > 60) errors.name = 'Nama maksimal 60 karakter.'
  const target = Number(f.target)
  if (f.target === '' || f.target == null || !Number.isFinite(target)) errors.target = 'Target wajib diisi dengan angka.'
  else if (target <= 0) errors.target = 'Target harus lebih dari 0.'
  else if (target > 1e13) errors.target = 'Target terlalu besar.'
  const currentRaw = f.current === '' || f.current == null ? 0 : Number(f.current)
  if (!Number.isFinite(currentRaw)) errors.current = 'Nominal terkumpul harus berupa angka.'
  else if (currentRaw < 0) errors.current = 'Nominal terkumpul tidak boleh negatif.'
  const monthlyRaw = f.monthly === '' || f.monthly == null ? 0 : Number(f.monthly)
  if (!Number.isFinite(monthlyRaw)) errors.monthly = 'Setoran bulanan harus berupa angka.'
  else if (monthlyRaw < 0) errors.monthly = 'Setoran bulanan tidak boleh negatif.'
  if (f.targetDate) {
    if (!parseIso(f.targetDate)) errors.targetDate = 'Tanggal tidak valid.'
    else if (!allowPastDate && String(f.targetDate) < isoOf(today)) errors.targetDate = 'Target tanggal tidak boleh di masa lalu.'
  }
  return {
    errors,
    value: { name, target, current: currentRaw, monthly: monthlyRaw, targetDate: f.targetDate || null },
  }
}

/**
 * Kemajuan goal. Semua pembagian dijaga: persen 0–100, sisa ≥ 0, tidak ada NaN/Infinity.
 * `current` = uang yang benar-benar sudah dicatat terkumpul; `monthly` = RENCANA setoran
 * (tidak otomatis memotong dompet).
 */
export function goalProgress(goal, today) {
  const target = Math.max(0, num(goal.target))
  const current = Math.max(0, num(goal.current))
  const monthly = Math.max(0, num(goal.monthly))
  const pct = target > 0 ? clamp((current / target) * 100, 0, 100) : 0
  const remaining = Math.max(0, target - current)
  const done = target > 0 && current >= target
  const todayIso = isoOf(today)
  const tdOk = goal.targetDate && parseIso(goal.targetDate)
  const daysLeft = tdOk ? daysBetween(todayIso, String(goal.targetDate).slice(0, 10)) : null
  const overdue = !done && daysLeft != null && daysLeft < 0
  const monthsLeft = daysLeft != null && daysLeft >= 0 ? Math.max(1, Math.ceil(daysLeft / 30.4375)) : null
  const neededMonthly = !done && monthsLeft != null ? Math.ceil(remaining / monthsLeft) : null

  // Estimasi selesai hanya bila ada rencana setoran > 0
  let eta = null
  let etaMonths = null
  if (!done && remaining > 0 && monthly > 0) {
    etaMonths = Math.ceil(remaining / monthly)
    eta = addMonthsKey(todayIso.slice(0, 7), etaMonths)
  }
  const onTrack = eta && tdOk ? eta <= String(goal.targetDate).slice(0, 7) : null
  return { pct, remaining, done, daysLeft, overdue, monthsLeft, neededMonthly, eta, etaMonths, onTrack, monthly }
}

export function timeLeftLabel(p) {
  if (p.done) return 'Tercapai'
  if (p.daysLeft == null) return 'Tanpa batas waktu'
  if (p.daysLeft < 0) return `Lewat ${-p.daysLeft} hari`
  if (p.daysLeft === 0) return 'Berakhir hari ini'
  if (p.daysLeft < 31) return `${p.daysLeft} hari lagi`
  const m = Math.floor(p.daysLeft / 30.4375)
  const d = Math.round(p.daysLeft - m * 30.4375)
  return d >= 3 ? `${m} bln ${d} hari lagi` : `${m} bulan lagi`
}

/* ------------------------------------------------------------------ */
/* Prakiraan arus kas                                                  */
/* ------------------------------------------------------------------ */

/**
 * Prakiraan transparan: rata-rata riwayat periode selesai (metode "rata-rata historis").
 * Setiap bulan prakiraan memakai angka rata-rata yang sama — ini asumsi, bukan prediksi
 * bertingkat — jadi ditampilkan bersama kisaran historis (net terendah–tertinggi) dan
 * kewajiban yang SUDAH DIKETAHUI (utang/piutang yang jatuh tempo di periode itu, dipisah dari rata-rata).
 */
export function forecast(h, startDay, debts, horizon = 3) {
  const b = baseline(h)
  if (!b.n) return { status: 'none', baseline: b, months: [], periodsUsed: [] }
  const months = []
  let cumulative = 0
  for (let i = 1; i <= horizon; i++) {
    const key = addMonthsKey(h.currentKey, i)
    const range = periodRange(key, startDay)
    let dueDebt = 0
    let dueReceivable = 0
    for (const d of debts || []) {
      if (isSettled(d) || !d.due_date) continue
      const due = String(d.due_date).slice(0, 10)
      if (due < range.from || due > range.to) continue
      if (d.kind === 'debt') dueDebt += remainingOf(d)
      else if (d.kind === 'receivable') dueReceivable += remainingOf(d)
    }
    cumulative += b.avgNet
    months.push({
      key,
      label: periodLabel(key, startDay),
      income: b.avgIncome,
      expense: b.avgExpense,
      net: b.avgNet,
      netLow: b.minNet,
      netHigh: b.maxNet,
      cumulative,
      dueDebt,
      dueReceivable,
    })
  }
  return {
    status: b.status,
    baseline: b,
    months,
    periodsUsed: h.periods.map((p) => p.label),
    missing: h.missing,
  }
}

/* ------------------------------------------------------------------ */
/* Cash runway                                                         */
/* ------------------------------------------------------------------ */

/**
 * @param liquid  saldo dana likuid (dompet selain investasi)
 * @param exp     hasil recentAvgExpense (objek dengan avg dan n)
 */
export function cashRunway(liquid, exp) {
  if (!exp || exp.n < 1 || !(exp.avg > 0)) {
    return { status: 'unavailable', reason: exp?.n ? 'Pengeluaran rata-rata 0, runway tidak bisa dihitung.' : 'Belum ada periode selesai dengan data pengeluaran.' }
  }
  if (!(liquid > 0)) return { status: 'empty', months: 0, liquid, avgExpense: exp.avg, n: exp.n }
  return { status: 'ok', months: liquid / exp.avg, liquid, avgExpense: exp.avg, n: exp.n }
}

export function runwayLabel(months) {
  if (!Number.isFinite(months)) return '—'
  if (months >= 120) return '> 120 bulan'
  return `${months.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bulan`
}

/* ------------------------------------------------------------------ */
/* Financial health                                                    */
/* ------------------------------------------------------------------ */

export const HEALTH_TARGETS = { savingsRate: 0.2, emergencyMonths: 3 }

export function healthLabel(score) {
  if (score == null) return 'Data belum cukup'
  if (score >= 80) return 'Sangat baik'
  if (score >= 60) return 'Baik'
  if (score >= 40) return 'Cukup'
  return 'Perlu perhatian'
}

/**
 * Skor 0–100 = rata-rata komponen yang DATANYA ADA (bobot sama). Komponen tanpa data tidak
 * diisi angka karangan — ditandai unavailable dan tidak ikut. Skor baru muncul bila ≥ 3
 * dari 4 komponen tersedia.
 */
export function financialHealth({ h, liquid, totalDebt, avgExpense }) {
  const comps = []
  const last3 = h.periods.slice(-3)

  // 1. Tingkat tabungan
  {
    const inc = last3.reduce((s, r) => s + r.income, 0)
    const exp = last3.reduce((s, r) => s + r.expense, 0)
    if (last3.length && inc > 0) {
      const rate = (inc - exp) / inc
      comps.push({
        id: 'savings', label: 'Tingkat tabungan', available: true,
        value: clamp((rate / HEALTH_TARGETS.savingsRate) * 100, 0, 100),
        display: `${(rate * 100).toLocaleString('id-ID', { maximumFractionDigits: 0 })}% dari pemasukan`,
        detail: `Selisih pemasukan dan pengeluaran ${last3.length} periode terakhir yang selesai. Patokan sehat: sekitar ${HEALTH_TARGETS.savingsRate * 100}% atau lebih.`,
        raw: { rate, income: inc, expense: exp, n: last3.length },
      })
    } else comps.push({ id: 'savings', label: 'Tingkat tabungan', available: false, detail: 'Belum ada pemasukan pada periode yang sudah selesai.' })
  }

  // 2. Beban utang
  {
    if (totalDebt <= 0) {
      comps.push({ id: 'debt', label: 'Beban utang', available: true, value: 100, display: 'Tidak ada utang aktif', detail: 'Tidak ada sisa utang yang tercatat.', raw: { ratio: 0 } })
    } else {
      const base = Math.max(0, liquid) + totalDebt
      const ratio = totalDebt / base
      comps.push({
        id: 'debt', label: 'Beban utang', available: true,
        value: clamp((1 - ratio) * 100, 0, 100),
        display: `${(ratio * 100).toLocaleString('id-ID', { maximumFractionDigits: 0 })}% dari kas + utang`,
        detail: 'Sisa utang dibanding total (dana likuid + sisa utang). Makin kecil makin baik.',
        raw: { ratio, totalDebt, liquid },
      })
    }
  }

  // 3. Dana darurat
  {
    if (avgExpense > 0) {
      const coverage = Math.max(0, liquid) / avgExpense
      comps.push({
        id: 'emergency', label: 'Dana darurat', available: true,
        value: clamp((coverage / HEALTH_TARGETS.emergencyMonths) * 100, 0, 100),
        display: `${coverage.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bulan pengeluaran`,
        detail: `Dana likuid dibanding rata-rata pengeluaran bulanan. Patokan: ${HEALTH_TARGETS.emergencyMonths} bulan.`,
        raw: { coverage, liquid, avgExpense },
      })
    } else comps.push({ id: 'emergency', label: 'Dana darurat', available: false, detail: 'Belum ada data pengeluaran periode selesai.' })
  }

  // 4. Arus kas
  {
    if (last3.length >= 2) {
      const positive = last3.filter((r) => r.net >= 0).length
      comps.push({
        id: 'cashflow', label: 'Arus kas', available: true,
        value: (positive / last3.length) * 100,
        display: `${positive} dari ${last3.length} periode surplus`,
        detail: 'Berapa periode terakhir yang pemasukannya menutup pengeluaran.',
        raw: { positive, n: last3.length },
      })
    } else comps.push({ id: 'cashflow', label: 'Arus kas', available: false, detail: 'Perlu minimal 2 periode selesai.' })
  }

  const avail = comps.filter((c) => c.available)
  const score = avail.length >= 3 ? Math.round(avail.reduce((s, c) => s + c.value, 0) / avail.length) : null
  return { score, label: healthLabel(score), components: comps, availableCount: avail.length }
}

/** Saran konkret per komponen (hanya yang nilainya < 70), dengan angka dari data pengguna. */
export function healthAdvice(health, ctx) {
  const { baseline: b, liquid, debts, today } = ctx
  const out = []
  for (const c of health.components) {
    if (!c.available || c.value >= 70) continue
    if (c.id === 'savings') {
      const target = b.avgIncome * HEALTH_TARGETS.savingsRate
      const gap = Math.max(0, target - Math.max(0, b.avgNet))
      out.push({ id: c.id, label: c.label, text: gap > 0
        ? `Untuk mencapai ${HEALTH_TARGETS.savingsRate * 100}% pemasukan, sisihkan sekitar {{${Math.round(gap)}}} lebih banyak per bulan (kisaran, dari rata-rata pemasukan {{${Math.round(b.avgIncome)}}}).`
        : 'Pertahankan selisih pemasukan dan pengeluaranmu.', amount: Math.round(gap) })
    } else if (c.id === 'debt') {
      const nextDue = (debts || []).filter((d) => d.kind === 'debt' && !isSettled(d) && d.due_date).sort((a, z) => String(a.due_date).localeCompare(String(z.due_date)))[0]
      out.push({ id: c.id, label: c.label, text: nextDue
        ? `Prioritaskan utang yang paling dekat jatuh tempo: ${nextDue.person} (${dueInfo(nextDue.due_date, today).label.toLowerCase()}).`
        : 'Kurangi sisa utang secara bertahap agar rasio terhadap kas membaik.' })
    } else if (c.id === 'emergency') {
      const targetFund = c.raw.avgExpense * HEALTH_TARGETS.emergencyMonths
      const gap = Math.max(0, targetFund - Math.max(0, liquid))
      out.push({ id: c.id, label: c.label, text: `Dana likuid kira-kira kurang {{${Math.round(gap)}}} dari target ${HEALTH_TARGETS.emergencyMonths} bulan pengeluaran ({{${Math.round(targetFund)}}}).`, amount: Math.round(gap) })
    } else if (c.id === 'cashflow') {
      out.push({ id: c.id, label: c.label, text: `${c.raw.n - c.raw.positive} dari ${c.raw.n} periode terakhir pengeluaran melebihi pemasukan. Tinjau kategori pengeluaran terbesar.` })
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Insight                                                             */
/* ------------------------------------------------------------------ */

/**
 * Insight dari data nyata. Tiap insight menyebut angka dan periodenya. Urutan: peringatan →
 * info → positif. Tidak ada insight ganda untuk hal yang sama (mis. runway vs dana darurat).
 * ctx: { txs, today, startDay, debts, goals, runway }
 */
export function buildInsights(ctx) {
  const { txs, today, startDay, debts, goals, runway } = ctx
  const list = []
  const ptd = periodToDate(txs, today, startDay)
  const periodName = periodLabel(ptd.key, startDay)

  // 1. Utang/piutang jatuh tempo
  const du = debtSummary(debts, 'debt', today)
  const rc = debtSummary(debts, 'receivable', today)
  if (du.overdue) list.push({ id: 'debt-overdue', level: 'warn', icon: 'clock', title: `${du.overdue} utang terlambat`, detail: `Total sisa yang lewat jatuh tempo: {{${du.overdueAmount}}}.`, period: 'Saat ini' })
  if (du.soon) list.push({ id: 'debt-soon', level: 'warn', icon: 'clock', title: `${du.soon} utang jatuh tempo ≤ 14 hari`, detail: `Total sisa yang akan jatuh tempo: {{${du.soonAmount}}}.`, period: '14 hari ke depan' })
  if (rc.overdue) list.push({ id: 'recv-overdue', level: 'info', icon: 'clock', title: `${rc.overdue} piutang lewat jatuh tempo`, detail: `Total yang belum diterima: {{${rc.overdueAmount}}}. Pertimbangkan menagih.`, period: 'Saat ini' })
  if (rc.soon) list.push({ id: 'recv-soon', level: 'info', icon: 'clock', title: `${rc.soon} piutang jatuh tempo ≤ 14 hari`, detail: `Total yang akan jatuh tempo: {{${rc.soonAmount}}}.`, period: '14 hari ke depan' })

  // 2. Perubahan pengeluaran vs periode sebelumnya (sampai tanggal yang sama)
  if (ptd.hasPrev && ptd.prev.expense > 0 && ptd.cur.expense > 0) {
    const ch = pctChange(ptd.cur.expense, ptd.prev.expense)
    if (ch != null && Math.abs(ch) >= 10) {
      const up = ch > 0
      list.push({ id: 'expense-change', level: up ? 'warn' : 'ok', icon: up ? 'trend-up' : 'trend-down',
        title: `Pengeluaran ${up ? 'naik' : 'turun'} ${Math.abs(Math.round(ch))}%`,
        detail: `{{${ptd.cur.expense}}} dibanding {{${ptd.prev.expense}}} pada ${ptd.elapsed} hari pertama periode sebelumnya.`,
        period: periodName })
    }
  }

  // 3. Arus kas periode berjalan
  if (ptd.cur.count > 0) {
    const net = ptd.cur.net
    list.push({ id: 'cashflow', level: net < 0 ? 'warn' : 'ok', icon: net < 0 ? 'trend-down' : 'trend-up',
      title: net < 0 ? 'Arus kas bersih defisit' : 'Arus kas bersih surplus',
      detail: `Sejauh ini {{${Math.abs(net)}}} ${net < 0 ? 'lebih banyak keluar daripada masuk' : 'lebih banyak masuk daripada keluar'} (pemasukan {{${ptd.cur.income}}}, pengeluaran {{${ptd.cur.expense}}}).`,
      period: `${periodName} (sampai hari ini)` })
  }

  // 4. Kategori pengeluaran terbesar periode berjalan
  const cats = categoryTotals(txs, ptd.from, ptd.to)
  if (cats.rows.length && cats.total > 0) {
    const top = cats.rows[0]
    list.push({ id: 'top-category', level: 'info', icon: 'pie', title: `Terbesar: ${top.name}`,
      detail: `{{${top.amount}}} atau ${top.pct.toLocaleString('id-ID', { maximumFractionDigits: 0 })}% dari total pengeluaran {{${cats.total}}}.`,
      period: `${periodName} (sampai hari ini)` })
  }

  // 5. Dana darurat / runway (satu insight saja)
  if (runway?.status === 'ok' && runway.months < 3) {
    list.push({ id: 'runway', level: 'warn', icon: 'shield', title: `Dana likuid cukup ${runwayLabel(runway.months)}`,
      detail: `{{${runway.liquid}}} dibanding rata-rata pengeluaran {{${runway.avgExpense}}} per bulan (${runway.n} periode terakhir). Patokan umum: 3 bulan.`,
      period: `${runway.n} periode selesai` })
  } else if (runway?.status === 'empty') {
    list.push({ id: 'runway', level: 'warn', icon: 'shield', title: 'Tidak ada dana likuid tercatat',
      detail: `Saldo dompet likuid 0 atau negatif, sementara pengeluaran rata-rata {{${runway.avgExpense}}} per bulan.`, period: `${runway.n} periode selesai` })
  }

  // 6. Goal
  for (const g of (goals || []).filter((x) => x.status !== 'archived')) {
    const p = goalProgress(g, today)
    if (p.done) continue
    if (p.overdue) list.push({ id: `goal-${g.id}`, level: 'warn', icon: 'target', title: `Goal "${g.name}" lewat target`, detail: `Terkumpul {{${num(g.current)}}} dari {{${num(g.target)}}} (${Math.round(p.pct)}%); sudah lewat ${-p.daysLeft} hari dari tanggal target.`, period: 'Saat ini' })
    else if (p.neededMonthly != null && p.monthly > 0 && p.monthly < p.neededMonthly) list.push({ id: `goal-${g.id}`, level: 'warn', icon: 'target', title: `Goal "${g.name}" belum on track`, detail: `Rencana setoran {{${p.monthly}}}/bln, butuh sekitar {{${p.neededMonthly}}}/bln agar tercapai sebelum target.`, period: `Sisa ${p.monthsLeft} bulan` })
    else if (p.neededMonthly != null && p.monthly > 0 && p.monthly >= p.neededMonthly) list.push({ id: `goal-${g.id}`, level: 'ok', icon: 'target', title: `Goal "${g.name}" on track`, detail: `Rencana setoran {{${p.monthly}}}/bln sudah memenuhi kebutuhan sekitar {{${p.neededMonthly}}}/bln. Terkumpul ${Math.round(p.pct)}%.`, period: `Sisa ${p.monthsLeft} bulan` })
  }

  const order = { warn: 0, info: 1, ok: 2 }
  return list.sort((a, b) => order[a.level] - order[b.level])
}

/* ------------------------------------------------------------------ */
/* Simulasi                                                            */
/* ------------------------------------------------------------------ */

export const SIM_DURATIONS = [3, 6, 12, 24]

export function validateSim(f) {
  const errors = {}
  const read = (key, label, required) => {
    const raw = f[key]
    if (raw === '' || raw == null) { if (required) errors[key] = `${label} wajib diisi.`; return 0 }
    const v = Number(raw)
    if (!Number.isFinite(v)) errors[key] = `${label} harus berupa angka.`
    else if (v < 0) errors[key] = `${label} tidak boleh negatif.`
    else if (v > 1e13) errors[key] = `${label} terlalu besar.`
    return Number.isFinite(v) ? v : 0
  }
  const income = read('income', 'Pemasukan', true)
  const expense = read('expense', 'Pengeluaran', true)
  const savings = read('savings', 'Tabungan', false)
  const extra = read('extra', 'Pengeluaran sekali', false)
  const months = SIM_DURATIONS.includes(Number(f.months)) ? Number(f.months) : 6
  return { errors, ok: !Object.keys(errors).length, value: { income, expense, savings, extra, months } }
}

/**
 * Simulasi hipotetis — murni hitungan, tidak menyentuh data apa pun.
 *  • kas akhir      = kas awal + (pemasukan − pengeluaran − tabungan) × bulan − pengeluaran sekali
 *  • tabungan total = tabungan × bulan (disisihkan, bukan hilang)
 *  • pembanding     = kas + tabungan bila memakai rata-rata riwayat (tanpa tabungan/pengeluaran sekali)
 */
export function simulate({ startCash, income, expense, savings, extra, months }, base) {
  const netBeforeSavings = income - expense
  const afterSavings = netBeforeSavings - savings
  const totalSaved = savings * months
  const series = []
  const baseSeries = base && base.n > 0 ? [] : null
  for (let m = 0; m <= months; m++) {
    series.push({ m, cash: startCash + afterSavings * m - (m >= 1 ? extra : 0), total: startCash + netBeforeSavings * m - (m >= 1 ? extra : 0) })
    if (baseSeries) baseSeries.push({ m, total: startCash + base.avgNet * m })
  }
  const endingCash = series[months].cash
  const endingTotal = series[months].total
  const baselineEnding = baseSeries ? baseSeries[months].total : null
  return {
    netBeforeSavings,
    afterSavings,
    totalSaved,
    endingCash,
    endingTotal,
    baselineEnding,
    diff: baselineEnding == null ? null : endingTotal - baselineEnding,
    series,
    baseSeries,
    runsOut: afterSavings < 0 && startCash > 0 ? startCash / -afterSavings : null,
  }
}

/** Ganti token {{angka}} dalam teks dengan nominal terformat. fmt = (n) => string */
export function fillMoney(text, fmt) {
  return String(text ?? '').replace(/\{\{(-?[\d.]+(?:e[+-]?\d+)?)\}\}/gi, (_, n) => fmt(Number(n)))
}
