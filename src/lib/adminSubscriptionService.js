import { supabase } from './supabase'
import { expireStalePayments } from './expiryService'

export async function listAllSubscriptions() {
  try {
    await expireStalePayments()
  } catch (_) {}

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error
  if (!data?.length) return []

  const userIds = [...new Set(data.map((s) => s.user_id).filter(Boolean))]
  const planIds = [...new Set(data.map((s) => s.plan_id).filter(Boolean))]

  let profileMap = {}
  let planMap = {}

  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)
    ;(profiles || []).forEach((p) => {
      profileMap[p.id] = p
    })
  }

  if (planIds.length) {
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('id, name, price, duration_days')
      .in('id', planIds)
    ;(plans || []).forEach((p) => {
      planMap[p.id] = p
    })
  }

  return data.map((s) => ({
    ...s,
    profile: profileMap[s.user_id] || null,
    plan: planMap[s.plan_id] || s.plan || null,
  }))
}

export async function cancelSubscription(id) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function activateSubscription(id, durationDays = 30) {
  const starts = new Date()
  const ends = new Date()
  ends.setDate(ends.getDate() + Number(durationDays || 30))
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}
