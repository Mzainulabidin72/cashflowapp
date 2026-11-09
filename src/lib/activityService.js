import { supabase } from './supabase'

export async function writeLog({ userId, role, action, targetId = null, metadata = null }) {
  const { error } = await supabase.from('activity_logs').insert({
    user_id: userId || null,
    role: role || null,
    action,
    target_id: targetId,
    metadata,
  })
  if (error) console.error('activity log error:', error.message)
}

export async function listActivityLogs(limit = 100) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 100, 1), 1000))

  if (error) throw error
  if (!data?.length) return []

  const profileIds = [...new Set(data.flatMap((log) => [log.user_id, log.target_id]).filter((id) =>
    typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ))]
  let profileMap = {}

  if (profileIds.length) {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', profileIds)
    if (pErr) throw pErr
    ;(profiles || []).forEach((p) => {
      profileMap[p.id] = p
    })
  }

  return data.map((l) => ({
    ...l,
    profile: profileMap[l.user_id] || null,
    targetProfile: profileMap[l.target_id] || null,
  }))
}