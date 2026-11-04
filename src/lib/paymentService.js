import { supabase } from './supabase'
import { writeLog } from './activityService'

export async function createPayment({ subscriptionId, userId, amount, paymentMethod, note }) {
  const { data: existingPayment, error: existingPaymentError } = await supabase
    .from('subscription_payments')
    .select('id')
    .eq('subscription_id', subscriptionId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()

  if (existingPaymentError) throw existingPaymentError
  if (existingPayment) {
    throw new Error('Konfirmasi pembayaran untuk paket ini sudah menunggu verifikasi.')
  }

  const { data, error } = await supabase
    .from('subscription_payments')
    .insert({
      subscription_id: subscriptionId,
      user_id: userId,
      amount,
      payment_method: paymentMethod || 'transfer',
      status: 'pending',
      note: note || null,
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

export async function listMyPayments(userId, page = 0, pageSize = 10) {
  const from = page * pageSize
  const { data, error, count } = await supabase
    .from('subscription_payments')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) throw error
  return { payments: data || [], count: count || 0 }
}

export async function getPendingPayment(subscriptionId, userId) {
  const { data, error } = await supabase
    .from('subscription_payments')
    .select('id, status, created_at')
    .eq('subscription_id', subscriptionId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
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