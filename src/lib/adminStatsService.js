import { supabase } from './supabase'

/** Ringkasan untuk badge di Admin Home */
export async function getAdminBadges() {
  const [chatRes, openCompRes, pendingPayRes, pendingSubRes] = await Promise.all([
    supabase.from('chat_conversations').select('id', { count: 'exact', head: true }),
    supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .in('status', ['OPEN', 'IN_PROGRESS', 'open', 'in_progress']),
    supabase
      .from('subscription_payments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  const failed = [chatRes, openCompRes, pendingPayRes, pendingSubRes].find((result) => result.error)
  if (failed?.error) throw failed.error
  return {
    conversations: chatRes.count || 0,
    openComplaints: openCompRes.count || 0,
    pendingPayments: pendingPayRes.count || 0,
    pendingSubscriptions: pendingSubRes.count || 0,
  }
}
