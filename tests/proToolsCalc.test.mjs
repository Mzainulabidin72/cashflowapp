import assert from 'node:assert/strict'
import * as C from '../src/lib/proToolsCalc.js'

const T = new Date(2026, 9, 12)             // 12 Okt 2026
const tx = (date, type, amount, category = 'Makanan') => ({ date, type, amount, category })
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`)
const noBad = (o, path = '') => { if (typeof o === 'number') assert.ok(Number.isFinite(o), `angka tidak valid di ${path}: ${o}`); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) noBad(v, path + '.' + k) }

// periode
assert.equal(C.periodKeyOf('2026-10-12', 1), '2026-10'); assert.equal(C.periodKeyOf('2026-10-12', 25), '2026-09')
assert.equal(C.periodKeyOf('2026-10-25', 25), '2026-10'); assert.equal(C.periodKeyOf('2026-01-03', 25), '2025-12'); assert.equal(C.periodKeyOf('bukan', 1), null)
assert.deepEqual(C.periodRange('2026-02', 1), { from: '2026-02-01', to: '2026-02-28' }); assert.deepEqual(C.periodRange('2026-12', 25), { from: '2026-12-25', to: '2027-01-24' })
assert.equal(C.addMonthsKey('2026-11', 3), '2027-02'); assert.equal(C.addMonthsKey('2026-01', -1), '2025-12')
assert.equal(C.periodLabel('2026-10', 1), 'Okt 2026'); assert.equal(C.periodLabel('2026-09', 25), '25 Sep – 24 Okt 2026'); assert.equal(C.parseIso('2026-02-30'), null)

// riwayat: periode berjalan TIDAK ikut; bulan kosong dicatat; jendela 6
const txs = [
  tx('2026-03-05', 'income', 5000), tx('2026-03-10', 'expense', 3000), tx('2026-04-05', 'income', 5000), tx('2026-04-10', 'expense', 3500),
  tx('2026-06-05', 'income', 6000), tx('2026-06-10', 'expense', 6500), tx('2026-07-05', 'income', 5000), tx('2026-07-10', 'expense', 2000),
  tx('2026-08-05', 'income', 5000), tx('2026-08-10', 'expense', 4000), tx('2026-09-05', 'income', 5000), tx('2026-09-10', 'expense', 4500),
  tx('2026-10-02', 'income', 9999), tx('2026-10-03', 'expense', 1000),
]
let h = C.history(txs, T, 1, 6)
assert.deepEqual(h.periods.map(p => p.key), ['2026-04', '2026-06', '2026-07', '2026-08', '2026-09']); assert.deepEqual(h.missing, ['2026-05'])
assert.ok(!h.periods.some(p => p.key === '2026-10')); assert.equal(h.current.income, 9999)
let b = C.baseline(h); assert.equal(b.n, 5); assert.equal(b.status, 'ok'); close(b.avgIncome, 5200); close(b.avgExpense, 4100); close(b.avgNet, 1100); assert.equal(b.minNet, -500); assert.equal(b.maxNet, 3000)
assert.equal(C.baseline(C.history([], T)).status, 'none'); assert.equal(C.baseline(C.history([tx('2026-09-05', 'income', 100)], T)).status, 'limited')
assert.equal(C.history([tx('2026-10-05', 'income', 100)], T).periods.length, 0)
h = C.history(txs, T, 1, 3); assert.deepEqual(h.periods.map(p => p.key), ['2026-07', '2026-08', '2026-09']); assert.deepEqual(C.recentAvgExpense(h, 2), { avg: 4250, n: 2 })

// periode berjalan vs sebelumnya pada hari yang sama
const mtd = C.periodToDate(txs, T, 1)
assert.equal(mtd.elapsed, 12); assert.equal(mtd.prevTo, '2026-09-12'); assert.equal(mtd.cur.income, 9999); assert.equal(mtd.prev.expense, 4500); assert.ok(mtd.hasPrev)
assert.equal(C.periodToDate([tx('2026-10-02', 'income', 1)], T, 1).hasPrev, false)
const m25 = C.periodToDate([tx('2026-09-30', 'expense', 100), tx('2026-09-26', 'expense', 50), tx('2026-08-27', 'expense', 70)], T, 25)
assert.equal(m25.elapsed, 18); assert.equal(m25.cur.expense, 150); assert.equal(m25.prev.expense, 70)
assert.equal(C.pctChange(150, 100), 50); assert.equal(C.pctChange(50, 0), null); assert.equal(C.periodToDate([tx('2026-02-20', 'expense', 10), tx('2026-03-31', 'expense', 5)], new Date(2026, 2, 31), 1).prevTo, '2026-02-28')

// kategori
const ct = C.categoryTotals([tx('2026-10-01', 'expense', 600, 'Makanan'), tx('2026-10-02', 'expense', 400, 'makanan '), tx('2026-10-03', 'expense', 300, 'Transport'),
  tx('2026-10-04', 'expense', 100, ''), tx('2026-10-05', 'expense', 100, null), tx('2026-10-06', 'income', 9999, 'Gaji'), tx('2026-11-01', 'expense', 5000, 'X')], '2026-10-01', '2026-10-31')
assert.equal(ct.total, 1500); assert.deepEqual(ct.rows.map(r => [r.name, r.amount]), [['Makanan', 1000], ['Transport', 300], ['Tanpa kategori', 200]]); close(ct.rows.reduce((s, r) => s + r.pct, 0), 100)
assert.deepEqual(C.categoryTotals([], '2026-10-01', '2026-10-31'), { total: 0, rows: [] })
const z = C.expenseAnalysis([tx('2026-10-02', 'income', 5)], T, 1, 1); assert.equal(z.total, 0); assert.equal(z.totalChange, null); noBad(z)
const ea = C.expenseAnalysis(txs.concat([tx('2026-09-02', 'expense', 100, 'Hiburan')]), T, 1, 3)
assert.equal(ea.from, '2026-08-01'); assert.equal(ea.prevTo, '2026-07-31'); assert.equal(ea.prevFrom, '2026-05-01'); assert.ok(ea.rows.find(r => r.name === 'Hiburan').isNew)

// dompet
const wb = [{ id: 'a', type: 'bank', balance: 700 }, { id: 'b', type: 'cash', balance: 300 }, { id: 'c', type: 'investment', balance: 1000 }, { id: 'd', type: 'other', balance: -200 }]
assert.deepEqual(C.walletTotals(wb), { total: 1800, liquid: 800, illiquid: 1000, count: 4 })
const sh = C.walletShares(wb); close(sh.a, 35); close(sh.c, 50); assert.equal(sh.d, null); assert.deepEqual(C.walletShares([{ id: 'x', balance: 0 }]), { x: null })

// utang
const D = (o) => ({ kind: 'debt', person: 'A', amount: 1000, paid: 0, status: 'open', due_date: null, ...o })
assert.deepEqual(C.dueInfo('2026-10-10', T), { status: 'overdue', days: -2, label: 'Terlambat 2 hari' }); assert.equal(C.dueInfo('2026-10-12', T).status, 'today')
assert.equal(C.dueInfo('2026-10-26', T).status, 'soon'); assert.equal(C.dueInfo('2026-10-27', T).status, 'ok'); assert.equal(C.dueInfo(null, T).status, 'none')
const debts = [D({ amount: 1000, paid: 400, due_date: '2026-10-10' }), D({ amount: 500, due_date: '2026-10-20' }), D({ amount: 800, status: 'paid', paid: 800 }), D({ kind: 'receivable', amount: 300, due_date: '2026-10-01' }), D({ amount: 100, paid: 100 })]
assert.deepEqual(C.debtSummary(debts, 'debt', T), { outstanding: 1100, active: 2, overdue: 1, overdueAmount: 600, soon: 1, soonAmount: 500 })
assert.deepEqual(C.applyPayment(D({ amount: 1000, paid: 400 }), 600), { paid: 1000, status: 'paid' }); assert.deepEqual(C.applyPayment(D({ amount: 1000, paid: 400 }), 100), { paid: 500, status: 'open' })
for (const bad of [601, 0, -5, 'abc']) assert.ok(C.applyPayment(D({ amount: 1000, paid: 400 }), bad).error)
assert.deepEqual(Object.keys(C.validateDebt({ person: '  ', amount: '', due_date: '2026-13-01' }).errors).sort(), ['amount', 'due_date', 'person'])
assert.ok(C.validateDebt({ person: 'Budi', amount: 300 }, { minAmount: 400 }).errors.amount.includes('{{400}}'))
assert.deepEqual(C.validateDebt({ person: ' Budi ', amount: '2500', due_date: '', note: ' x ' }).value, { person: 'Budi', amount: 2500, due_date: null, note: 'x' })

// goal
const G = (o) => ({ id: 'g', name: 'Laptop', target: 10000, current: 2500, monthly: 1000, targetDate: '2027-04-12', ...o })
let g = C.goalProgress(G(), T)
assert.equal(g.pct, 25); assert.equal(g.remaining, 7500); assert.equal(g.daysLeft, 182); assert.equal(g.monthsLeft, 6); assert.equal(g.neededMonthly, 1250); assert.equal(g.eta, '2027-06'); assert.equal(g.onTrack, false)
assert.equal(C.goalProgress(G({ monthly: 1250 }), T).onTrack, true)
g = C.goalProgress(G({ current: 12000 }), T); assert.equal(g.pct, 100); assert.equal(g.remaining, 0); assert.ok(g.done); assert.equal(g.eta, null)
noBad(C.goalProgress(G({ target: 0 }), T)); noBad(C.goalProgress(G({ current: -50, target: 'abc', monthly: null }), T))
assert.equal(C.goalProgress(G({ monthly: 0 }), T).eta, null); assert.equal(C.goalProgress(G({ targetDate: null }), T).neededMonthly, null)
assert.ok(C.goalProgress(G({ targetDate: '2026-10-01' }), T).overdue); assert.equal(C.timeLeftLabel(C.goalProgress(G({ targetDate: '2026-10-30' }), T)), '18 hari lagi')
assert.deepEqual(Object.keys(C.validateGoal({ name: '', target: '', current: '-1', monthly: 'x', targetDate: '2020-01-01' }, T).errors).sort(), ['current', 'monthly', 'name', 'target', 'targetDate'])
assert.deepEqual(C.validateGoal({ name: ' Rumah ', target: '5000', current: '', monthly: '', targetDate: '' }, T).value, { name: 'Rumah', target: 5000, current: 0, monthly: 0, targetDate: null })

// prakiraan
h = C.history(txs, T, 1, 6)
const f = C.forecast(h, 1, [D({ amount: 700, due_date: '2026-11-15' }), D({ kind: 'receivable', amount: 200, due_date: '2026-11-20' }), D({ amount: 50, due_date: '2026-12-01', status: 'paid', paid: 50 })], 3)
assert.equal(f.status, 'ok'); assert.deepEqual(f.months.map(m => m.key), ['2026-11', '2026-12', '2027-01']); close(f.months[0].net, 1100); close(f.months[2].cumulative, 3300)
assert.equal(f.months[0].dueDebt, 700); assert.equal(f.months[0].dueReceivable, 200); assert.equal(f.months[1].dueDebt, 0); noBad(f)
assert.equal(C.forecast(C.history([], T), 1, [], 3).status, 'none'); assert.equal(C.forecast(C.history([tx('2026-09-05', 'income', 100)], T), 1, [], 3).status, 'limited')

// runway
assert.equal(C.cashRunway(1000, { avg: 0, n: 0 }).status, 'unavailable'); assert.equal(C.cashRunway(1000, { avg: 0, n: 2 }).status, 'unavailable')
assert.equal(C.cashRunway(-300, { avg: 500, n: 3 }).status, 'empty'); assert.equal(C.cashRunway(2500, { avg: 500, n: 3 }).months, 5)
assert.equal(C.runwayLabel(5), '5,0 bulan'); assert.equal(C.runwayLabel(500), '> 120 bulan'); assert.equal(C.runwayLabel(NaN), '—'); assert.equal(C.runwayLabel(Infinity), '—')

// health
let hl = C.financialHealth({ h, liquid: 8000, totalDebt: 0, avgExpense: C.recentAvgExpense(h, 3).avg })
assert.equal(hl.availableCount, 4); assert.equal(hl.components[0].value, 100); assert.equal(Math.round(hl.components[2].value), 76); assert.equal(hl.score, Math.round((100 + 100 + 76.19 + 100) / 4)); noBad(hl)
hl = C.financialHealth({ h: C.history([], T), liquid: 0, totalDebt: 0, avgExpense: 0 }); assert.equal(hl.score, null); assert.equal(hl.label, 'Data belum cukup'); assert.equal(hl.availableCount, 1)
hl = C.financialHealth({ h: C.history([tx('2026-08-05', 'expense', 100), tx('2026-09-05', 'expense', 100)], T), liquid: 500, totalDebt: 0, avgExpense: 100 }); assert.equal(hl.components[0].available, false); assert.equal(typeof hl.score, 'number')
hl = C.financialHealth({ h, liquid: -5000, totalDebt: 2000, avgExpense: 3500 }); assert.ok(hl.components.every(c => !c.available || (c.value >= 0 && c.value <= 100))); assert.equal(hl.components[1].value, 0); noBad(hl)
assert.deepEqual([90, 80, 79, 60, 59, 40, 39, 0].map(C.healthLabel), ['Sangat baik', 'Sangat baik', 'Baik', 'Baik', 'Cukup', 'Cukup', 'Perlu perhatian', 'Perlu perhatian'])
const adv = C.healthAdvice(C.financialHealth({ h, liquid: 1000, totalDebt: 3000, avgExpense: 3500 }), { baseline: C.baseline(h), liquid: 1000, debts: [D({ person: 'Bank X', due_date: '2026-10-20' })], today: T })
assert.deepEqual(adv.map(a => a.id).sort(), ['debt', 'emergency']); assert.match(adv.find(a => a.id === 'debt').text, /Bank X/)

// insight
const run = C.cashRunway(2000, { avg: 4100, n: 5 })
const ins = C.buildInsights({ txs: txs.concat([tx('2026-10-04', 'expense', 9000, 'Elektronik')]), today: T, startDay: 1, debts: [D({ person: 'A', amount: 300, due_date: '2026-10-05' }), D({ person: 'B', amount: 400, due_date: '2026-10-20' }), D({ kind: 'receivable', amount: 100, due_date: '2026-10-14' })],
  goals: [G({ monthly: 500 }), G({ id: 'g2', name: 'Rumah', monthly: 2000 }), G({ id: 'g3', name: 'Selesai', current: 99999 })], runway: run })
const ids = ins.map(i => i.id); assert.equal(new Set(ids).size, ids.length)
for (const need of ['debt-overdue', 'debt-soon', 'recv-soon', 'expense-change', 'cashflow', 'top-category', 'runway', 'goal-g', 'goal-g2']) assert.ok(ids.includes(need), 'harus ada ' + need)
assert.ok(!ids.includes('goal-g3')); assert.equal(ins.find(i => i.id === 'goal-g').level, 'warn'); assert.equal(ins.find(i => i.id === 'goal-g2').level, 'ok'); assert.ok(ins.every(i => i.title && i.detail && i.period))
assert.deepEqual(C.buildInsights({ txs: [], today: T, startDay: 1, debts: [], goals: [], runway: C.cashRunway(0, { avg: 0, n: 0 }) }), []); assert.equal(C.fillMoney('Total {{1500}} dan {{-20}}', n => 'Rp ' + n), 'Total Rp 1500 dan Rp -20')

// simulasi
let v = C.validateSim({ income: '', expense: '-5', savings: 'x', extra: '', months: 7 }); assert.deepEqual(Object.keys(v.errors).sort(), ['expense', 'income', 'savings']); assert.equal(v.value.months, 6)
v = C.validateSim({ income: '5000', expense: '3000', savings: '', extra: '', months: '12' }); assert.ok(v.ok); assert.equal(v.value.months, 12)
let s = C.simulate({ startCash: 1000, income: 5000, expense: 3000, savings: 500, extra: 800, months: 6 }, C.baseline(h))
assert.equal(s.afterSavings, 1500); assert.equal(s.totalSaved, 3000); assert.equal(s.endingCash, 1000 + 1500 * 6 - 800); assert.equal(s.endingTotal, 1000 + 2000 * 6 - 800); close(s.diff, (1000 + 12000 - 800) - (1000 + 6600))
s = C.simulate({ startCash: 1000, income: 1000, expense: 1500, savings: 0, extra: 0, months: 3 }, C.baseline(C.history([], T))); assert.equal(s.diff, null); assert.equal(s.runsOut, 2); assert.equal(s.endingCash, -500)
noBad(C.simulate({ startCash: 0, income: 0, expense: 0, savings: 0, extra: 0, months: 24 }, null))
console.log('SEMUA TES PERHITUNGAN LOLOS ✅')
