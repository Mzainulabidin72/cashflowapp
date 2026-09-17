import { supabase } from './supabase'

const IS_PROD =
  String(import.meta.env.VITE_MIDTRANS_IS_PRODUCTION || '').toLowerCase() ===
  'true'

const CLIENT_KEY = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || ''

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
    console.error('create-midtrans-snap error', json)
    throw new Error(
      json.error ||
        json.detail?.error_messages?.[0] ||
        JSON.stringify(json.detail || json) ||
        'Gagal membuat pembayaran'
    )
  }
  return json
}

/** Selalu reload Snap biar Client Key + env tidak ketahan cache */
export function loadSnapScript(isProduction = IS_PROD) {
  return new Promise((resolve, reject) => {
    // hapus script & instance lama
    document
      .querySelectorAll('script[data-midtrans-snap]')
      .forEach((el) => el.remove())
    try {
      delete window.snap
    } catch (_) {}

    const s = document.createElement('script')
    s.src = isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js'
    s.setAttribute('data-client-key', CLIENT_KEY)
    s.setAttribute('data-midtrans-snap', '1')
    s.onload = () => {
      if (!window.snap) {
        reject(new Error('Snap.js loaded tapi window.snap kosong'))
        return
      }
      resolve(window.snap)
    }
    s.onerror = () => reject(new Error('Gagal load Snap.js'))
    document.body.appendChild(s)
  })
}

export async function openMidtransPay({ subscriptionId, planId }) {
  if (!CLIENT_KEY) {
    throw new Error('VITE_MIDTRANS_CLIENT_KEY belum di-set')
  }

  const snapData = await payWithMidtransSnap({ subscriptionId, planId })
  console.log('Snap env', { IS_PROD, hasToken: !!snapData.token })

  const snap = await loadSnapScript(IS_PROD)
  return new Promise((resolve) => {
    snap.pay(snapData.token, {
      onSuccess: (result) => resolve({ ok: true, result, snapData }),
      onPending: (result) =>
        resolve({ ok: false, pending: true, result, snapData }),
      onError: (result) =>
        resolve({ ok: false, error: true, result, snapData }),
      onClose: () => resolve({ ok: false, closed: true, snapData }),
    })
  })
}