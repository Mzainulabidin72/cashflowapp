// Supabase Edge Function: hapus akun milik pengguna yang sedang login.
//
// Deploy:   supabase functions deploy delete-account
// Secrets:  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//           (tiga-tiganya sudah otomatis tersedia di Edge Functions; tidak perlu di-set manual)
//
// Alur: verifikasi token pengguna → hapus data milik pengguna di tabel-tabel aplikasi →
// hapus akun di Supabase Auth. Yang dihapus selalu milik pengguna yang token-nya dikirim;
// tidak menerima user id dari body.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

// Tabel yang punya kolom user_id. Urutan: data anak dulu, lalu induk.
const USER_TABLES = [
  'transactions',
  'categories',
  'user_budgets',
  'user_settings',
  'wallets',
  'debts',
  'activity_logs',
  'subscription_payments',
  'subscriptions',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum tersedia' }, 500)

    // 1. Siapa yang meminta?
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)
    const userId = userData.user.id

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // 2. Jangan izinkan akun admin menghapus dirinya lewat jalur ini
    const { data: prof } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
    if (prof?.role === 'admin' || prof?.role === 'super_admin') {
      return json({ error: 'Akun admin tidak bisa dihapus dari sini.' }, 403)
    }

    // 3. Percakapan chat & keluhan (pesan di dalamnya dihapus lebih dulu)
    const { data: convs } = await admin.from('chat_conversations').select('id').eq('user_id', userId)
    const convIds = (convs || []).map((c: { id: string }) => c.id)
    if (convIds.length) await admin.from('chat_messages').delete().in('conversation_id', convIds)
    await admin.from('chat_conversations').delete().eq('user_id', userId)

    const { data: comps } = await admin.from('complaints').select('id').eq('user_id', userId)
    const compIds = (comps || []).map((c: { id: string }) => c.id)
    if (compIds.length) await admin.from('complaint_messages').delete().in('complaint_id', compIds)
    await admin.from('complaints').delete().eq('user_id', userId)

    // 4. Tabel data milik pengguna. Gagal di satu tabel (mis. belum ada) tidak menghentikan yang lain;
    //    kalau ada sisa yang terkunci foreign key, langkah 6 akan melaporkannya.
    const warnings: string[] = []
    for (const table of USER_TABLES) {
      const { error } = await admin.from(table).delete().eq('user_id', userId)
      if (error) warnings.push(`${table}: ${error.message}`)
    }

    // 5. Profil
    const { error: profErr } = await admin.from('profiles').delete().eq('id', userId)
    if (profErr) warnings.push(`profiles: ${profErr.message}`)

    // 6. Akun login
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) {
      return json(
        { error: 'Gagal menghapus akun: ' + delErr.message, details: warnings },
        500
      )
    }

    return json({ ok: true, warnings })
  } catch (e) {
    return json({ error: (e as Error).message || 'Internal error' }, 500)
  }
})
