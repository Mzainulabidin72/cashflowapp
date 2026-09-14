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
    .limit(limit)

  if (error) throw error
  if (!data?.length) return []

  const userIds = [...new Set(data.map((l) => l.user_id).filter(Boolean))]
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

  return data.map((l) => ({
    ...l,
    profile: profileMap[l.user_id] || null,
  }))
}