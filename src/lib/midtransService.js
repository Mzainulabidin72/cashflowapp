import { supabase } from './supabase'

/** Panggil Edge Function → dapat Snap token, buka popup Midtrans */
export async function payWithMidtransSnap({ subscriptionId, planId }) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Belum login')

  const base = import.meta.env.VITE_SUPABASE_URL
  const res = await fetch(`${base}/functions/v1/create-midtrans-snap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      subscription_id: subscriptionId,
      plan_id: planId,
    }),
  })

  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error || json.detail?.error_messages?.[0] || 'Gagal membuat pembayaran')
  }

  return json // { token, redirect_url, order_id, payment_id }
}

export function loadSnapScript(isProduction = false) {
  return new Promise((resolve, reject) => {
    if (window.snap) {
      resolve(window.snap)
      return
    }
    const s = document.createElement('script')
    s.src = isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js'
    s.setAttribute(
      'data-client-key',
      import.meta.env.VITE_MIDTRANS_CLIENT_KEY || ''
    )
    s.onload = () => resolve(window.snap)
    s.onerror = () => reject(new Error('Gagal load Snap.js'))
    document.body.appendChild(s)
  })
}

export async function openMidtransPay({ subscriptionId, planId }) {
  const snapData = await payWithMidtransSnap({ subscriptionId, planId })
  const snap = await loadSnapScript(false)
  return new Promise((resolve) => {
    snap.pay(snapData.token, {
      onSuccess: (result) => resolve({ ok: true, result, snapData }),
      onPending: (result) => resolve({ ok: false, pending: true, result, snapData }),
      onError: (result) => resolve({ ok: false, error: true, result, snapData }),
      onClose: () => resolve({ ok: false, closed: true, snapData }),
    })
  })
}
