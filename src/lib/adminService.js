import { supabase } from './supabase'
import { writeLog } from './activityService'

export async function listClients() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role, status, created_at')
    .eq('role', 'user')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function listAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role, status, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function updateProfileRole(userId, role, actorUserId = null) {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)

  if (error) throw error

  await writeLog({
    userId: actorUserId,
    role: 'super_admin',
    action: 'role_change',
    targetId: userId,
    metadata: { role },
  })
}

export async function updateProfileStatus(userId, status, actorUserId = null) {
  const { error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', userId)

  if (error) throw error

  await writeLog({
    userId: actorUserId,
    role: 'super_admin',
    action: 'status_change',
    targetId: userId,
    metadata: { status },
  })
}

export async function getMaintenance() {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'maintenance')
    .maybeSingle()

  if (error) throw error
  return (
    data?.value || {
      enabled: false,
      title: 'Maintenance',
      message: 'Sistem sedang dalam perbaikan.',
      estimated_end: null,
    }
  )
}

export async function setMaintenance(value, actorUserId = null) {
  const { error } = await supabase
    .from('system_settings')
    .upsert({
      key: 'maintenance',
      value,
      updated_at: new Date().toISOString(),
    })

  if (error) throw error

  await writeLog({
    userId: actorUserId,
    role: 'super_admin',
    action: 'maintenance_update',
    targetId: 'maintenance',
    metadata: value,
  })
}