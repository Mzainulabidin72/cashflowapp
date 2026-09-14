import { supabase } from './supabase'

export async function loadTransactions(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error) throw error
  return (data || []).map((t) => ({
    id: t.id,
    date: t.date,
    type: t.type,
    category: t.category,
    amount: Number(t.amount),
    description: t.description,
    note: t.note || '',
    method: t.method || '',
  }))
}

export async function insertTransaction(userId, t) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      date: t.date,
      type: t.type,
      category: t.category,
      amount: t.amount,
      description: t.description,
      note: t.note || '',
      method: t.method || '',
    })
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    date: data.date,
    type: data.type,
    category: data.category,
    amount: Number(data.amount),
    description: data.description,
    note: data.note || '',
    method: data.method || '',
  }
}

export async function updateTransactionDb(userId, t) {
  const { error } = await supabase
    .from('transactions')
    .update({
      date: t.date,
      type: t.type,
      category: t.category,
      amount: t.amount,
      description: t.description,
      note: t.note || '',
      method: t.method || '',
    })
    .eq('id', t.id)
    .eq('user_id', userId)

  if (error) throw error
}

export async function deleteTransactionDb(userId, id) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}

export async function clearUserTransactions(userId) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('user_id', userId)

  if (error) throw error
}

export async function loadCategories(userId) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)

  if (error) throw error
  if (!data || data.length === 0) return null

  return {
    income: data.filter((c) => c.type === 'income').map((c) => c.name),
    expense: data.filter((c) => c.type === 'expense').map((c) => c.name),
  }
}

export async function saveCategories(userId, categories) {
  await supabase.from('categories').delete().eq('user_id', userId)

  const rows = [
    ...categories.income.map((name) => ({ user_id: userId, type: 'income', name })),
    ...categories.expense.map((name) => ({ user_id: userId, type: 'expense', name })),
  ]

  if (rows.length) {
    const { error } = await supabase.from('categories').insert(rows)
    if (error) throw error
  }
}

export async function loadSaldoAwal(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('saldo_awal')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data ? Number(data.saldo_awal) : 0
}

export async function saveSaldoAwal(userId, saldo) {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, saldo_awal: saldo })

  if (error) throw error
}

export async function seedUserData(userId, seedTransactions, defaultCategories) {
  await saveCategories(userId, defaultCategories)

  const rows = seedTransactions.map((t) => ({
    user_id: userId,
    date: t.date,
    type: t.type,
    category: t.category,
    amount: t.amount,
    description: t.description,
    note: t.note || '',
    method: t.method || '',
  }))

  const chunkSize = 50
  for (let i = 0; i < rows.length; i += chunkSize) {
    const { error } = await supabase
      .from('transactions')
      .insert(rows.slice(i, i + chunkSize))
    if (error) throw error
  }

  await saveSaldoAwal(userId, 0)
}
