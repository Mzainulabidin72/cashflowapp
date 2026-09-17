import { getMySubscription, listPlans } from './subscriptionService'

export const FREE_TX_LIMIT_PER_MONTH = 200

export const PLAN_RANK = {
  gratis: 0,
  free: 0,
  basic: 1,
  pro: 2,
  tahunan: 2,
}

export function normalizePlanName(name = '') {
  return String(name).trim().toLowerCase()
}

export function planRank(name) {
  const n = normalizePlanName(name)
  if (n.includes('tahun')) return PLAN_RANK.tahunan
  if (n.includes('pro')) return PLAN_RANK.pro
  if (n.includes('basic') || n.includes('kelola')) return PLAN_RANK.basic
  return PLAN_RANK.gratis
}

export function canUseProTools(planName) {
  const n = normalizePlanName(planName)
  return n.includes('pro') || n.includes('tahun') || n.includes('annual')
}

export function isSubscriptionActive(sub) {
  if (!sub) return false
  if (sub.status !== 'active') return false
  if (sub.ends_at && new Date(sub.ends_at) <= new Date()) return false
  return true
}

export async function getUserPlanInfo(userId) {
  const [sub, plans] = await Promise.all([
    getMySubscription(userId),
    listPlans(),
  ])

  let planName = 'Gratis'
  let rank = 0
  let active = true
  let source = 'default_free'

  if (isSubscriptionActive(sub)) {
    const plan = plans.find((p) => p.id === sub.plan_id)
    planName = plan?.name || 'Basic'
    rank = planRank(planName)
    active = true
    source = 'subscription'
  } else if (sub?.status === 'pending') {
    source = 'pending'
    active = true
    planName = 'Gratis'
    rank = 0
  }

  return {
    planName,
    rank,
    active,
    source,
    subscription: sub,
    plans,
    canUseUnlimitedTx: rank >= PLAN_RANK.basic,
    canUseCustomCategory: rank >= PLAN_RANK.basic,
    canUseFullAnalytics: rank >= PLAN_RANK.pro,
    canUseExport: rank >= PLAN_RANK.basic,
    canUseProTools: rank >= PLAN_RANK.pro || canUseProTools(planName),
    txLimitPerMonth: rank >= PLAN_RANK.basic ? null : FREE_TX_LIMIT_PER_MONTH,
  }
}

export function countTxThisMonth(transactions) {
  const key = new Date().toISOString().slice(0, 7)
  return (transactions || []).filter((t) =>
    String(t.date || '').startsWith(key)
  ).length
}
