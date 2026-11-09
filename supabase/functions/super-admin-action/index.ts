import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
type SuperAdminActionPayload = {
  userId?: string
  role?: string
  status?: string
  paymentId?: string
  reason?: string
  subscriptionId?: string
  durationDays?: number
  days?: number
  value?: Record<string, unknown>
}

const restorePendingPayment = async (admin: ReturnType<typeof createClient>, paymentId: string, paidAt: string) => {
  const { data, error } = await admin.from('subscription_payments')
    .update({ status: 'pending', paid_at: null })
    .eq('id', paymentId)
    .eq('status', 'paid')
    .eq('paid_at', paidAt)
    .select('id')
    .maybeSingle()
  if (error) throw new Error(`Subscription activation failed and payment rollback failed: ${error.message}`)
  if (!data) throw new Error('Subscription activation failed; payment state changed concurrently and needs review')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authorization = req.headers.get('Authorization')
    if (!authorization) return json({ error: 'Unauthorized' }, 401)

    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !anonKey || !serviceKey) return json({ error: 'Server configuration is incomplete' }, 500)

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const { data: actor, error: actorError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', authData.user.id)
      .maybeSingle()
    if (actorError) throw actorError
    if (actor?.role !== 'super_admin') return json({ error: 'Super Admin access required' }, 403)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Request body must be valid JSON' }, 400)
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request body' }, 400)
    const requestBody = body as Record<string, unknown>
    const action = requestBody.action
    const rawPayload = requestBody.payload
    if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
      return json({ error: 'Invalid action payload' }, 400)
    }
    const payload = rawPayload as SuperAdminActionPayload
    let targetId: string | null = null
    let metadata: Record<string, unknown> = {}

    if (action === 'profile-role' || action === 'profile-status') {
      if (typeof payload.userId !== 'string' || !uuidPattern.test(payload.userId) || payload.userId === actor.id) {
        return json({ error: 'Invalid target account' }, 400)
      }
      targetId = payload.userId
      const { data: target, error } = await admin
        .from('profiles')
        .select('id, role')
        .eq('id', targetId)
        .maybeSingle()
      if (error) throw error
      if (!target || target.role === 'super_admin') return json({ error: 'This account cannot be modified' }, 403)

      if (action === 'profile-role') {
        if (typeof payload.role !== 'string' || !['user', 'admin'].includes(payload.role)) return json({ error: 'Invalid role' }, 400)
        const { data: updated, error: updateError } = await admin.from('profiles').update({ role: payload.role }).eq('id', targetId).select('id').maybeSingle()
        if (updateError) throw updateError
        if (!updated) return json({ error: 'Account was not updated' }, 409)
        metadata = { role: payload.role }
      } else {
        if (typeof payload.status !== 'string' || !['active', 'inactive', 'suspended'].includes(payload.status)) return json({ error: 'Invalid account status' }, 400)
        const { data: updated, error: updateError } = await admin.from('profiles').update({ status: payload.status }).eq('id', targetId).select('id').maybeSingle()
        if (updateError) throw updateError
        if (!updated) return json({ error: 'Account was not updated' }, 409)
        metadata = { status: payload.status }
      }
    } else if (action === 'payment-approve' || action === 'payment-reject') {
      if (typeof payload.paymentId !== 'string' || !uuidPattern.test(payload.paymentId)) return json({ error: 'Invalid payment' }, 400)
      targetId = payload.paymentId
      const { data: payment, error } = await admin
        .from('subscription_payments')
        .select('id, user_id, subscription_id, status')
        .eq('id', targetId)
        .maybeSingle()
      if (error) throw error
      if (!payment || payment.status !== 'pending') return json({ error: 'Payment is no longer pending' }, 409)

      if (action === 'payment-reject') {
        const reason = typeof payload.reason === 'string' ? payload.reason.trim().slice(0, 1000) : ''
        const { data, error: updateError } = await admin
          .from('subscription_payments')
          .update({ status: 'rejected', note: reason || 'Ditolak admin' })
          .eq('id', targetId)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle()
        if (updateError) throw updateError
        if (!data) return json({ error: 'Payment is no longer pending' }, 409)
        metadata = { status: 'rejected', reason: reason || null }
      } else {
        if (!payment.subscription_id) return json({ error: 'Payment has no linked subscription' }, 409)
        const verifiedAt = new Date().toISOString()
        const { data: paidPayment, error: updateError } = await admin
          .from('subscription_payments')
          .update({ status: 'paid', paid_at: verifiedAt })
          .eq('id', targetId)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle()
        if (updateError) throw updateError
        if (!paidPayment) return json({ error: 'Payment is no longer pending' }, 409)

        const { data: subscription, error: subscriptionError } = await admin
          .from('subscriptions')
          .select('id, plan_id, user_id, status')
          .eq('id', payment.subscription_id)
          .maybeSingle()
        if (subscriptionError || !subscription) {
          await restorePendingPayment(admin, targetId, verifiedAt)
          if (subscriptionError) throw subscriptionError
          return json({ error: 'Linked subscription was not found' }, 409)
        }
        if (subscription.user_id !== payment.user_id) {
          await restorePendingPayment(admin, targetId, verifiedAt)
          return json({ error: 'Payment and subscription owners do not match' }, 409)
        }
        let durationDays = 30
        if (subscription.plan_id) {
          const { data: plan, error: planError } = await admin
            .from('subscription_plans')
            .select('duration_days')
            .eq('id', subscription.plan_id)
            .maybeSingle()
          if (planError) {
            await restorePendingPayment(admin, targetId, verifiedAt)
            throw planError
          }
          durationDays = Number(plan?.duration_days) || 30
        }
        if (subscription.status !== 'active') {
          const starts = new Date()
          const ends = new Date(starts)
          ends.setDate(ends.getDate() + durationDays)
          const { error: activationError } = await admin
            .from('subscriptions')
            .update({ status: 'active', starts_at: starts.toISOString(), ends_at: ends.toISOString() })
            .eq('id', subscription.id)
          if (activationError) {
            await restorePendingPayment(admin, targetId, verifiedAt)
            throw activationError
          }
        }
        metadata = { status: 'paid', subscription_id: subscription.id, duration_days: durationDays }
      }
    } else if (action === 'subscription-cancel' || action === 'subscription-activate' || action === 'subscription-extend') {
      if (typeof payload.subscriptionId !== 'string' || !uuidPattern.test(payload.subscriptionId)) return json({ error: 'Invalid subscription' }, 400)
      targetId = payload.subscriptionId
      const { data: subscription, error } = await admin
        .from('subscriptions')
        .select('id, status, plan_id')
        .eq('id', targetId)
        .maybeSingle()
      if (error) throw error
      if (!subscription) return json({ error: 'Subscription not found' }, 404)

      if (action === 'subscription-cancel') {
        const { error: updateError } = await admin.from('subscriptions').update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        }).eq('id', targetId)
        if (updateError) throw updateError
        metadata = { status: 'cancelled' }
      } else if (action === 'subscription-activate') {
        const { data: paidPayment, error: paymentError } = await admin
          .from('subscription_payments')
          .select('id')
          .eq('subscription_id', targetId)
          .eq('status', 'paid')
          .limit(1)
          .maybeSingle()
        if (paymentError) throw paymentError
        if (!paidPayment) return json({ error: 'A verified payment is required before activation' }, 409)
        let durationDays = Number(payload.durationDays)
        if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 3650) {
          if (subscription.plan_id) {
            const { data: plan, error: planError } = await admin
              .from('subscription_plans')
              .select('duration_days')
              .eq('id', subscription.plan_id)
              .maybeSingle()
            if (planError) throw planError
            durationDays = Number(plan?.duration_days) || 30
          } else durationDays = 30
        }
        const starts = new Date()
        const ends = new Date(starts)
        ends.setDate(ends.getDate() + durationDays)
        const { error: updateError } = await admin.from('subscriptions').update({
          status: 'active',
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          updated_at: starts.toISOString(),
        }).eq('id', targetId)
        if (updateError) throw updateError
        metadata = { status: 'active', duration_days: durationDays }
      } else {
        const days = Number(payload.days)
        if (!Number.isInteger(days) || days < 1 || days > 3650) return json({ error: 'Extension must be between 1 and 3650 days' }, 400)
        if (subscription.status !== 'active') return json({ error: 'Only active subscriptions can be extended' }, 409)
        const { data: current, error: currentError } = await admin
          .from('subscriptions')
          .select('ends_at')
          .eq('id', targetId)
          .single()
        if (currentError) throw currentError
        const end = new Date(current.ends_at || new Date())
        if (end < new Date()) end.setTime(Date.now())
        end.setDate(end.getDate() + days)
        const { error: updateError } = await admin.from('subscriptions').update({
          ends_at: end.toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', targetId)
        if (updateError) throw updateError
        metadata = { days, ends_at: end.toISOString() }
      }
    } else if (action === 'maintenance-update' || action === 'payment-account-update') {
      const key = action === 'maintenance-update' ? 'maintenance' : 'payment_account'
      const value = payload.value
      if (!value || typeof value !== 'object' || Array.isArray(value)) return json({ error: 'Invalid settings payload' }, 400)
      if (action === 'maintenance-update') {
        if (typeof value.enabled !== 'boolean') return json({ error: 'Invalid maintenance status' }, 400)
        if (String(value.title || '').length > 120 || String(value.message || '').length > 2000) return json({ error: 'Maintenance content is too long' }, 400)
        if (value.estimated_end != null && String(value.estimated_end).length > 120) return json({ error: 'Invalid estimated completion time' }, 400)
        payload.value = {
          enabled: value.enabled,
          title: String(value.title || '').trim() || 'Maintenance',
          message: String(value.message || '').trim() || 'Sistem sedang dalam perbaikan.',
          estimated_end: value.estimated_end ? String(value.estimated_end).trim() : null,
        }
        metadata = { enabled: payload.value.enabled, title: payload.value.title, estimated_end: payload.value.estimated_end }
      } else {
        const normalized = {
          bank_name: String(value.bank_name || '').trim().slice(0, 120),
          account_number: String(value.account_number || '').trim().slice(0, 80),
          account_name: String(value.account_name || '').trim().slice(0, 160),
          notes: String(value.notes || '').trim().slice(0, 2000),
        }
        payload.value = normalized
        metadata = { bank_name: normalized.bank_name, account_number_last4: normalized.account_number.slice(-4) }
      }
      const { error: updateError } = await admin.from('system_settings').upsert({
        key,
        value: payload.value,
        updated_at: new Date().toISOString(),
      })
      if (updateError) throw updateError
      targetId = key
    } else {
      return json({ error: 'Unknown administrative action' }, 400)
    }

    const { error: logError } = await admin.from('activity_logs').insert({
      user_id: actor.id,
      role: 'super_admin',
      action,
      target_id: targetId,
      metadata,
    })
    if (logError) return json({ error: `Action completed, but audit logging failed: ${logError.message}` }, 500)
    return json({ ok: true })
  } catch (error) {
    console.error('super-admin-action failed:', error)
    return json({ error: error instanceof Error ? error.message : 'Administrative action failed' }, 500)
  }
})
