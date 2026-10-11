/**
 * Backup semua data pengguna ke satu file JSON.
 *
 * Transaksi, kategori, dan saldo awal diambil dari data yang sudah dimuat aplikasi.
 * Anggaran, dompet, dan utang diambil dari server; kalau salah satunya gagal dimuat
 * (mis. fitur Pro belum aktif), bagian itu ditulis null dan backup tetap jadi.
 */

import { loadBudget } from './budgetService'
import { listWallets } from './walletService'
import { listDebts } from './debtService'

export const BACKUP_VERSION = 1

export async function buildBackup({ user, profile, transactions, categories, saldoAwal }) {
  const safe = async (fn) => {
    try {
      return await fn()
    } catch (e) {
      console.warn('Backup: bagian dilewati', e?.message || e)
      return null
    }
  }

  const [monthlyBudget, wallets, debts] = await Promise.all([
    safe(() => loadBudget(user.id)),
    safe(() => listWallets(user.id)),
    safe(() => listDebts(user.id)),
  ])

  return {
    app: 'lanila-buku-kas',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    account: { email: user.email || '', name: profile?.full_name || '' },
    saldoAwal: Number(saldoAwal) || 0,
    categories: categories || { income: [], expense: [] },
    monthlyBudget,
    wallets,
    debts,
    transactions: (transactions || []).map((t) => ({
      id: t.id,
      date: t.date,
      type: t.type,
      category: t.category,
      amount: Number(t.amount) || 0,
      description: t.description || '',
      note: t.note || '',
      method: t.method || '',
    })),
  }
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function backupFileName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `backup-bukukas-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}.json`
}
