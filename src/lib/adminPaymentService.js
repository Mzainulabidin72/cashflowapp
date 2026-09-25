import { supabase } from './supabase'
import { expireStalePayments } from './expiryService'

export async function listAllPayments() {
  await expireStalePayments()

  const { data, error } = await supabase
    .from('subscription_payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  if (!data?.length) return []

  const userIds = [...new Set(data.map((p) => p.user_id).filter(Boolean))]
  let map = {}
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)
    ;(profiles || []).forEach((p) => {
      map[p.id] = p
    })
  }

  return data.map((p) => ({
    ...p,
    profile: map[p.user_id] || null,
  }))
}

export async function approvePayment(paymentId, subscriptionId) {
  const { error } = await supabase
    .from('subscription_payments')
    .update({ status: 'paid' })
    .eq('id', paymentId)
  if (error) throw error

  if (subscriptionId) {
    const starts = new Date()
    const ends = new Date()
    ends.setDate(ends.getDate() + 30)
    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
      })
      .eq('id', subscriptionId)
  }
}

export async function rejectPayment(paymentId, reason = '') {
  const { error } = await supabase
    .from('subscription_payments')
    .update({
      status: 'rejected',
      note: reason || 'Ditolak admin',
    })
    .eq('id', paymentId)
  if (error) throw error
}
