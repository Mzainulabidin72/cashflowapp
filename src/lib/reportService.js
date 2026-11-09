import { supabase } from './supabase'
import { listActivityLogs } from './activityService'

export async function getSuperAdminReport() {
  const now = new Date()
  const rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))
  const startIso = rangeStart.toISOString()
  const monthKeys = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth() + index, 1))
    return date.toISOString().slice(0, 7)
  })

  const count = async (table, filters = []) => {
    let query = supabase.from(table).select('id', { count: 'exact', head: true })
    for (const [method, ...args] of filters) query = query[method](...args)
    const { count: total, error } = await query
    if (error) throw error
    return total || 0
  }
  const readAll = async (table, select, configure = (query) => query) => {
    const rows = []
    const pageSize = 500
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await configure(supabase.from(table).select(select)).range(from, from + pageSize - 1)
      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < pageSize) break
    }
    return rows
  }

  const [totalUsers, totalAdmins, totalSuperAdmins, usersActive, usersSuspended,
    subsPending, paymentsPaid, paymentsPending, paymentsRejected, paymentsExpired, paymentsFailed,
    profiles, subscriptions, payments, plans, recentUsers, recentPayments, activity, activityRows] = await Promise.all([
    count('profiles', [['eq', 'role', 'user']]),
    count('profiles', [['eq', 'role', 'admin']]),
    count('profiles', [['eq', 'role', 'super_admin']]),
    count('profiles', [['eq', 'role', 'user'], ['or', 'status.eq.active,status.is.null']]),
    count('profiles', [['eq', 'role', 'user'], ['eq', 'status', 'suspended']]),
    count('subscriptions', [['eq', 'status', 'pending']]),
    count('subscription_payments', [['eq', 'status', 'paid']]),
    count('subscription_payments', [['eq', 'status', 'pending']]),
    count('subscription_payments', [['eq', 'status', 'rejected']]),
    count('subscription_payments', [['eq', 'status', 'expired']]),
    count('subscription_payments', [['eq', 'status', 'failed']]),
    readAll('profiles', 'id, role, status, created_at', (query) => query.eq('role', 'user').gte('created_at', startIso)),
    readAll('subscriptions', 'id, user_id, status, plan_id, created_at, starts_at, ends_at'),
    readAll('subscription_payments', 'id, amount, status, created_at, paid_at'),
    supabase.from('subscription_plans').select('id, name, price').then(({ data, error }) => {
      if (error) throw error
      return data || []
    }),
    supabase.from('profiles').select('id, role, status, created_at, full_name, email').eq('role', 'user').order('created_at', { ascending: false }).limit(8).then(({ data, error }) => {
      if (error) throw error
      return data || []
    }),
    supabase.from('subscription_payments').select('id, amount, status, created_at, paid_at, payment_method, note').order('created_at', { ascending: false }).limit(8).then(({ data, error }) => {
      if (error) throw error
      return data || []
    }),
    listActivityLogs(8),
    readAll('activity_logs', 'created_at, action, role', (query) => query.gte('created_at', startIso)),
  ])

  const planMap = new Map(plans.map((plan) => [plan.id, plan]))
  const latestSubscriptionByUser = new Map()
  subscriptions
    .slice()
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .forEach((subscription) => {
      if (subscription.user_id && !latestSubscriptionByUser.has(subscription.user_id)) {
        latestSubscriptionByUser.set(subscription.user_id, subscription)
      }
    })
  const activeSubs = [...latestSubscriptionByUser.values()].filter((subscription) =>
    subscription.status === 'active' && (!subscription.ends_at || new Date(subscription.ends_at) >= now)
  )
  const activePaidSubs = activeSubs.filter((subscription) => {
    const name = String(planMap.get(subscription.plan_id)?.name || '').toLowerCase()
    return name && !name.includes('gratis') && !name.includes('free')
  })
  const paidUserIds = new Set(activePaidSubs.map((subscription) => subscription.user_id).filter(Boolean))
  const byPlan = { Gratis: Math.max(0, totalUsers - paidUserIds.size) }
  activePaidSubs.forEach((subscription) => {
    const name = planMap.get(subscription.plan_id)?.name || 'Lainnya'
    byPlan[name] = (byPlan[name] || 0) + 1
  })

  const registrationsByMonth = Object.fromEntries(monthKeys.map((key) => [key, 0]))
  profiles.forEach((profile) => {
    if (profile.created_at) {
      const key = profile.created_at.slice(0, 7)
      if (key in registrationsByMonth) registrationsByMonth[key] += 1
    }
  })
  const revenueByMonth = Object.fromEntries(monthKeys.map((key) => [key, 0]))
  const paymentStatusesByMonth = Object.fromEntries(monthKeys.map((key) => [key, { paid: 0, pending: 0, rejected: 0, expired: 0, failed: 0 }]))
  payments.filter((payment) => payment.status === 'paid').forEach((payment) => {
    const key = (payment.paid_at || payment.created_at || '').slice(0, 7)
    if (key in revenueByMonth) revenueByMonth[key] += Number(payment.amount || 0)
  })
  payments.forEach((payment) => {
    const key = (payment.created_at || '').slice(0, 7)
    if (key in paymentStatusesByMonth && payment.status in paymentStatusesByMonth[key]) {
      paymentStatusesByMonth[key][payment.status] += 1
    }
  })
  const activityByMonth = Object.fromEntries(monthKeys.map((key) => [key, 0]))
  activityRows.forEach((log) => {
    const key = (log.created_at || '').slice(0, 7)
    if (key in activityByMonth) activityByMonth[key] += 1
  })

  const pendingRows = payments.filter((payment) => payment.status === 'pending')
  const paidRows = payments.filter((payment) => payment.status === 'paid')
  const revenuePaid = paidRows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const revenuePending = pendingRows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const totalProfiles = totalUsers + totalAdmins + totalSuperAdmins
  const byPaymentStatus = [
    { name: 'Verified', value: paymentsPaid },
    { name: 'Pending', value: paymentsPending },
    { name: 'Rejected', value: paymentsRejected },
    { name: 'Expired', value: paymentsExpired },
    { name: 'Failed', value: paymentsFailed },
  ]

  return {
    totalProfiles,
    totalUsers,
    totalAdmins,
    totalSuperAdmins,
    usersActive,
    usersSuspended,
    totalSubscribers: paidUserIds.size,
    freePlanUsers: byPlan.Gratis,
    basicPlanUsers: Object.entries(byPlan).find(([name]) => name.toLowerCase() === 'basic')?.[1] || 0,
    proPlanUsers: Object.entries(byPlan).find(([name]) => name.toLowerCase() === 'pro')?.[1] || 0,
    subsActive: activeSubs.length,
    subsPending,
    paymentsPaid,
    paymentsPending,
    paymentsRejected,
    paymentsExpired,
    paymentsFailed,
    revenuePaid,
    revenuePending,
    byPlan,
    byPaymentStatus,
    userGrowth: monthKeys.map((month) => ({ month, users: registrationsByMonth[month] })),
    monthlyRevenue: monthKeys.map((month) => ({ month, revenue: revenueByMonth[month] })),
    monthlyPaymentStatuses: monthKeys.map((month) => ({ month, ...paymentStatusesByMonth[month] })),
    monthlyActivity: monthKeys.map((month) => ({ month, activities: activityByMonth[month] })),
    recentActivity: activity,
    recentUsers,
    recentPayments,
    registrationRangeStart: startIso,
  }
}
