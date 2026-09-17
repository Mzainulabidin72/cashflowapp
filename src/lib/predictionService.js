/** Prediksi sederhana dari rata-rata N bulan terakhir */
export function monthlyTotals(transactions) {
  const map = {}
  ;(transactions || []).forEach((t) => {
    const key = String(t.date || '').slice(0, 7)
    if (!key || key.length < 7) return
    if (!map[key]) map[key] = { income: 0, expense: 0 }
    const a = Number(t.amount) || 0
    if (t.type === 'income') map[key].income += a
    else if (t.type === 'expense') map[key].expense += a
  })
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      income: v.income,
      expense: v.expense,
      net: v.income - v.expense,
    }))
}

export function simpleForecast(transactions, monthsAhead = 3) {
  const rows = monthlyTotals(transactions)
  const last = rows.slice(-6) // max 6 bulan terakhir
  if (!last.length) {
    return {
      avgIncome: 0,
      avgExpense: 0,
      avgNet: 0,
      months: [],
      message: 'Belum cukup data transaksi.',
    }
  }
  const avgIncome = last.reduce((s, r) => s + r.income, 0) / last.length
  const avgExpense = last.reduce((s, r) => s + r.expense, 0) / last.length
  const avgNet = avgIncome - avgExpense

  const base = last[last.length - 1].month
  const [y, m] = base.split('-').map(Number)
  const months = []
  for (let i = 1; i <= monthsAhead; i++) {
    const d = new Date(y, m - 1 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({
      month: key,
      income: Math.round(avgIncome),
      expense: Math.round(avgExpense),
      net: Math.round(avgNet),
    })
  }
  return {
    avgIncome: Math.round(avgIncome),
    avgExpense: Math.round(avgExpense),
    avgNet: Math.round(avgNet),
    months,
    basedOn: last.length,
    message: null,
  }
}
