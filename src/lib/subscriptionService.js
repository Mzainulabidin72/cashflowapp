import { supabase } from './supabase'
import { writeLog } from './activityService'

export async function listPlans() {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true })

  if (error) throw error
  return data || []
}

export async function listAllPlans() {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('price', { ascending: true })

  if (error) throw error
  return data || []
}

export async function createPlan({ name, description, price, duration_days }) {
  const { data, error } = await supabase
    .from('subscription_plans')
    .insert({
      name,
      description: description || '',
      price,
      duration_days,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getMySubscription(userId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  let plan = null
  if (data.plan_id) {
    const { data: p } = await supabase
      .from('subscription_plans')
      .select('id, name, price, duration_days, description, is_active')
      .eq('id', data.plan_id)
      .maybeSingle()
    plan = p
  }

  return { ...data, plan }
}

export async function requestSubscription(userId, planId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan_id: planId,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw error

  await writeLog({
    userId,
    role: 'user',
    action: 'subscription_request',
    targetId: data.id,
    metadata: { plan_id: planId },
  })

  return data
}

export async function listAllSubscriptions() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!data?.length) return []

  const userIds = [...new Set(data.map((s) => s.user_id).filter(Boolean))]
  const planIds = [...new Set(data.map((s) => s.plan_id).filter(Boolean))]

  let profileMap = {}
  let planMap = {}

  if (userIds.length) {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)
    if (pErr) throw pErr
    ;(profiles || []).forEach((p) => {
      profileMap[p.id] = p
    })
  }

  if (planIds.length) {
    const { data: plans, error: plErr } = await supabase
      .from('subscription_plans')
      .select('id, name, price, duration_days')
      .in('id', planIds)
    if (plErr) throw plErr
    ;(plans || []).forEach((p) => {
      planMap[p.id] = p
    })
  }

  return data.map((s) => ({
    ...s,
    profile: profileMap[s.user_id] || null,
    plan: planMap[s.plan_id] || null,
  }))
}

export async function updateSubscriptionStatus(id, status, extra = {}) {
  const payload = {
    status,
    updated_at: new Date().toISOString(),
    ...extra,
  }

  const { error } = await supabase
    .from('subscriptions')
    .update(payload)
    .eq('id', id)

  if (error) throw error
}

export async function activateSubscription(id, durationDays, adminUserId = null) {
  const starts = new Date()
  const ends = new Date()
  ends.setDate(ends.getDate() + (durationDays || 30))

  await updateSubscriptionStatus(id, 'active', {
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
  })

  await writeLog({
    userId: adminUserId,
    role: 'admin',
    action: 'subscription_activate',
    targetId: id,
    metadata: { duration_days: durationDays },
  })
}