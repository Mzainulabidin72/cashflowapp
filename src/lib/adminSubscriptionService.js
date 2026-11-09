import { supabase } from './supabase'
import { performSuperAdminAction } from './adminActionService'

async function isSuperAdmin() {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) return false
  const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (error) throw error
  return data.role === 'super_admin'
}

export async function listAllSubscriptions() {
  const data = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const { data: page, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) throw error
    data.push(...(page || []))
    if (!page || page.length < pageSize) break
  }
  if (!data.length) return []

  const userIds = [...new Set(data.map((s) => s.user_id).filter(Boolean))]
  const planIds = [...new Set(data.map((s) => s.plan_id).filter(Boolean))]
  const subscriptionIds = data.map((s) => s.id)

  let profileMap = {}
  let planMap = {}
  let paymentMap = {}

  for (let index = 0; index < userIds.length; index += 100) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds.slice(index, index + 100))
    if (profileError) throw profileError
    ;(profiles || []).forEach((p) => {
      profileMap[p.id] = p
    })
  }

  for (let index = 0; index < planIds.length; index += 100) {
    const { data: plans, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, name, price, duration_days')
      .in('id', planIds.slice(index, index + 100))
    if (planError) throw planError
    ;(plans || []).forEach((p) => {
      planMap[p.id] = p
    })
  }

  for (let index = 0; index < subscriptionIds.length; index += 100) {
    const { data: payments, error: paymentError } = await supabase
      .from('subscription_payments')
      .select('id, subscription_id, status, amount, created_at')
      .in('subscription_id', subscriptionIds.slice(index, index + 100))
      .order('created_at', { ascending: false })
    if (paymentError) throw paymentError
    ;(payments || []).forEach((payment) => {
      if (!paymentMap[payment.subscription_id]) paymentMap[payment.subscription_id] = payment
    })
  }

  return data.map((s) => ({
    ...s,
    profile: profileMap[s.user_id] || null,
    plan: planMap[s.plan_id] || s.plan || null,
    payment: paymentMap[s.id] || null,
  }))
}

export async function cancelSubscription(id) {
  if (await isSuperAdmin()) {
    return performSuperAdminAction('subscription-cancel', { subscriptionId: id })
  }
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
  if (await isSuperAdmin()) {
    return performSuperAdminAction('subscription-activate', { subscriptionId: id, durationDays })
  }
  const { data: paidPayment, error: paymentError } = await supabase
    .from('subscription_payments')
    .select('id')
    .eq('subscription_id', id)
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle()
  if (paymentError) throw paymentError
  if (!paidPayment) throw new Error('Pembayaran terverifikasi diperlukan sebelum langganan diaktifkan.')
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

export async function extendSubscription(id, days) {
  if (!Number.isInteger(Number(days)) || Number(days) < 1 || Number(days) > 3650) {
    throw new Error('Perpanjangan harus antara 1 dan 3650 hari.')
  }
  if (await isSuperAdmin()) {
    return performSuperAdminAction('subscription-extend', { subscriptionId: id, days: Number(days) })
  }
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, ends_at')
    .eq('id', id)
    .single()
  if (error) throw error
  if (data.status !== 'active') throw new Error('Hanya langganan aktif yang dapat diperpanjang.')
  const ends = new Date(data.ends_at || new Date())
  if (ends < new Date()) ends.setTime(Date.now())
  ends.setDate(ends.getDate() + Number(days))
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({ ends_at: ends.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updateError) throw updateError
}
