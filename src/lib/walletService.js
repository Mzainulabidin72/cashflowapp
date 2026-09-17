import { supabase } from './supabase'

export async function listWallets(userId) {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createWallet(userId, { name, type, balance_start }) {
  const { data, error } = await supabase
    .from('wallets')
    .insert({
      user_id: userId,
      name: String(name || '').trim() || 'Dompet',
      type: type || 'cash',
      balance_start: Number(balance_start) || 0,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateWallet(userId, id, patch) {
  const { error } = await supabase
    .from('wallets')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function deleteWallet(userId, id) {
  const { error } = await supabase
    .from('wallets')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

/** Saldo efektif = balance_start + income - expense (opsional filter wallet) */
export function walletBalance(wallet, transactions) {
  const start = Number(wallet.balance_start) || 0
  const txs = (transactions || []).filter(
    (t) => !wallet.id || t.wallet_id === wallet.id || (!t.wallet_id && false)
  )
  // jika transaksi punya wallet_id
  const linked = (transactions || []).filter((t) => t.wallet_id === wallet.id)
  let delta = 0
  linked.forEach((t) => {
    const a = Number(t.amount) || 0
    if (t.type === 'income') delta += a
    else if (t.type === 'expense') delta -= a
  })
  return start + delta
}
