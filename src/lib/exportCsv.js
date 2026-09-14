/** Export transaksi & ringkasan ke file CSV (unduh di browser) */

function escapeCsv(value) {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toCsv(header, rows) {
  const lines = [header, ...rows].map((row) =>
    row.map(escapeCsv).join(',')
  )
  return '\uFEFF' + lines.join('\n')
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function transactionsToCsv(transactions) {
  const header = [
    'Tanggal',
    'Tipe',
    'Kategori',
    'Jumlah',
    'Deskripsi',
    'Catatan',
    'Metode',
  ]
  const rows = (transactions || []).map((t) => [
    t.date || '',
    t.type || '',
    t.category || '',
    t.amount ?? '',
    t.description || '',
    t.note || '',
    t.method || '',
  ])
  return toCsv(header, rows)
}

export function exportTransactionsCsv(transactions) {
  const stamp = new Date().toISOString().slice(0, 10)
  downloadCsv(`bukukas-transaksi-${stamp}.csv`, transactionsToCsv(transactions))
}

/** Ringkasan per bulan + total kategori pengeluaran */
export function exportSummaryCsv(transactions) {
  const byMonth = {}
  const byExpenseCat = {}
  let totalIncome = 0
  let totalExpense = 0

  ;(transactions || []).forEach((t) => {
    const key = String(t.date || '').slice(0, 7)
    if (!byMonth[key]) byMonth[key] = { key, income: 0, expense: 0, count: 0 }
    if (t.type === 'income') {
      byMonth[key].income += Number(t.amount) || 0
      totalIncome += Number(t.amount) || 0
    } else if (t.type === 'expense') {
      byMonth[key].expense += Number(t.amount) || 0
      totalExpense += Number(t.amount) || 0
      const cat = t.category || 'Lainnya'
      byExpenseCat[cat] = (byExpenseCat[cat] || 0) + (Number(t.amount) || 0)
    }
    byMonth[key].count += 1
  })

  const monthRows = Object.values(byMonth)
    .sort((a, b) => b.key.localeCompare(a.key))
    .map((m) => [
      m.key,
      m.income,
      m.expense,
      m.income - m.expense,
      m.count,
    ])

  const monthSection = toCsv(
    ['Bulan', 'Pemasukan', 'Pengeluaran', 'Selisih', 'Jumlah Transaksi'],
    monthRows
  )

  const catRows = Object.entries(byExpenseCat)
    .sort((a, b) => b[1] - a[1])
    .map(([name, val]) => [name, val])

  const catSection = toCsv(['Kategori Pengeluaran', 'Total'], catRows)

  const totals = toCsv(
    ['Metrik', 'Nilai'],
    [
      ['Total Pemasukan', totalIncome],
      ['Total Pengeluaran', totalExpense],
      ['Selisih', totalIncome - totalExpense],
      ['Jumlah Transaksi', (transactions || []).length],
    ]
  )

  const stamp = new Date().toISOString().slice(0, 10)
  const body = [
    '=== TOTAL ===',
    totals,
    '',
    '=== PER BULAN ===',
    monthSection,
    '',
    '=== PENGELUARAN PER KATEGORI ===',
    catSection,
  ].join('\n')

  downloadCsv(`bukukas-ringkasan-${stamp}.csv`, body)
}
