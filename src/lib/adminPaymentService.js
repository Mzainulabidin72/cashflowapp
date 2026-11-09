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

export async function listAllPayments() {
  const data = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const { data: page, error } = await supabase
      .from('subscription_payments')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) throw error
    data.push(...(page || []))
    if (!page || page.length < pageSize) break
  }
  if (!data.length) return []

  const userIds = [...new Set(data.map((p) => p.user_id).filter(Boolean))]
  let map = {}
  for (let index = 0; index < userIds.length; index += 100) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles').select('id, full_name, email').in('id', userIds.slice(index, index + 100))
    if (profileError) throw profileError
    ;(profiles || []).forEach((profile) => { map[profile.id] = profile })
  }

  const subscriptionIds = [...new Set(data.map((p) => p.subscription_id).filter(Boolean))]
  const subscriptionMap = {}
  for (let index = 0; index < subscriptionIds.length; index += 100) {
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('id, plan_id')
      .in('id', subscriptionIds.slice(index, index + 100))
    if (subscriptionError) throw subscriptionError
    const planIds = [...new Set((subscriptions || []).map((s) => s.plan_id).filter(Boolean))]
    const planMap = {}
    if (planIds.length) {
      const { data: plans, error: planError } = await supabase
        .from('subscription_plans')
        .select('id, name')
        .in('id', planIds)
      if (planError) throw planError
      ;(plans || []).forEach((plan) => { planMap[plan.id] = plan })
    }
    ;(subscriptions || []).forEach((subscription) => {
      subscriptionMap[subscription.id] = { ...subscription, plan: planMap[subscription.plan_id] || null }
    })
  }

  return data.map((p) => ({
    ...p,
    profile: map[p.user_id] || null,
    subscription: subscriptionMap[p.subscription_id] || null,
  }))
}

export async function approvePayment(paymentId, subscriptionId) {
  if (await isSuperAdmin()) {
    return performSuperAdminAction('payment-approve', { paymentId, subscriptionId })
  }
  const { data: updatedPayment, error } = await supabase
    .from('subscription_payments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', paymentId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!updatedPayment) throw new Error('Pembayaran sudah tidak berstatus pending.')

  if (subscriptionId) {
    const { data: payment, error: paymentError } = await supabase
      .from('subscription_payments')
      .select('id')
      .eq('id', paymentId)
      .eq('status', 'paid')
      .maybeSingle()
    if (paymentError) throw paymentError
    if (!payment) throw new Error('Pembayaran belum berhasil diverifikasi.')

    const starts = new Date()
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('id', subscriptionId)
      .single()
    if (subscriptionError) throw subscriptionError
    let days = 30
    if (subscription.plan_id) {
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('duration_days')
        .eq('id', subscription.plan_id)
        .maybeSingle()
      if (planError) throw planError
      days = Number(plan?.duration_days) || 30
    }
    const ends = new Date(starts)
    ends.setDate(ends.getDate() + days)
    const { error: activateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
      })
      .eq('id', subscriptionId)
    if (activateError) throw activateError
  }
}

export async function rejectPayment(paymentId, reason = '') {
  if (await isSuperAdmin()) {
    return performSuperAdminAction('payment-reject', { paymentId, reason })
  }
  const { error } = await supabase
    .from('subscription_payments')
    .update({
      status: 'rejected',
      note: reason || 'Ditolak admin',
    })
    .eq('id', paymentId)
    .eq('status', 'pending')
  if (error) throw error
}
