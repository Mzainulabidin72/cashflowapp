import { supabase } from './supabase'

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

/** Total pengeluaran bulan berjalan (YYYY-MM) */
export function sumExpenseThisMonth(transactions) {
  const key = new Date().toISOString().slice(0, 7)
  return (transactions || [])
    .filter((t) => t.type === 'expense' && String(t.date || '').startsWith(key))
    .reduce((s, t) => s + (Number(t.amount) || 0), 0)
}
