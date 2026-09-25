import { supabase } from './supabase'

/**
 * Tulis 1 baris audit log.
 * Tidak melempar error ke UI utama — log gagal tidak boleh gagalkan aksi admin.
 */
export async function writeAuditLog({
  actorId,
  actorEmail,
  action,
  targetType,
  targetId,
  targetLabel,
  previousValue,
  newValue,
  meta,
}) {
  try {
    const row = {
      actor_id: actorId || null,
      actor_email: actorEmail || null,
      action: String(action || 'unknown'),
      target_type: targetType || null,
      target_id: targetId != null ? String(targetId) : null,
      target_label: targetLabel || null,
      previous_value:
        previousValue != null ? String(previousValue) : null,
      new_value: newValue != null ? String(newValue) : null,
      meta: meta || {},
    }
    const { error } = await supabase.from('audit_logs').insert(row)
    if (error) console.warn('audit_logs insert:', error.message)
  } catch (e) {
    console.warn('audit_logs', e)
  }
}

export async function listAuditLogs({
  limit = 100,
  action,
  actorEmail,
  q,
  fromDate,
  toDate,
} = {}) {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (action && action !== 'all') {
    query = query.eq('action', action)
  }
  if (actorEmail) {
    query = query.ilike('actor_email', `%${actorEmail}%`)
  }
  if (fromDate) {
    query = query.gte('created_at', fromDate)
  }
  if (toDate) {
    query = query.lte('created_at', toDate)
  }

  const { data, error } = await query
  if (error) throw error

  let rows = data || []
  if (q && q.trim()) {
    const s = q.trim().toLowerCase()
    rows = rows.filter((r) => {
      const hay = [
        r.action,
        r.actor_email,
        r.target_label,
        r.target_type,
        r.target_id,
        r.previous_value,
        r.new_value,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(s)
    })
  }
  return rows
}

/** Label human-readable untuk action code */
export const AUDIT_ACTION_LABELS = {
  user_role_changed: 'Role changed',
  user_status_changed: 'User status changed',
  user_suspended: 'User suspended',
  user_reactivated: 'User reactivated',
  payment_verified: 'Payment verified',
  payment_rejected: 'Payment rejected',
  payment_settings_changed: 'Payment settings changed',
  maintenance_enabled: 'Maintenance enabled',
  maintenance_disabled: 'Maintenance disabled',
  maintenance_updated: 'Maintenance settings updated',
  subscription_cancelled: 'Subscription cancelled',
  subscription_activated: 'Subscription activated',
}

export function formatAuditAction(action) {
  return AUDIT_ACTION_LABELS[action] || action || '—'
}
