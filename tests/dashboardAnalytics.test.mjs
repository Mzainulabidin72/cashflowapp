import test from 'node:test'
import assert from 'node:assert/strict'
import {
  balanceAt,
  buildBalanceHistory,
  buildExpenseByCategory,
  buildIncomeExpenseChart,
  inRange,
  periodBounds,
  previousPeriodBounds,
  sumByType,
} from '../src/lib/dashboardAnalytics.js'

const tx = (date, type, amount, category = 'Lainnya') => ({
  date,
  type,
  amount,
  category,
})

test('period filters cover the requested local calendar intervals', () => {
  const reference = new Date(2026, 10, 10, 12)

  assert.deepEqual(periodBounds('week', '', '', reference), {
    from: '2026-11-09',
    to: '2026-11-15',
  })
  assert.deepEqual(periodBounds('month', '', '', reference, 25), {
    from: '2026-10-25',
    to: '2026-11-24',
  })
  assert.deepEqual(periodBounds('lastMonth', '', '', reference, 25), {
    from: '2026-09-25',
    to: '2026-10-24',
  })
  assert.deepEqual(periodBounds('year', '', '', reference), {
    from: '2026-01-01',
    to: '2026-12-31',
  })
  assert.deepEqual(periodBounds('custom', '2026-10-03', '2026-10-12', reference), {
    from: '2026-10-03',
    to: '2026-10-12',
  })
})

test('previous periods are equal-length and immediately precede the selected period', () => {
  assert.deepEqual(
    previousPeriodBounds('week', { from: '2026-11-09', to: '2026-11-15' }),
    { from: '2026-11-02', to: '2026-11-08' },
  )
  assert.deepEqual(
    previousPeriodBounds('month', { from: '2026-10-25', to: '2026-11-24' }, 25),
    { from: '2026-09-25', to: '2026-10-24' },
  )
  assert.deepEqual(
    previousPeriodBounds('custom', { from: '2026-03-10', to: '2026-03-19' }),
    { from: '2026-02-28', to: '2026-03-09' },
  )
})

test('date filtering and totals use the same inclusive range', () => {
  const range = { from: '2026-11-01', to: '2026-11-30' }
  const records = [
    tx('2026-10-31', 'income', 900),
    tx('2026-11-01', 'income', 1000),
    tx('2026-11-30', 'expense', 250),
    tx('2026-12-01', 'expense', 500),
  ]
  const selected = records.filter((record) => inRange(record.date, range))

  assert.equal(sumByType(selected, 'income'), 1000)
  assert.equal(sumByType(selected, 'expense'), 250)
  assert.equal(selected.length, 2)
  assert.equal(inRange('2026-11-15', { from: '2026-12-01', to: '2026-12-10' }), false)
})

test('income and expense bars aggregate only selected real transactions', () => {
  const records = [
    tx('2026-11-09', 'income', 1000),
    tx('2026-11-09', 'expense', 300),
    tx('2026-11-15', 'income', 600),
    tx('2026-11-16', 'income', 9999),
  ]
  const chart = buildIncomeExpenseChart(records, 'week', {
    from: '2026-11-09',
    to: '2026-11-15',
  })

  assert.equal(chart.length, 7)
  assert.deepEqual(chart[0], {
    key: '2026-11-09',
    label: '09 Nov',
    income: 1000,
    expense: 300,
  })
  assert.equal(chart[6].income, 600)
  assert.equal(chart.reduce((sum, day) => sum + day.income, 0), 1600)
  assert.equal(chart.some((day) => day.income === 9999), false)
})

test('year chart groups actual activity by month', () => {
  const chart = buildIncomeExpenseChart([
    tx('2026-01-03', 'income', 1250),
    tx('2026-01-20', 'expense', 200),
    tx('2026-03-01', 'income', 500),
  ], 'year', { from: '2026-01-01', to: '2026-12-31' })

  assert.equal(chart.length, 12)
  assert.equal(chart[0].income, 1250)
  assert.equal(chart[0].expense, 200)
  assert.equal(chart[1].income, 0)
  assert.equal(chart[2].income, 500)
})

test('category breakdown sums categorized expenses and sorts by value', () => {
  const categories = buildExpenseByCategory([
    tx('2026-11-02', 'expense', 250, 'Makan'),
    tx('2026-11-03', 'expense', 600, 'Transportasi'),
    tx('2026-11-04', 'expense', 150, 'Makan'),
    tx('2026-11-04', 'income', 800, 'Makan'),
    tx('2026-10-31', 'expense', 999, 'Di luar periode'),
    tx('2026-11-05', 'expense', 100, ''),
  ], { from: '2026-11-01', to: '2026-11-30' })

  assert.deepEqual(categories, [
    { name: 'Transportasi', value: 600 },
    { name: 'Makan', value: 400 },
  ])
})

test('balance history uses opening balance and actual chronological transaction dates only', () => {
  const records = [
    tx('2026-01-04', 'expense', 80),
    tx('2026-01-02', 'income', 200),
    tx('2026-01-01', 'income', 500),
    tx('2026-01-02', 'expense', 50),
    tx('2026-01-05', 'income', 500),
  ]
  const range = { from: '2026-01-02', to: '2026-01-04' }
  const history = buildBalanceHistory(records, 1000, range)

  assert.equal(history.startingBalance, 1500)
  assert.equal(history.endingBalance, 1570)
  assert.deepEqual(history.balanceHistory.map(({ date, saldo }) => ({ date, saldo })), [
    { date: '2026-01-02', saldo: 1650 },
    { date: '2026-01-04', saldo: 1570 },
  ])
  assert.equal(balanceAt(records, 1000, '2026-01-04'), 1570)
})

