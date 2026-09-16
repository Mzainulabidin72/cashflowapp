// Supabase Edge Function: create Midtrans Snap token
// Secrets: MIDTRANS_SERVER_KEY, MIDTRANS_IS_PRODUCTION (optional "true")

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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY')
    const isProd = Deno.env.get('MIDTRANS_IS_PRODUCTION') === 'true'

    if (!serverKey) {
      return new Response(JSON.stringify({ error: 'MIDTRANS_SERVER_KEY belum di-set' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { subscription_id, plan_id } = body || {}
    if (!subscription_id) {
      return new Response(JSON.stringify({ error: 'subscription_id wajib' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Ambil subscription + plan (service role lebih aman; di sini pakai user client + RLS)
    const { data: sub, error: subErr } = await userClient
      .from('subscriptions')
      .select('id, user_id, plan_id, status')
      .eq('id', subscription_id)
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: 'Subscription tidak ditemukan' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const pid = plan_id || sub.plan_id
    const { data: plan, error: planErr } = await userClient
      .from('subscription_plans')
      .select('id, name, price')
      .eq('id', pid)
      .maybeSingle()

    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: 'Plan tidak ditemukan' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const amount = Math.round(Number(plan.price) || 0)
    if (amount <= 0) {
      return new Response(JSON.stringify({ error: 'Paket gratis tidak perlu bayar' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const orderId = `CF-${sub.id.slice(0, 8)}-${Date.now()}`

    // Catat payment pending
    const { data: payRow, error: payErr } = await userClient
      .from('subscription_payments')
      .insert({
        subscription_id: sub.id,
        user_id: userData.user.id,
        amount,
        status: 'pending',
        payment_method: 'midtrans_snap',
        provider: 'midtrans',
        provider_order_id: orderId,
        note: `Snap order ${orderId}`,
      })
      .select()
      .single()

    if (payErr) {
      return new Response(JSON.stringify({ error: payErr.message }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const snapUrl = isProd
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions'

    const auth = btoa(serverKey + ':')
    const snapRes = await fetch(snapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: orderId,
          gross_amount: amount,
        },
        item_details: [
          {
            id: plan.id,
            price: amount,
            quantity: 1,
            name: `CashFlow ${plan.name}`.slice(0, 50),
          },
        ],
        customer_details: {
          email: userData.user.email,
        },
        callbacks: {
          finish: Deno.env.get('APP_URL') || 'http://localhost:5173/subscription',
        },
      }),
    })

    const snapJson = await snapRes.json()
    if (!snapRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Midtrans error', detail: snapJson }),
        {
          status: 502,
          headers: { ...cors, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({
        token: snapJson.token,
        redirect_url: snapJson.redirect_url,
        order_id: orderId,
        payment_id: payRow.id,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
