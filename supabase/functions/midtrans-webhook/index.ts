// Webhook Midtrans notification → mark paid + activate subscription
// Secrets: MIDTRANS_SERVER_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const body = await req.json()
    const orderId = body.order_id
    const status = body.transaction_status
    const fraud = body.fraud_status

    const paid =
      status === 'capture' ||
      status === 'settlement' ||
      (status === 'capture' && fraud === 'accept')

    if (!orderId) {
      return new Response(JSON.stringify({ ok: false }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: pay } = await supabase
      .from('subscription_payments')
      .select('*')
      .eq('provider_order_id', orderId)
      .maybeSingle()

    if (!pay) {
      return new Response(JSON.stringify({ ok: true, note: 'order not found' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    await supabase
      .from('subscription_payments')
      .update({
        provider_payload: body,
        status: paid ? 'paid' : status === 'pending' ? 'pending' : 'failed',
        paid_at: paid ? new Date().toISOString() : null,
      })
      .eq('id', pay.id)

    if (paid && pay.subscription_id) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id, plan_id')
        .eq('id', pay.subscription_id)
        .maybeSingle()

      let ends: string | null = null
      if (sub?.plan_id) {
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('duration_days')
          .eq('id', sub.plan_id)
          .maybeSingle()
        const days = Number(plan?.duration_days) || 30
        const d = new Date()
        d.setDate(d.getDate() + days)
        ends = d.toISOString()
      }

      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          starts_at: new Date().toISOString(),
          ends_at: ends,
        })
        .eq('id', pay.subscription_id)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
