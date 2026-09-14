import { supabase } from './supabase'

export async function getSuperAdminReport() {
  const [profilesRes, subsRes, paymentsRes, plansRes] = await Promise.all([
    supabase.from('profiles').select('id, role, status, created_at, full_name, email'),
    supabase
      .from('subscriptions')
      .select('id, status, plan_id, created_at, starts_at, ends_at'),
    supabase
      .from('subscription_payments')
      .select('id, amount, status, created_at, paid_at'),
    supabase.from('subscription_plans').select('id, name, price'),
  ])

  if (profilesRes.error) throw profilesRes.error
  if (subsRes.error) throw subsRes.error
  if (paymentsRes.error) throw paymentsRes.error
  if (plansRes.error) throw plansRes.error

  const profiles = profilesRes.data || []
  const subs = subsRes.data || []
  const payments = paymentsRes.data || []
  const plans = plansRes.data || []
  const planMap = {}
  plans.forEach((p) => {
    planMap[p.id] = p
  })

  const users = profiles.filter((p) => p.role === 'user')
  const admins = profiles.filter((p) => p.role === 'admin')
  const superAdmins = profiles.filter((p) => p.role === 'super_admin')

  const activeSubs = subs.filter((s) => s.status === 'active')
  const pendingSubs = subs.filter((s) => s.status === 'pending')
  const paidPayments = payments.filter((p) => p.status === 'paid')
  const pendingPayments = payments.filter((p) => p.status === 'pending')

  const revenuePaid = paidPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const revenuePending = pendingPayments.reduce(
    (s, p) => s + Number(p.amount || 0),
    0
  )

  const byPlan = {}
  activeSubs.forEach((s) => {
    const name = planMap[s.plan_id]?.name || 'Unknown'
    byPlan[name] = (byPlan[name] || 0) + 1
  })

  return {
    totalProfiles: profiles.length,
    totalUsers: users.length,
    totalAdmins: admins.length,
    totalSuperAdmins: superAdmins.length,
    usersActive: users.filter((u) => (u.status || 'active') === 'active').length,
    subsActive: activeSubs.length,
    subsPending: pendingSubs.length,
    paymentsPaid: paidPayments.length,
    paymentsPending: pendingPayments.length,
    revenuePaid,
    revenuePending,
    byPlan,
    recentUsers: [...users]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 8),
    recentPayments: [...payments]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 8),
  }
}
