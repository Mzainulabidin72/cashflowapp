import { supabase } from './supabase'

const HOURS_24_MS = 24 * 60 * 60 * 1000

function cutoffIso() {
  return new Date(Date.now() - HOURS_24_MS).toISOString()
}

/**
 * Batalkan pembayaran pending yang lebih dari 24 jam.
 * Juga set subscription terkait ke cancelled (jika masih pending).
 */
export async function expireStalePayments() {
  const cutoff = cutoffIso()
  const { data: stale, error } = await supabase
    .from('subscription_payments')
    .select('id, subscription_id, status, created_at')
    .eq('status', 'pending')
    .lt('created_at', cutoff)

  if (error) {
    throw error
  }
  if (!stale?.length) return { expiredPayments: 0, cancelledSubs: 0 }

  const ids = stale.map((p) => p.id)
  const { data: expired, error: u1 } = await supabase
    .from('subscription_payments')
    .update({
      status: 'expired',
      note: 'Otomatis dibatalkan setelah 24 jam tanpa konfirmasi',
    })
    .in('id', ids)
    .eq('status', 'pending')
    .select('id')

  if (u1) throw u1

  const subIds = [
    ...new Set(stale.map((p) => p.subscription_id).filter(Boolean)),
  ]
  let cancelledSubs = 0
  if (subIds.length) {
    const { data: subs, error: subsError } = await supabase
      .from('subscriptions')
      .select('id, status')
      .in('id', subIds)
      .eq('status', 'pending')
    if (subsError) throw subsError
    const pendingIds = (subs || []).map((s) => s.id)
    if (pendingIds.length) {
      const { data: cancelled, error: u2 } = await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .in('id', pendingIds)
        .eq('status', 'pending')
        .select('id')
      if (u2) throw u2
      cancelledSubs = cancelled?.length || 0
    }
  }

  return { expiredPayments: expired?.length || 0, cancelledSubs }
}

/**
 * Tutup percakapan chat yang tidak aktif > 24 jam (berdasarkan last_message_at / created_at).
 * Memerlukan kolom status di chat_conversations (lihat sql/expiry.sql).
 * Jika kolom belum ada, hanya return id yang "stale" tanpa update.
 */
export async function expireStaleChats() {
  const cutoff = cutoffIso()
  const { data: convs, error } = await supabase
    .from('chat_conversations')
    .select('id, last_message_at, created_at, status')

  if (error) {
    console.warn('expireStaleChats', error.message)
    return { closed: 0, skipped: true }
  }

  const stale = (convs || []).filter((c) => {
    if (c.status === 'closed' || c.status === 'CLOSED') return false
    const t = c.last_message_at || c.created_at
    if (!t) return false
    return new Date(t).getTime() < Date.now() - HOURS_24_MS
  })

  if (!stale.length) return { closed: 0 }

  const ids = stale.map((c) => c.id)
  const { error: u } = await supabase
    .from('chat_conversations')
    .update({ status: 'closed' })
    .in('id', ids)

  if (u) {
    // kolom status mungkin belum ada
    console.warn(
      'expire chats update failed (jalankan sql/expiry.sql?):',
      u.message
    )
    return { closed: 0, error: u.message, staleIds: ids }
  }

  return { closed: ids.length }
}

/** Jalankan kedua expiry — panggil saat admin/client load support */
export async function runExpiryJobs() {
  const payments = await expireStalePayments()
  const chats = await expireStaleChats()
  return { payments, chats, cutoff: cutoffIso() }
}

export function isOlderThan24h(iso) {
  if (!iso) return false
  return new Date(iso).getTime() < Date.now() - HOURS_24_MS
}
