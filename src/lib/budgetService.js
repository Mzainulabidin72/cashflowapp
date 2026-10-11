import { supabase } from './supabase'
import { inCurrentPeriod } from './prefs'

export async function loadBudget(userId) {
  const { data, error } = await supabase
    .from('user_budgets')
    .select('monthly_limit')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data ? Number(data.monthly_limit) || 0 : 0
}

export async function saveBudget(userId, monthlyLimit) {
  const value = Math.max(0, Number(monthlyLimit) || 0)
  const { error } = await supabase.from('user_budgets').upsert({
    user_id: userId,
    monthly_limit: value,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
  return value
}

/** Total pengeluaran "bulan ini" (mengikuti tanggal mulai bulan di Pengaturan) */
export function sumExpenseThisMonth(transactions) {
  return (transactions || [])
    .filter((t) => t.type === 'expense' && inCurrentPeriod(t.date))
    .reduce((s, t) => s + (Number(t.amount) || 0), 0)
}
