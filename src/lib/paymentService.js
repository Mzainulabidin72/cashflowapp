import { supabase } from './supabase'
import { writeLog } from './activityService'

export async function createPayment({ subscriptionId, userId, amount, paymentMethod, note }) {
  const { data, error } = await supabase
    .from('subscription_payments')
    .insert({
      subscription_id: subscriptionId,
      user_id: userId,
      amount,
      payment_method: paymentMethod || 'transfer',
      status: 'pending',
      // pakai kolom yang ada; note disimpan di payment_method gabungan jika perlu
    })
    .select()
    .single()

  if (error) throw error

  await writeLog({
    userId,
    role: 'user',
    action: 'payment_submit',
    targetId: data.id,
    metadata: { subscription_id: subscriptionId, amount, note: note || null },
  })

  return data
}

export async function listMyPayments(userId) {
  const { data, error } = await supabase
    .from('subscription_payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function listAllPayments() {
  const { data, error } = await supabase
    .from('subscription_payments')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!data?.length) return []

  const userIds = [...new Set(data.map((p) => p.user_id).filter(Boolean))]
  let profileMap = {}

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

  return data.map((p) => ({
    ...p,
    profile: profileMap[p.user_id] || null,
  }))
}

export async function markPaymentPaid(paymentId, adminUserId = null) {
  const { error } = await supabase
    .from('subscription_payments')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', paymentId)

  if (error) throw error

  await writeLog({
    userId: adminUserId,
    role: 'admin',
    action: 'payment_mark_paid',
    targetId: paymentId,
  })
}