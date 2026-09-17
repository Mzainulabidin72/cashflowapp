import { supabase } from './supabase'

export async function listDebts(userId) {
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map((d) => ({
    ...d,
    amount: Number(d.amount) || 0,
    paid: Number(d.paid) || 0,
  }))
}

export async function createDebt(userId, row) {
  const { data, error } = await supabase
    .from('debts')
    .insert({
      user_id: userId,
      kind: row.kind || 'debt',
      person: String(row.person || '').trim(),
      amount: Number(row.amount) || 0,
      paid: Number(row.paid) || 0,
      due_date: row.due_date || null,
      note: row.note || '',
      status: row.status || 'open',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDebt(userId, id, patch) {
  const { error } = await supabase
    .from('debts')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function deleteDebt(userId, id) {
  const { error } = await supabase
    .from('debts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export function remaining(d) {
  return Math.max(0, (Number(d.amount) || 0) - (Number(d.paid) || 0))
}
