import { supabase } from './supabase'
import { performSuperAdminAction } from './adminActionService'

export async function listClients() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role, status, created_at')
    .eq('role', 'user')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function listAllProfiles() {
  const rows = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, role, status, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  if (!rows.length) return rows

  const userIds = rows.map((row) => row.id)
  const subscriptionRows = []
  const activityRows = []
  for (let index = 0; index < userIds.length; index += 100) {
    const userBatch = userIds.slice(index, index + 100)
    const [subscriptionsResult, activityResult] = await Promise.all([
      supabase.from('subscriptions')
        .select('id, user_id, plan_id, status, starts_at, ends_at, created_at')
        .in('user_id', userBatch)
        .order('created_at', { ascending: false }),
      supabase.from('activity_logs')
        .select('user_id, created_at')
        .in('user_id', userBatch)
        .order('created_at', { ascending: false })
        .limit(1000),
    ])
    if (subscriptionsResult.error) throw subscriptionsResult.error
    if (activityResult.error) throw activityResult.error
    subscriptionRows.push(...(subscriptionsResult.data || []))
    activityRows.push(...(activityResult.data || []))
  }

  const planIds = [...new Set(subscriptionRows.map((s) => s.plan_id).filter(Boolean))]
  const plansResult = planIds.length
    ? await supabase.from('subscription_plans').select('id, name, duration_days').in('id', planIds)
    : { data: [], error: null }
  if (plansResult.error) throw plansResult.error

  const plans = new Map((plansResult.data || []).map((plan) => [plan.id, plan]))
  const subscriptions = new Map()
  for (const subscription of subscriptionRows) {
    const currentStatus = String(subscription.status || '').toLowerCase()
    const notExpired = !subscription.ends_at || new Date(subscription.ends_at) >= new Date()
    if (!subscriptions.has(subscription.user_id) && notExpired && ['active', 'pending'].includes(currentStatus)) {
      subscriptions.set(subscription.user_id, {
        ...subscription,
        plan: plans.get(subscription.plan_id) || null,
      })
    }
  }
  const lastActivity = new Map()
  for (const log of activityRows) {
    if (!lastActivity.has(log.user_id)) lastActivity.set(log.user_id, log.created_at)
  }
  return rows.map((row) => ({
    ...row,
    subscription: subscriptions.get(row.id) || null,
    last_activity: lastActivity.get(row.id) || null,
  }))
}

export async function updateProfileRole(userId, role, actorUserId = null) {
  if (!['user', 'admin'].includes(role)) {
    throw new Error('Role Super Admin tidak dapat diberikan dari manajemen akun.')
  }
  await performSuperAdminAction('profile-role', { userId, role })
}

export async function updateProfileStatus(userId, status, actorUserId = null) {
  if (!['active', 'inactive', 'suspended'].includes(status)) {
    throw new Error('Status akun tidak valid.')
  }
  await performSuperAdminAction('profile-status', { userId, status })
}

export async function getMaintenance() {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'maintenance')
    .maybeSingle()

  if (error) throw error
  return (
    data?.value || {
      enabled: false,
      title: 'Maintenance',
      message: 'Sistem sedang dalam perbaikan.',
      estimated_end: null,
    }
  )
}

export async function setMaintenance(value, actorUserId = null) {
  await performSuperAdminAction('maintenance-update', { value })
}

export async function getUserAdminDetails(userId) {
  const [paymentsResult, subscriptionsResult, logsResult] = await Promise.all([
    supabase.from('subscription_payments').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    supabase.from('subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    supabase.from('activity_logs').select('*').or(`user_id.eq.${userId},target_id.eq.${userId}`).order('created_at', { ascending: false }).limit(100),
  ])
  if (paymentsResult.error) throw paymentsResult.error
  if (subscriptionsResult.error) throw subscriptionsResult.error
  if (logsResult.error) throw logsResult.error

  const planIds = [...new Set((subscriptionsResult.data || []).map((subscription) => subscription.plan_id).filter(Boolean))]
  const plansResult = planIds.length
    ? await supabase.from('subscription_plans').select('id, name, price, duration_days').in('id', planIds)
    : { data: [], error: null }
  if (plansResult.error) throw plansResult.error
  const plans = new Map((plansResult.data || []).map((plan) => [plan.id, plan]))
  return {
    payments: paymentsResult.data || [],
    subscriptions: (subscriptionsResult.data || []).map((subscription) => ({
      ...subscription,
      plan: plans.get(subscription.plan_id) || null,
    })),
    activity: logsResult.data || [],
  }
}